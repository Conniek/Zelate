/**
 * SQL implementation of the ports (BACKEND_SCHEMA §8.2). It needs only a
 * `query(text, params)` function inside a transaction, so the same code runs
 * with postgres.js in Deno (Edge Functions) and in Node (integration tests).
 *
 * Connected with the database owner role: RLS does not apply here, the
 * service has already decided who may do what.
 *
 * Realtime messages are sent with `realtime.send` inside the transaction, so
 * they leave only if it commits (ADR-009). Topics of the tracking link are
 * computed in SQL from the token, which never comes back to the function.
 */
import type {
  BreakType,
  Instant,
  MemberRole,
  MemberStatus,
  PresenceStatus,
  QueueStatus,
  SalonStatus,
  TicketState,
  TicketStatus,
} from '../../queue-engine/src/index.ts';
import { TICKET_FIELDS, TICKET_INSTANT_FIELDS } from './mapping.ts';
import type { LinkView, TicketLinkReader } from './link.ts';
import type {
  Broadcast,
  DayData,
  DbValue,
  MemberRow,
  QueueDb,
  QueueTx,
  SalonRow,
  TicketRef,
  WriteSet,
} from './ports.ts';

export interface SqlRunner {
  query<T = Row>(text: string, params?: readonly unknown[]): Promise<T[]>;
}

/** Runs a function inside one transaction (postgres.js `sql.begin`). */
export type SqlTransaction = <T>(
  fn: (q: SqlRunner) => Promise<T>,
) => Promise<T>;

type Row = Record<string, unknown>;

const ACTIVE = `('pending_confirmation','waiting','called','in_service')`;

const hex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

function ms(value: unknown): Instant | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.getTime();
  return Date.parse(String(value));
}

const num = (value: unknown): number => Number(value);
const numOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

const INSTANTS: ReadonlySet<string> = new Set(TICKET_INSTANT_FIELDS);
const NUMBERS: ReadonlySet<string> = new Set([
  'appointment_delay_warned_steps',
  'planned_duration_minutes',
  'queue_rank',
  'call_count',
  'postpone_count',
  'declared_delay_minutes',
  'estimate_version',
  'actual_duration_minutes',
]);

function ticketFromRow(row: Row): TicketState {
  const out: Row = {};
  for (const key of TICKET_FIELDS) {
    const value = row[key];
    if (INSTANTS.has(key)) out[key] = ms(value);
    else if (NUMBERS.has(key)) out[key] = numOrNull(value);
    else out[key] = value ?? null;
  }
  return out as unknown as TicketState;
}

const TICKET_SELECT = TICKET_FIELDS.map((f) =>
  f === 'service_date' ? 'service_date::text as service_date' : f,
).join(', ');

/** `SET a = $1, b = $2 …` with a cast for jsonb columns. */
function assignments(
  columns: Readonly<Record<string, DbValue>>,
  offset: number,
  jsonb: ReadonlySet<string> = new Set(),
): { sql: string; params: DbValue[] } {
  const keys = Object.keys(columns);
  return {
    sql: keys
      .map(
        (k, i) => `${k} = $${i + offset}${jsonb.has(k) ? '::text::jsonb' : ''}`,
      )
      .join(', '),
    params: keys.map((k) => columns[k]!),
  };
}

function assertIdentifier(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`bad column ${name}`);
  return name;
}

function topic(b: Broadcast, salonId: string): string | null {
  if (b.kind === 'salon') return `salon:${salonId}`;
  if (b.kind === 'salon_public') return `salon-public:${salonId}`;
  return null;
}

export function sqlQueueDb(transaction: SqlTransaction): QueueDb {
  return {
    transaction: (fn) => transaction((q) => fn(sqlTx(q))),
  };
}

