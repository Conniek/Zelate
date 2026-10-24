/**
 * Integration tests of the SQL adapter against the local database
 * (`supabase start`). Run by the CI database job:
 *   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
 * Each run creates its own salon with fresh ids, so runs never collide.
 */
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readTicketLink } from './link.ts';
import { sqlQueueDb, sqlTicketLinkReader } from './postgres.ts';
import { cryptoRandom, hmacPhoneHasher } from './random.ts';
import {
  deactivateMember,
  handleQueueCommand,
  previewPresenceChange,
  runQueueTick,
  type CommandResponse,
} from './service.ts';

const url = process.env.DATABASE_URL;
if (process.env.CI && !url) {
  throw new Error(
    'DATABASE_URL is required in CI: the integration tests must run',
  );
}
const sql = url ? postgres(url, { max: 6, onnotice: () => {} }) : null;

const deps = () => ({
  db: sqlQueueDb(
    (fn) =>
      sql!.begin((tx) =>
        fn({
          query: (text, params = []) =>
            tx.unsafe(text, params as never[]) as unknown as Promise<never[]>,
        }),
      ) as Promise<never>,
  ),
  clock: () => Date.now(),
  random: cryptoRandom,
  phones: hmacPhoneHasher('integration-test-secret-0123456789'),
});

const id = () => crypto.randomUUID();
const salon = id();
const manager = { user: id(), member: id() };
const anna = { user: id(), member: id() };
const ben = { user: id(), member: id() };
const client = id();
const client2 = id();
const service = id();
// Fictional numbers, random per run so that reruns never collide.
const phone = () =>
  `+3363998${String(Math.floor(Math.random() * 1e4)).padStart(4, '0')}`;

function send(
  profileId: string | null,
  command: string,
  payload: unknown = {},
  options: { commandId?: string; token?: string } = {},
): Promise<CommandResponse> {
  return handleQueueCommand(
    deps(),
    { profileId },
    {
      command,
      command_id: options.commandId ?? id(),
      payload,
      ...(options.token ? { tracking_token: options.token } : {}),
    },
  );
}

function ok(response: CommandResponse): Record<string, unknown> {
  const body = response.body as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: unknown;
  };
  if (!body.ok)
    throw new Error(`expected ok, got ${JSON.stringify(body.error)}`);
  return body.data!;
}

/**
 * An appointment time later today, in Paris: 20 min from now, rounded to 5 min.
 * Null in the last minutes before midnight, when no slot is left today.
 */
function laterToday(): { iso: string; hhmm: string } | null {
  const at = Math.ceil((Date.now() + 20 * 60_000) / 300_000) * 300_000;
  const day = (ms: number) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(
      new Date(ms),
    );
  if (day(at + 60 * 60_000) !== day(Date.now())) return null;
  const hhmm = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
  return { iso: new Date(at).toISOString(), hhmm };
}

function codeOf(response: CommandResponse): string {
  return (response.body as { error: { code: string } }).error.code;
}

/**
 * The test salons open until midnight and a queue is full once a new client
 * would end after the closing (H9): late in the Paris evening the joins are
 * refused by design, so the suite waits for the next day.
 */
function lateParisEvening(): boolean {
  const [hours, minutes] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(new Date())
    .split(':')
    .map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0) >= 22 * 60 + 30;
}