function sqlTx(q: SqlRunner): QueueTx {
  const one = async <T = Row>(text: string, params: readonly unknown[]) =>
    (await q.query<T>(text, params))[0] ?? null;

  const ref = (row: Row | null): TicketRef | null =>
    row
      ? {
          ticket_id: row.id as string,
          salon_id: row.salon_id as string,
          client_id: (row.client_id as string | null) ?? null,
          status: row.status as TicketStatus,
        }
      : null;

  return {
    async lockSalon(salonId) {
      await q.query(
        'select pg_advisory_xact_lock(hashtextextended($1::text, 0))',
        [salonId],
      );
    },

    async findProcessed(commandId) {
      const row = await one<{ response: { status: number; body: unknown } }>(
        'select response from private.processed_commands where command_id = $1',
        [commandId],
      );
      return row ? row.response : null;
    },

    async saveProcessed(commandId, command, salonId, response) {
      await q.query(
        `insert into private.processed_commands (command_id, command, salon_id, response)
         values ($1, $2, $3, $4::text::jsonb)`,
        [commandId, command, salonId, JSON.stringify(response)],
      );
    },

    async memberships(profileId) {
      const rows = await q.query<Row>(
        `select id, salon_id, role from public.salon_members
         where profile_id = $1 and status = 'active' order by created_at, id`,
        [profileId],
      );
      return rows.map((r) => ({
        member_id: r.id as string,
        salon_id: r.salon_id as string,
        role: r.role as MemberRole,
      }));
    },

    async ticketRef(ticketId) {
      return ref(
        await one(
          'select id, salon_id, client_id, status from public.tickets where id = $1',
          [ticketId],
        ),
      );
    },

    async ticketByToken(token) {
      return ref(
        await one(
          `select id, salon_id, client_id, status from public.tickets
           where tracking_token = $1`,
          [token],
        ),
      );
    },

    async activeTicketOfClient(profileId) {
      return ref(
        await one(
          `select id, salon_id, client_id, status from public.tickets
           where client_id = $1 and status in ${ACTIVE} and not is_test limit 1`,
          [profileId],
        ),
      );
    },

    async salonsWithActivePhone(hash, exceptTicketId) {
      const rows = await q.query<Row>(
        `select distinct t.salon_id from private.ticket_contacts c
         join public.tickets t on t.id = c.ticket_id
         where c.phone_hash = decode($1, 'hex') and c.is_active
           and not c.is_pending_confirmation
           and ($2::uuid is null or c.ticket_id <> $2::uuid)`,
        [hex(hash), exceptTicketId],
      );
      return rows.map((r) => r.salon_id as string);
    },

    async contactHash(ticketId) {
      const row = await one<{ h: string }>(
        `select encode(phone_hash, 'hex') as h from private.ticket_contacts
         where ticket_id = $1 and is_active`,
        [ticketId],
      );
      if (!row) return null;
      return new Uint8Array(row.h.match(/../g)!.map((b) => parseInt(b, 16)));
    },

    async profileFirstName(profileId) {
      const row = await one<{ first_name: string }>(
        'select first_name from public.profiles where id = $1',
        [profileId],
      );
      return row?.first_name ?? null;
    },

    async authPhone(profileId) {
      const row = await one<{ phone: string | null }>(
        'select phone from auth.users where id = $1',
        [profileId],
      );
      // Auth keeps the number without the « + ».
      if (!row?.phone) return null;
      return row.phone.startsWith('+') ? row.phone : `+${row.phone}`;
    },

    async loadDay(salonId, serviceDate, weekday) {
      const salon = await one(
        `select s.*, (select count(*) from public.opening_hours o where o.salon_id = s.id)
           as opening_hours_count
         from public.salons s where s.id = $1`,
        [salonId],
      );
      if (!salon) return null;
      const [members, services, tickets, hours, closed] = [
        await q.query<Row>(
          `select m.id, m.role, m.status, m.is_hairdressing, m.served_today_count,
             coalesce(array(select specialty_code from public.member_specialties x
               where x.member_id = m.id order by specialty_code), '{}') as specialties,
             p.status as p_status, p.status_since, p.break_type, p.expected_back_at,
             p.shift_end_at
           from public.salon_members m
           left join public.stylist_presence p
             on p.member_id = m.id and p.service_date = $2::date
           where m.salon_id = $1 order by m.created_at, m.id`,
          [salonId, serviceDate],
        ),
        await q.query<Row>(
          `select id, duration_minutes, required_specialty_code, is_active
           from public.services where salon_id = $1`,
          [salonId],
        ),
        await q.query<Row>(
          `select ${TICKET_SELECT} from public.tickets
           where salon_id = $1 and service_date = $2::date order by queue_rank`,
          [salonId, serviceDate],
        ),
        await q.query<Row>(
          `select opens_at::text as opens_at, closes_at::text as closes_at
           from public.opening_hours where salon_id = $1 and weekday = $2
           order by opens_at`,
          [salonId, weekday],
        ),
        await one<{ closed: boolean }>(
          `select exists (select 1 from public.salon_closures
             where salon_id = $1 and $2::date between starts_on and ends_on) as closed`,
          [salonId, serviceDate],
        ),
      ];
      const salonRow: SalonRow = {
        id: salon.id as string,
        status: salon.status as SalonStatus,
        queue_status: salon.queue_status as QueueStatus,
        settings: {
          reminder_after_minutes: num(salon.reminder_after_minutes),
          auto_release_after_minutes: num(salon.auto_release_after_minutes),
          end_of_day_warning_minutes: num(salon.end_of_day_warning_minutes),
          closing_grace_minutes: num(salon.closing_grace_minutes),
        },
        queue_version: num(salon.queue_version),
        waiting_count: num(salon.waiting_count),
        current_wait_minutes: numOrNull(salon.current_wait_minutes),
        is_full: salon.is_full as boolean,
        estimate_updated_at: ms(salon.estimate_updated_at),
        qr_token: salon.qr_token as string,
        setup_test_passed_at: ms(salon.setup_test_passed_at),
        opening_hours_count: num(salon.opening_hours_count),
        next_free_slots:
          (salon.next_free_slots as SalonRow['next_free_slots']) ?? [],
      };
      const day: DayData = {
        salon: salonRow,
        members: members.map((m): MemberRow => ({
          id: m.id as string,
          role: m.role as MemberRole,
          status: m.status as MemberStatus,
          is_hairdressing: m.is_hairdressing as boolean,
          specialties: m.specialties as string[],
          served_today_count: num(m.served_today_count),
          presence:
            m.p_status === null || m.p_status === undefined
              ? null
              : {
                  status: m.p_status as PresenceStatus,
                  status_since: ms(m.status_since)!,
                  break_type: (m.break_type as BreakType | null) ?? null,
                  expected_back_at: ms(m.expected_back_at),
                  shift_end_at: ms(m.shift_end_at),
                },
        })),
        services: services.map((s) => ({
          id: s.id as string,
          duration_minutes: num(s.duration_minutes),
          required_specialty_code:
            (s.required_specialty_code as string | null) ?? null,
          is_active: s.is_active as boolean,
        })),
        tickets: tickets.map(ticketFromRow),
        opening_hours: hours.map((h) => ({
          opens_at: h.opens_at as string,
          closes_at: h.closes_at as string,
        })),
        closed: closed?.closed === true,
      };
      return day;
    },

    async appointmentsCreatedSince(salonId, since) {
      const row = await one<{ n: unknown }>(
        `select count(*) as n from public.tickets
         where salon_id = $1 and appointment_source = 'salon_entry' and created_at >= $2`,
        [salonId, new Date(since).toISOString()],
      );
      return num(row?.n ?? 0);
    },

    apply: (writes) => applyWrites(q, writes),

    async dueSalonDays(today) {
      const rows = await q.query<Row>(
        `select id as salon_id, $1::text as service_date from public.salons
           where status = 'published'
         union
         select distinct salon_id, service_date::text from public.tickets
           where status in ${ACTIVE}
         order by service_date, salon_id`,
        [today],
      );
      return rows.map((r) => ({
        salon_id: r.salon_id as string,
        service_date: r.service_date as string,
      }));
    },

    async recordNoShows(ticketIds, now) {
      const at = new Date(now).toISOString();
      const warned: string[] = [];
      for (const ticketId of ticketIds) {
        // A ticket without number (appointment entered without phone) counts for no one.
        const record = await one<{ h: string }>(
          `insert into private.no_show_records (phone_hash, ticket_id, occurred_at)
           select phone_hash, ticket_id, $2 from private.ticket_contacts where ticket_id = $1
           on conflict do nothing
           returning encode(phone_hash, 'hex') as h`,
          [ticketId, at],
        );
        if (!record) continue;
        const warning = await one(
          `with recent as (
             select count(*) as n from private.no_show_records
             where phone_hash = decode($1, 'hex')
               and occurred_at > $2::timestamptz - interval '30 days')
           insert into private.no_show_warnings (phone_hash, warned_at)
           select decode($1, 'hex'), $2 from recent where recent.n >= 5
           on conflict (phone_hash) do update set warned_at = excluded.warned_at
             where private.no_show_warnings.warned_at <= excluded.warned_at - interval '30 days'
           returning 1`,
          [record.h, at],
        );
        if (warning) warned.push(ticketId);
      }
      return warned;
    },
  };
}

async function applyWrites(q: SqlRunner, w: WriteSet): Promise<void> {
  if (w.profile) {
    await q.query(
      `insert into public.profiles (id, first_name) values ($1, $2)
       on conflict (id) do nothing`,
      [w.profile.id, w.profile.first_name],
    );
  }
  if (w.profile_consent) {
    await q.query(
      'update public.profiles set tracking_consent_at = $2 where id = $1',
      [w.profile_consent.id, w.profile_consent.tracking_consent_at],
    );
  }

  if (Object.keys(w.salon).length > 0) {
    Object.keys(w.salon).forEach(assertIdentifier);
    const set = assignments(w.salon, 2, new Set(['next_free_slots']));
    await q.query(`update public.salons set ${set.sql} where id = $1`, [
      w.salon_id,
      ...set.params,
    ]);
  }
  for (const m of w.members) {
    Object.keys(m.columns).forEach(assertIdentifier);
    const set = assignments(m.columns, 2);
    await q.query(`update public.salon_members set ${set.sql} where id = $1`, [
      m.id,
      ...set.params,
    ]);
  }
  for (const p of w.presences) {
    await q.query(
      `insert into public.stylist_presence (salon_id, member_id, service_date, status,
         status_since, break_type, expected_back_at, shift_end_at, updated_by_member_id)
       values ($1, $2, $3::date, $4, $5, $6, $7, $8, $9)
       on conflict (member_id, service_date) do update set
         status = excluded.status, status_since = excluded.status_since,
         break_type = excluded.break_type, expected_back_at = excluded.expected_back_at,
         shift_end_at = excluded.shift_end_at,
         updated_by_member_id = excluded.updated_by_member_id`,
      [
        w.salon_id,
        p.member_id,
        w.service_date,
        p.status,
        p.status_since,
        p.break_type,
        p.expected_back_at,
        p.shift_end_at,
        p.updated_by_member_id,
      ],
    );
  }

  for (const t of w.new_tickets) {
    const keys = Object.keys(t.columns).map(assertIdentifier);
    await q.query(
      `insert into public.tickets (${keys.join(', ')})
       values (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      keys.map((k) => t.columns[k]),
    );
  }
  for (const u of w.ticket_updates) {
    Object.keys(u.columns).forEach(assertIdentifier);
    const set = assignments(u.columns, 2);
    await q.query(`update public.tickets set ${set.sql} where id = $1`, [
      u.id,
      ...set.params,
    ]);
  }

  // Contacts: closings first, so that a moved number never counts twice.
  for (const c of w.contact_updates) {
    if (c.close) {
      await q.query(
        `update private.ticket_contacts set is_active = false, closed_at = now()
         where ticket_id = $1 and is_active`,
        [c.ticket_id],
      );
    }
    if (c.is_pending_confirmation !== undefined) {
      await q.query(
        'update private.ticket_contacts set is_pending_confirmation = $2 where ticket_id = $1',
        [c.ticket_id, c.is_pending_confirmation],
      );
    }
  }
  for (const move of w.contact_moves) {
    await q.query(
      `update private.ticket_contacts set is_active = false, closed_at = coalesce(closed_at, now())
       where ticket_id = $1`,
      [move.from_ticket_id],
    );
    await q.query(
      `insert into private.ticket_contacts
         (ticket_id, phone_e164, phone_hash, is_active, is_pending_confirmation)
       select $2, phone_e164, phone_hash, true, false
       from private.ticket_contacts where ticket_id = $1
       on conflict (ticket_id) do update set phone_e164 = excluded.phone_e164,
         phone_hash = excluded.phone_hash, is_active = true,
         is_pending_confirmation = false, closed_at = null`,
      [move.from_ticket_id, move.to_ticket_id],
    );
  }
  for (const c of [
    ...w.contact_replaces.map((r) => ({
      ...r,
      is_pending_confirmation: false,
    })),
    ...w.new_contacts,
  ]) {
    await q.query(
      `insert into private.ticket_contacts
         (ticket_id, phone_e164, phone_hash, is_active, is_pending_confirmation)
       values ($1, $2, decode($3, 'hex'), true, $4)
       on conflict (ticket_id) do update set phone_e164 = excluded.phone_e164,
         phone_hash = excluded.phone_hash, is_active = true,
         is_pending_confirmation = excluded.is_pending_confirmation, closed_at = null`,
      [c.ticket_id, c.phone_e164, hex(c.phone_hash), c.is_pending_confirmation],
    );
  }

  for (const e of w.events) {
    if (e.scope === 'ticket') {
      await q.query(
        `insert into public.ticket_events (ticket_id, salon_id, type, actor_type,
           actor_member_id, actor_profile_id, reason_code, command_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          e.ticket_id,
          w.salon_id,
          e.type,
          e.actor_type,
          e.actor_member_id,
          e.actor_profile_id,
          e.reason_code,
          e.command_id,
        ],
      );
    } else {
      await q.query(
        `insert into public.salon_events (salon_id, type, actor_type, actor_member_id,
           actor_profile_id, subject_member_id, reason_code, command_id)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          w.salon_id,
          e.type,
          e.actor_type,
          e.actor_member_id,
          e.actor_profile_id,
          e.subject_member_id,
          e.reason_code,
          e.command_id,
        ],
      );
    }
  }

  for (const n of w.notifications) {
    await q.query(
      `insert into public.notifications (ticket_id, salon_id, recipient_profile_id,
         recipient_member_id, channel, template, params, dedupe_key, requires_consent)
       values ($1, $2, $3, $4, $5, $6, $7::text::jsonb, $8, $9)
       on conflict do nothing`,
      [
        n.ticket_id,
        w.salon_id,
        n.recipient_profile_id,
        n.recipient_member_id,
        n.channel,
        n.template,
        JSON.stringify(n.params),
        n.dedupe_key,
        n.requires_consent,
      ],
    );
  }

  const seen = new Set<string>();
  for (const b of w.broadcasts) {
    const key = JSON.stringify(b);
    if (seen.has(key)) continue;
    seen.add(key);
    const name = topic(b, w.salon_id);
    if (name !== null) {
      const event = b.kind === 'salon' ? b.event : 'salon_updated';
      await q.query('select realtime.send($1::text::jsonb, $2, $3, true)', [
        JSON.stringify({ version: w.version }),
        event,
        name,
      ]);
    } else if (b.kind === 'ticket') {
      await q.query(
        `select realtime.send($1::text::jsonb, 'ticket_updated', 'ticket:' || id::text, true),
                realtime.send($2::text::jsonb, 'ticket_updated', 'ticket-token:' ||
                  substr(encode(extensions.digest(tracking_token, 'sha256'), 'hex'), 1, 32), true)
         from public.tickets where id = $3`,
        [
          JSON.stringify({ version: w.version, status: b.status }),
          JSON.stringify({ version: w.version }),
          b.ticket_id,
        ],
      );
    }
  }
}

/** `ticket-public`: the ticket of a tracking link, outside any transaction. */
export function sqlTicketLinkReader(q: SqlRunner): TicketLinkReader {
  return {
    async byLinkCode(code) {
      const [row] = await q.query<{
        view: Omit<LinkView, 'tracking_token'>;
        tracking_token: string;
        created_at: unknown;
      }>(
        `select jsonb_build_object(
           'ticket', jsonb_build_object(
             'id', t.id, 'salon_id', t.salon_id, 'service_date', t.service_date,
             'short_code', t.short_code, 'kind', t.kind, 'scheduled_at', t.scheduled_at,
             'display_name', t.display_name, 'status', t.status, 'queue_rank', t.queue_rank,
             'planned_duration_minutes', t.planned_duration_minutes,
             'estimated_start_at', t.estimated_start_at, 'eta_response', t.eta_response,
             'declared_delay_minutes', t.declared_delay_minutes, 'arrived_at', t.arrived_at,
             'called_at', t.called_at, 'started_at', t.started_at,
             'notifications_consent', t.notifications_consent_at is not null),
           'salon', to_jsonb(sv),
           'assigned_stylist_first_name', st.first_name) as view,
           t.tracking_token, t.created_at
         from public.tickets t
         join public.public_salons sv on sv.id = t.salon_id
         left join public.public_stylists st on st.id = t.assigned_member_id
         where t.tracking_short_code = $1 and not t.is_test`,
        [code],
      );
      if (!row) return null;
      return {
        ...row.view,
        tracking_token: row.tracking_token,
        created_at: ms(row.created_at)!,
      };
    },
  };
}