describe.skipIf(!sql || lateParisEvening())('queue-command on Postgres', () => {
  beforeAll(async () => {
    const db = sql!;
    const users = [manager.user, anna.user, ben.user, client, client2];
    for (const user of users) {
      await db`insert into auth.users (id, instance_id, aud, role, phone)
        values (${user}, '00000000-0000-0000-0000-000000000000', 'authenticated',
                'authenticated', ${phone().slice(1)})`;
    }
    await db`insert into public.profiles (id, first_name, is_guest) values
      (${manager.user}, 'Camille', false), (${anna.user}, 'Anna', false),
      (${ben.user}, 'Ben', false), (${client}, 'Léa', true)`;
    await db`insert into public.salons (id, slug, name, phone, address_line, postal_code,
        city, location, siret, status, queue_status, created_by)
      values (${salon}, ${'it-' + salon.slice(0, 8)}, 'Salon test', '+33639980099',
        '1 rue du Test', '95880', 'Enghien-les-Bains', 'SRID=4326;POINT(2.30 48.97)',
        '73282932000074', 'published', 'open', ${manager.user})`;
    await db`insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
      select ${salon}, d, '00:00', '24:00' from generate_series(1, 7) d`;
    await db`insert into public.salon_members (id, salon_id, profile_id, role, status,
        first_name, last_name, email, is_hairdressing) values
      (${manager.member}, ${salon}, ${manager.user}, 'manager', 'active', 'Camille', 'D', ${'m-' + salon + '@test.zelate.test'}, false),
      (${anna.member}, ${salon}, ${anna.user}, 'stylist', 'active', 'Anna', 'A', ${'a-' + salon + '@test.zelate.test'}, true),
      (${ben.member}, ${salon}, ${ben.user}, 'stylist', 'active', 'Ben', 'B', ${'b-' + salon + '@test.zelate.test'}, true)`;
    await db`insert into public.services (id, salon_id, name, duration_minutes, price_cents)
      values (${service}, ${salon}, 'Coupe', 30, 2500)`;
    for (const member of [anna.member, ben.member]) {
      ok(
        await send(
          member === anna.member ? anna.user : ben.user,
          'set_presence',
          {
            member_id: member,
            status: 'available',
          },
        ),
      );
    }
  });

  afterAll(async () => {
    await sql?.end();
  });

  it('join_queue writes the ticket, its private contact, the outbox, the log and realtime', async () => {
    const { ticket_id } = ok(
      await send(client, 'join_queue', {
        salon_id: salon,
        service_id: service,
        channel: 'app',
        notifications_consent: true,
      }),
    );
    const db = sql!;
    const [ticket] =
      await db`select status, display_name, client_id, estimated_start_at,
      length(tracking_token) as token_length from public.tickets where id = ${ticket_id as string}`;
    expect(ticket).toMatchObject({
      status: 'waiting',
      display_name: 'Léa',
      client_id: client,
    });
    expect(ticket!.estimated_start_at).not.toBeNull();
    expect(Number(ticket!.token_length)).toBe(43);

    const [contact] =
      await db`select is_active, length(phone_hash) as hash_length
      from private.ticket_contacts where ticket_id = ${ticket_id as string}`;
    expect(contact).toMatchObject({ is_active: true });
    expect(Number(contact!.hash_length)).toBe(32);

    const outbox = await db`select channel, template, requires_consent
      from public.notifications where ticket_id = ${ticket_id as string} order by channel`;
    expect(outbox.map((n) => n.channel)).toEqual(['push', 'sms']);

    const [types] = await db`select
        (select bool_and(jsonb_typeof(params) = 'object') from public.notifications
          where ticket_id = ${ticket_id as string}) as params_are_objects,
        (select jsonb_typeof(next_free_slots) from public.salons where id = ${salon}) as slots_type,
        (select bool_and(jsonb_typeof(response) = 'object') from private.processed_commands
          where salon_id = ${salon}) as responses_are_objects`;
    expect(types).toEqual({
      params_are_objects: true,
      slots_type: 'array',
      responses_are_objects: true,
    });

    const events = await db`select type, command_id from public.ticket_events
      where ticket_id = ${ticket_id as string}`;
    expect(events[0]).toMatchObject({ type: 'created' });
    expect(events[0]!.command_id).not.toBeNull();

    const [s] =
      await db`select queue_version, waiting_count, jsonb_array_length(next_free_slots) as slots
      from public.salons where id = ${salon}`;
    expect(Number(s!.waiting_count)).toBe(1);
    expect(Number(s!.slots)).toBeGreaterThan(0);

    const topics = await db`select topic, event, payload from realtime.messages
      where topic in (${'salon:' + salon}, ${'salon-public:' + salon}, ${'ticket:' + ticket_id})
        and inserted_at > now() - interval '1 minute'`;
    expect(topics.map((m) => m.topic)).toEqual(
      expect.arrayContaining([
        `salon:${salon}`,
        `salon-public:${salon}`,
        `ticket:${ticket_id}`,
      ]),
    );
    const tokenTopics = await db`select count(*) as n from realtime.messages
      where topic like 'ticket-token:%' and inserted_at > now() - interval '1 minute'`;
    expect(Number(tokenTopics[0]!.n)).toBeGreaterThan(0);
  });

  it('two stylists calling at once: one call, one no_eligible_ticket (TRD §14)', async () => {
    const [a, b] = await Promise.all([
      send(anna.user, 'call_ticket'),
      send(ben.user, 'call_ticket'),
    ]);
    const outcomes = [a, b]
      .map((r) => (r.status === 200 ? 'ok' : codeOf(r)))
      .sort();
    expect(outcomes).toEqual(['no_eligible_ticket', 'ok']);
    const [called] = await sql!`select count(*) as n from public.tickets
      where salon_id = ${salon} and status = 'called'`;
    expect(Number(called!.n)).toBe(1);
  });

  it('replaying the same command_id at once returns one response and writes once', async () => {
    const commandId = id();
    const payload = { first_name: 'Sam', phone: phone() };
    const [x, y] = await Promise.all([
      send(manager.user, 'register_walk_in', payload, { commandId }),
      send(manager.user, 'register_walk_in', payload, { commandId }),
    ]);
    expect(y).toEqual(x);
    const { ticket_id } = ok(x);
    const [count] =
      await sql!`select count(*) as n from public.tickets where id = ${ticket_id as string}`;
    expect(Number(count!.n)).toBe(1);
    const [stored] =
      await sql!`select command from private.processed_commands where command_id = ${commandId}`;
    expect(stored).toMatchObject({ command: 'register_walk_in' });

    // The walk-in cancels with the token of his SMS link (ADR-006).
    const [row] =
      await sql!`select tracking_token from public.tickets where id = ${ticket_id as string}`;
    ok(
      await send(
        null,
        'cancel_ticket',
        { ticket_id },
        { token: row!.tracking_token as string },
      ),
    );
    const [contact] =
      await sql!`select is_active, closed_at from private.ticket_contacts
      where ticket_id = ${ticket_id as string}`;
    expect(contact!.is_active).toBe(false);
    expect(contact!.closed_at).not.toBeNull();
  });

  it('take_next frees the stylist before calling the next client (unique index order)', async () => {
    // Anna has called Léa; Léa had said she would be late.
    const [called] =
      await sql!`select id from public.tickets where salon_id = ${salon} and status = 'called'`;
    const calledId = called!.id as string;
    await sql!`update public.tickets set status = 'waiting', called_at = null,
      release_due_at = null, reminder_sent_at = null, assigned_member_id = null,
      eta_response = 'late', declared_delay_minutes = 15 where id = ${calledId}`;
    ok(
      await send(manager.user, 'register_walk_in', {
        first_name: 'Tom',
        phone: phone(),
      }),
    );
    const first = ok(await send(anna.user, 'call_ticket'));
    expect(first.ticket_id).toBe(calledId);
    ok(await send(anna.user, 'take_next', { ticket_id: calledId }));
    const rows =
      await sql!`select id, status, postpone_count from public.tickets
      where salon_id = ${salon} and status in ('called', 'waiting') order by queue_rank`;
    expect(rows.find((r) => r.id === calledId)).toMatchObject({
      status: 'waiting',
      postpone_count: 1,
    });
    expect(rows.filter((r) => r.status === 'called')).toHaveLength(1);
  });

  it('merges a QR check-in into the appointment the salon entered (K14)', async () => {
    const slot = laterToday();
    // Too close to midnight for an appointment today: nothing to test.
    if (!slot) return;
    const [qr] =
      await sql!`select qr_token from public.salons where id = ${salon}`;
    const [auth] =
      await sql!`select phone from auth.users where id = ${client2}`;
    const entered = ok(
      await send(manager.user, 'create_appointment', {
        first_name: 'Inès',
        scheduled_at: slot.iso,
        member_id: ben.member,
        phone: `+${auth!.phone as string}`,
      }),
    );
    const scheduled = slot.hhmm;
    const signalled = ok(
      await send(client2, 'check_in_appointment', {
        salon_id: salon,
        qr_token: qr!.qr_token,
        scheduled_time: scheduled,
        member_id: ben.member,
        first_name: 'Inès',
      }),
    );
    expect(
      codeOf(
        await send(manager.user, 'confirm_appointment', {
          ticket_id: signalled.ticket_id,
          decision: 'confirm',
        }),
      ),
    ).toBe('appointment_overlap');
    ok(
      await send(manager.user, 'confirm_appointment', {
        ticket_id: signalled.ticket_id,
        decision: 'confirm',
        merge_into_ticket_id: entered.ticket_id,
      }),
    );
    const contacts =
      await sql!`select ticket_id, is_active from private.ticket_contacts
      where ticket_id in (${entered.ticket_id as string}, ${signalled.ticket_id as string})`;
    expect(
      contacts.find((c) => c.ticket_id === entered.ticket_id)?.is_active,
    ).toBe(true);
    expect(
      contacts.find((c) => c.ticket_id === signalled.ticket_id)?.is_active,
    ).toBe(false);
    const [survivor] = await sql!`select client_id, status from public.tickets
      where id = ${entered.ticket_id as string}`;
    expect(survivor).toMatchObject({ client_id: client2, status: 'waiting' });
    const pushes =
      await sql!`select recipient_member_id from public.notifications
      where ticket_id = ${signalled.ticket_id as string} and template = 'appointment_checked_in'`;
    expect(pushes.map((p) => p.recipient_member_id).sort()).toEqual(
      [ben.member, manager.member].sort(),
    );
  });

  it('publish_salon lists what is missing (K35)', async () => {
    await sql!`update public.salons set status = 'approved', setup_test_passed_at = null
      where id = ${salon}`;
    const response = await send(manager.user, 'publish_salon', {
      salon_id: salon,
    });
    expect(response.body).toMatchObject({
      ok: false,
      error: { code: 'salon_not_ready', details: { missing: ['setup_test'] } },
    });
    await sql!`update public.salons set setup_test_passed_at = now() where id = ${salon}`;
    ok(await send(manager.user, 'publish_salon', { salon_id: salon }));
    const [event] = await sql!`select type from public.salon_events
      where salon_id = ${salon} and type = 'published'`;
    expect(event).toBeDefined();
  });

  it('queue-tick releases a called client at release_due_at and records the absence', async () => {
    const [called] = await sql!`select id from public.tickets
      where salon_id = ${salon} and status = 'called' limit 1`;
    const calledId = called!.id as string;
    await sql!`update public.tickets set called_at = now() - interval '11 minutes',
      release_due_at = now() - interval '1 minute', declared_arrival_at = null
      where id = ${calledId}`;
    const report = await runQueueTick(deps());
    expect(report.salons).toBeGreaterThan(0);
    const [ticket] =
      await sql!`select status, called_at from public.tickets where id = ${calledId}`;
    expect(ticket).toMatchObject({ status: 'no_show', called_at: null });
    const [record] =
      await sql!`select count(*) as n from private.no_show_records
      where ticket_id = ${calledId}`;
    expect(Number(record!.n)).toBe(1);
    // A second pass in the same minute has nothing more to do for this salon.
    const [v1] =
      await sql!`select queue_version from public.salons where id = ${salon}`;
    await runQueueTick(deps());
    const [v2] =
      await sql!`select queue_version from public.salons where id = ${salon}`;
    expect(v2!.queue_version).toBe(v1!.queue_version);
  });

  it('ticket-public exchanges the SMS link for the view and the token', async () => {
    const [row] =
      await sql!`select tracking_short_code, tracking_token from public.tickets
      where salon_id = ${salon} and status = 'waiting' and not is_test limit 1`;
    const reader = sqlTicketLinkReader({
      query: (text, params = []) =>
        sql!.unsafe(text, params as never[]) as unknown as Promise<never[]>,
    });
    const response = await readTicketLink(
      reader,
      row!.tracking_short_code as string,
      Date.now(),
    );
    expect(response.status).toBe(200);
    const view = (response.body as { data: Record<string, unknown> }).data;
    expect(view.tracking_token).toBe(row!.tracking_token);
    expect(view.salon).toMatchObject({ id: salon });
    // The salon's public number is there; the client's number never is (H6).
    const [contact] =
      await sql!`select c.phone_e164 from private.ticket_contacts c
      join public.tickets t on t.id = c.ticket_id
      where t.tracking_short_code = ${row!.tracking_short_code as string}`;
    if (contact)
      expect(JSON.stringify(view)).not.toContain(contact.phone_e164 as string);
    expect((await readTicketLink(reader, 'Nope0000', Date.now())).status).toBe(
      410,
    );
  });

  it('preview_presence_change answers without writing', async () => {
    const [v1] =
      await sql!`select queue_version from public.salons where id = ${salon}`;
    const response = await previewPresenceChange(
      deps(),
      { profileId: manager.user },
      { member_id: ben.member, status: 'absent' },
    );
    expect(response.status).toBe(200);
    const [v2] =
      await sql!`select queue_version from public.salons where id = ${salon}`;
    expect(v2!.queue_version).toBe(v1!.queue_version);
    const [presence] = await sql!`select status from public.stylist_presence
      where member_id = ${ben.member}`;
    expect(presence!.status).toBe('available');
  });

  it('reassign_ticket logs the new stylist in after, never in reason_code (S-13)', async () => {
    const ticket_id = ok(
      await send(manager.user, 'register_walk_in', {
        first_name: 'Rita',
        phone: `0${phone().slice(3)}`,
        service_id: service,
        requested_member_id: anna.member,
      }),
    ).ticket_id as string;
    const moved = await send(manager.user, 'reassign_ticket', {
      ticket_id,
      member_id: ben.member,
    });
    expect(moved.status).toBe(200);
    const [event] =
      await sql!`select type, reason_code, after from public.ticket_events
      where ticket_id = ${ticket_id}
        and type in ('reassigned', 'reassignment_requested')`;
    expect(event!.reason_code).toBeNull();
    expect((event!.after as { member_id: string }).member_id).toBe(ben.member);
  });

  it('deactivate-member deletes the Auth sessions and logs the departure (S-16)', async () => {
    const session = id();
    await sql!`insert into auth.sessions (id, user_id) values (${session}, ${ben.user})`;
    const response = await deactivateMember(
      deps(),
      { profileId: manager.user },
      {
        member_id: ben.member,
      },
    );
    expect(response.status).toBe(200);
    const [member] =
      await sql!`select status from public.salon_members where id = ${ben.member}`;
    expect(member!.status).toBe('deactivated');
    const [sessions] =
      await sql!`select count(*) as n from auth.sessions where user_id = ${ben.user}`;
    expect(Number(sessions!.n)).toBe(0);
    const [event] = await sql!`select actor_member_id from public.salon_events
      where salon_id = ${salon} and type = 'member_deactivated' and subject_member_id = ${ben.member}`;
    expect(event!.actor_member_id).toBe(manager.member);
  });

  it('a place left from an earlier day ends before the client joins again (S-15)', async () => {
    const lena = id();
    const stale = id();
    await sql!`insert into auth.users (id, instance_id, aud, role, phone)
      values (${lena}, '00000000-0000-0000-0000-000000000000', 'authenticated',
              'authenticated', ${phone().slice(1)})`;
    await sql!`insert into public.profiles (id, first_name) values (${lena}, 'Léna')`;
    await sql!`insert into public.tickets (id, salon_id, service_date, short_code, tracking_token,
        tracking_short_code, display_name, channel, planned_duration_minutes, queue_rank,
        client_id, status)
      values (${stale}, ${salon}, (now() at time zone 'Europe/Paris')::date - 1, 'ZZ9ZZ',
        ${'tok-' + stale}, ${stale.slice(0, 8)}, 'Léna', 'app', 30, 1, ${lena}, 'waiting')`;
    // Yesterday's figures on the salon (the nightly job did not run yet).
    await sql!`update public.salons set estimate_updated_at = now() - interval '2 days',
      current_wait_minutes = 60 where id = ${salon}`;

    ok(
      await send(lena, 'join_queue', {
        salon_id: salon,
        service_id: service,
        channel: 'app',
      }),
    );
    const [old] =
      await sql!`select status, cancel_reason from public.tickets where id = ${stale}`;
    expect(old).toEqual({ status: 'cancelled', cancel_reason: 'end_of_day' });

    // The hourly job covers every salon and never writes a null slot list.
    await sql!`select private.close_past_days()`;
    const [row] =
      await sql!`select next_free_slots from public.salons where id = ${salon}`;
    expect(Array.isArray(row!.next_free_slots)).toBe(true);
  });
});
