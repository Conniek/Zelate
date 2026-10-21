/**
 * In-memory database for the service tests. Rows are kept as columns, the way
 * `postgres.ts` writes them, and read back into engine state, so the mapping
 * is exercised both ways. `lockSalon` serialises transactions per salon like
 * `pg_advisory_xact_lock`; a transaction that throws leaves no write behind.
 */
import {
  DEFAULT_SALON_SETTINGS,
  isActiveStatus,
  type Instant,
  type PresenceState,
  type ServiceState,
  type TicketState,
} from '../../queue-engine/src/index.ts';
import { TICKET_INSTANT_FIELDS } from './mapping.ts';
import type {
  Broadcast,
  DayData,
  DbValue,
  EventRow,
  MemberRef,
  MemberRow,
  NotificationRow,
  QueueDb,
  QueueTx,
  SalonRow,
  StoredResponse,
  TicketRef,
  WriteSet,
} from './ports.ts';
import type { PhoneHasher, Random } from './random.ts';
import type { OpeningHourRow } from './time.ts';

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export interface FakeMember extends Mutable<MemberRow> {
  salon_id: string;
  profile_id: string | null;
  first_name: string;
}

export interface FakeTicket {
  salon_id: string;
  columns: Record<string, DbValue>;
}

export interface FakeContact {
  ticket_id: string;
  phone_e164: string;
  phone_hash: string;
  is_active: boolean;
  is_pending_confirmation: boolean;
  closed_at: string | null;
}

export interface FakeSalon extends Mutable<SalonRow> {
  published_at: string | null;
}

const INSTANTS: ReadonlySet<string> = new Set(TICKET_INSTANT_FIELDS);

export function ticketFromColumns(
  columns: Record<string, DbValue>,
): TicketState {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(columns)) {
    if (
      [
        'salon_id',
        'display_name',
        'tracking_token',
        'tracking_short_code',
        'removal_note',
      ].includes(key)
    ) {
      continue;
    }
    out[key] =
      INSTANTS.has(key) && typeof value === 'string'
        ? Date.parse(value)
        : value;
  }
  return out as unknown as TicketState;
}

const hex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

const ms = (iso: string | null) => (iso === null ? null : Date.parse(iso));

export class FakeDb implements QueueDb {
  salons = new Map<string, FakeSalon>();
  members: FakeMember[] = [];
  services: (Mutable<ServiceState> & { salon_id: string })[] = [];
  /** Opening hours by salon and ISO weekday. */
  hours = new Map<string, Map<number, OpeningHourRow[]>>();
  closures = new Map<string, Set<string>>();
  presences = new Map<string, PresenceState & { updated_by: string | null }>();
  tickets = new Map<string, FakeTicket>();
  contacts = new Map<string, FakeContact>();
  profiles = new Map<
    string,
    { first_name: string; tracking_consent_at: string | null }
  >();
  authPhones = new Map<string, string>();
  processed = new Map<string, StoredResponse & { command: string }>();
  events: EventRow[] = [];
  notifications: NotificationRow[] = [];
  broadcasts: (Broadcast & { version: number })[] = [];
  noShowRecords: { hash: string; ticket_id: string; at: Instant }[] = [];
  noShowWarnings = new Map<string, Instant>();
  /** Throw inside `apply`, to test that nothing is written. */
  failNextApply = false;

  private locks = new Map<string, Promise<void>>();

  async transaction<T>(fn: (tx: QueueTx) => Promise<T>): Promise<T> {
    const releases: (() => void)[] = [];
    const snapshot = structuredClone({
      salons: this.salons,
      tickets: this.tickets,
      contacts: this.contacts,
      profiles: this.profiles,
      members: this.members,
      presences: this.presences,
      processed: this.processed,
      events: this.events,
      notifications: this.notifications,
      broadcasts: this.broadcasts,
    });
    try {
      return await fn(this.tx(releases));
    } catch (error) {
      Object.assign(this, snapshot);
      throw error;
    } finally {
      for (const release of releases) release();
    }
  }

  private tx(releases: (() => void)[]): QueueTx {
    return {
      lockSalon: async (salonId) => {
        const previous = this.locks.get(salonId) ?? Promise.resolve();
        let release!: () => void;
        const mine = new Promise<void>((resolve) => (release = resolve));
        this.locks.set(
          salonId,
          previous.then(() => mine),
        );
        releases.push(release);
        await previous;
      },
      findProcessed: async (id) => {
        const row = this.processed.get(id);
        return row
          ? { status: row.status, body: structuredClone(row.body) }
          : null;
      },
      saveProcessed: async (id, command, _salonId, response) => {
        this.processed.set(id, { command, ...structuredClone(response) });
      },
      memberships: async (profileId) =>
        this.members
          .filter((m) => m.profile_id === profileId && m.status === 'active')
          .map((m): MemberRef => ({
            member_id: m.id,
            salon_id: m.salon_id,
            role: m.role,
          })),
      ticketRef: async (id) => this.ref(id),
      ticketByToken: async (token) => {
        for (const [id, t] of this.tickets) {
          if (t.columns.tracking_token === token) return this.ref(id);
        }
        return null;
      },
      activeTicketOfClient: async (profileId) => {
        for (const [id, t] of this.tickets) {
          if (
            t.columns.client_id === profileId &&
            !t.columns.is_test &&
            isActiveStatus(t.columns.status as TicketState['status'])
          ) {
            return this.ref(id);
          }
        }
        return null;
      },
      salonsWithActivePhone: async (hash, except) => {
        const key = hex(hash);
        const out = new Set<string>();
        for (const c of this.contacts.values()) {
          if (
            c.phone_hash === key &&
            c.is_active &&
            !c.is_pending_confirmation &&
            c.ticket_id !== except
          ) {
            out.add(this.tickets.get(c.ticket_id)!.salon_id);
          }
        }
        return [...out];
      },
      contactHash: async (ticketId) => {
        const c = this.contacts.get(ticketId);
        if (!c || !c.is_active) return null;
        return new Uint8Array(
          c.phone_hash.match(/../g)!.map((h) => parseInt(h, 16)),
        );
      },
      profileFirstName: async (id) => this.profiles.get(id)?.first_name ?? null,
      authPhone: async (id) => this.authPhones.get(id) ?? null,
      loadDay: async (salonId, date, weekday) =>
        this.loadDay(salonId, date, weekday),
      appointmentsCreatedSince: async (salonId, since) =>
        [...this.tickets.values()].filter(
          (t) =>
            t.salon_id === salonId &&
            t.columns.appointment_source === 'salon_entry' &&
            Date.parse(t.columns.created_at as string) >= since,
        ).length,
      apply: async (writes) => this.apply(writes),
      dueSalonDays: async (today) => {
        const out = new Map<
          string,
          { salon_id: string; service_date: string }
        >();
        for (const [id, salon] of this.salons) {
          if (salon.status === 'published') {
            out.set(`${today}:${id}`, { salon_id: id, service_date: today });
          }
        }
        for (const t of this.tickets.values()) {
          const date = t.columns.service_date as string;
          if (isActiveStatus(t.columns.status as TicketState['status'])) {
            out.set(`${date}:${t.salon_id}`, {
              salon_id: t.salon_id,
              service_date: date,
            });
          }
        }
        return [...out.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([, v]) => v);
      },
      recordNoShows: async (ids, now) => {
        const warned: string[] = [];
        for (const id of ids) {
          const contact = this.contacts.get(id);
          if (!contact) continue;
          this.noShowRecords.push({
            hash: contact.phone_hash,
            ticket_id: id,
            at: now,
          });
          const recent = this.noShowRecords.filter(
            (r) =>
              r.hash === contact.phone_hash && r.at > now - 30 * 86_400_000,
          ).length;
          const last = this.noShowWarnings.get(contact.phone_hash);
          if (
            recent >= 5 &&
            (last === undefined || last <= now - 30 * 86_400_000)
          ) {
            this.noShowWarnings.set(contact.phone_hash, now);
            warned.push(id);
          }
        }
        return warned;
      },
    };
  }

  private ref(id: string): TicketRef | null {
    const t = this.tickets.get(id);
    if (!t) return null;
    return {
      ticket_id: id,
      salon_id: t.salon_id,
      client_id: (t.columns.client_id as string | null) ?? null,
      status: t.columns.status as TicketState['status'],
    };
  }

  private loadDay(
    salonId: string,
    date: string,
    weekday: number,
  ): DayData | null {
    const salon = this.salons.get(salonId);
    if (!salon) return null;
    const members = this.members
      .filter((m) => m.salon_id === salonId)
      .map((m): MemberRow => {
        const p = this.presences.get(`${m.id}:${date}`);
        return {
          id: m.id,
          role: m.role,
          status: m.status,
          is_hairdressing: m.is_hairdressing,
          specialties: m.specialties,
          served_today_count: m.served_today_count,
          presence: p
            ? {
                status: p.status,
                status_since: p.status_since,
                break_type: p.break_type,
                expected_back_at: p.expected_back_at,
                shift_end_at: p.shift_end_at,
              }
            : null,
        };
      });
    return {
      salon: structuredClone(salon),
      members,
      services: this.services
        .filter((s) => s.salon_id === salonId)
        .map((s) => ({
          id: s.id,
          duration_minutes: s.duration_minutes,
          required_specialty_code: s.required_specialty_code,
          is_active: s.is_active,
        })),
      tickets: [...this.tickets.values()]
        .filter(
          (t) => t.salon_id === salonId && t.columns.service_date === date,
        )
        .map((t) => ticketFromColumns(t.columns)),
      opening_hours: this.hours.get(salonId)?.get(weekday) ?? [],
      closed: this.closures.get(salonId)?.has(date) ?? false,
    };
  }

  private apply(w: WriteSet): void {
    if (this.failNextApply) {
      this.failNextApply = false;
      throw new Error('simulated database failure');
    }
    if (w.profile) {
      this.profiles.set(w.profile.id, {
        first_name: w.profile.first_name,
        tracking_consent_at: null,
      });
    }
    if (w.profile_consent) {
      const p = this.profiles.get(w.profile_consent.id);
      if (p) p.tracking_consent_at = w.profile_consent.tracking_consent_at;
    }
    const salon = this.salons.get(w.salon_id)!;
    for (const [key, value] of Object.entries(w.salon)) {
      const instantKeys = ['estimate_updated_at', 'setup_test_passed_at'];
      (salon as unknown as Record<string, unknown>)[key] = instantKeys.includes(
        key,
      )
        ? ms(value as string | null)
        : key === 'next_free_slots'
          ? JSON.parse(value as string)
          : value;
    }
    for (const m of w.members) {
      const member = this.members.find((x) => x.id === m.id)!;
      Object.assign(member, m.columns);
    }
    for (const p of w.presences) {
      this.presences.set(`${p.member_id}:${w.service_date}`, {
        status: p.status as PresenceState['status'],
        status_since: Date.parse(p.status_since),
        break_type: p.break_type as PresenceState['break_type'],
        expected_back_at: ms(p.expected_back_at),
        shift_end_at: ms(p.shift_end_at),
        updated_by: p.updated_by_member_id,
      });
    }
    for (const t of w.new_tickets) {
      const id = t.columns.id as string;
      if (this.tickets.has(id)) throw new Error('duplicate ticket');
      this.tickets.set(id, { salon_id: w.salon_id, columns: { ...t.columns } });
    }
    for (const u of w.ticket_updates) {
      const t = this.tickets.get(u.id);
      if (!t) throw new Error(`unknown ticket ${u.id}`);
      Object.assign(t.columns, u.columns);
    }
    this.checkUniqueIndexes();
    for (const c of w.contact_updates) {
      const contact = this.contacts.get(c.ticket_id);
      if (!contact) continue;
      if (c.close) {
        contact.is_active = false;
        contact.closed_at = new Date(0).toISOString();
      }
      if (c.is_pending_confirmation !== undefined) {
        contact.is_pending_confirmation = c.is_pending_confirmation;
      }
    }
    for (const move of w.contact_moves) {
      const from = this.contacts.get(move.from_ticket_id)!;
      this.contacts.set(move.to_ticket_id, {
        ...from,
        ticket_id: move.to_ticket_id,
        is_active: true,
        is_pending_confirmation: false,
        closed_at: null,
      });
      from.is_active = false;
      from.closed_at = new Date(0).toISOString();
    }
    for (const r of w.contact_replaces) {
      this.contacts.set(r.ticket_id, {
        ticket_id: r.ticket_id,
        phone_e164: r.phone_e164,
        phone_hash: hex(r.phone_hash),
        is_active: true,
        is_pending_confirmation: false,
        closed_at: null,
      });
    }
    for (const c of w.new_contacts) {
      this.contacts.set(c.ticket_id, {
        ticket_id: c.ticket_id,
        phone_e164: c.phone_e164,
        phone_hash: hex(c.phone_hash),
        is_active: true,
        is_pending_confirmation: c.is_pending_confirmation,
        closed_at: null,
      });
    }
    this.checkPhoneIndex();
    this.events.push(...w.events);
    for (const n of w.notifications) {
      const duplicate = this.notifications.some(
        (x) =>
          x.ticket_id === n.ticket_id &&
          x.channel === n.channel &&
          x.dedupe_key === n.dedupe_key,
      );
      if (duplicate) continue; // `on conflict do nothing`
      this.notifications.push(n);
    }
    this.broadcasts.push(
      ...w.broadcasts.map((b) => ({ ...b, version: w.version })),
    );
  }

  /** The two partial unique indexes on tickets (BACKEND_SCHEMA §4.13). */
  private checkUniqueIndexes(): void {
    const clients = new Set<string>();
    const busy = new Set<string>();
    for (const t of this.tickets.values()) {
      const c = t.columns;
      const status = c.status as TicketState['status'];
      if (c.client_id && !c.is_test && isActiveStatus(status)) {
        if (clients.has(c.client_id as string)) {
          throw new Error('tickets_one_active_per_client');
        }
        clients.add(c.client_id as string);
      }
      if (
        (status === 'called' || status === 'in_service') &&
        c.assigned_member_id
      ) {
        if (busy.has(c.assigned_member_id as string)) {
          throw new Error('tickets_one_busy_per_stylist');
        }
        busy.add(c.assigned_member_id as string);
      }
    }
  }

  private checkPhoneIndex(): void {
    const seen = new Set<string>();
    for (const c of this.contacts.values()) {
      if (!c.is_active || c.is_pending_confirmation) continue;
      if (seen.has(c.phone_hash))
        throw new Error('ticket_contacts_one_active_per_phone');
      seen.add(c.phone_hash);
    }
  }

  // -------------------------------------------------------------------------
  // Fixtures
  // -------------------------------------------------------------------------

  ticket(id: string): TicketState & { display_name: string } {
    const t = this.tickets.get(id)!;
    return {
      ...ticketFromColumns(t.columns),
      display_name: t.columns.display_name as string,
    };
  }

  rawTicket(id: string): Record<string, DbValue> {
    return this.tickets.get(id)!.columns;
  }
}

// ---------------------------------------------------------------------------
// Deterministic randomness and hashing
// ---------------------------------------------------------------------------

export function sequenceRandom(): Random & { reset(): void } {
  let n = 0;
  const next = () => ++n;
  return {
    reset: () => {
      n = 0;
    },
    uuid: () => {
      const i = next().toString(16).padStart(12, '0');
      return `00000000-0000-4000-8000-${i}`;
    },
    shortCode: () => {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let v = next();
      let out = '';
      for (let i = 0; i < 5; i += 1) {
        out += alphabet[v % alphabet.length];
        v = Math.floor(v / alphabet.length);
      }
      return out;
    },
    trackingToken: () => `token-${next().toString().padStart(30, '0')}`,
    trackingShortCode: () => `L${next().toString().padStart(7, '0')}`,
  };
}

export const fakePhones: PhoneHasher = {
  async hash(e164) {
    return new TextEncoder().encode(`h:${e164}`);
  },
};

// ---------------------------------------------------------------------------
// A ready salon: Monday 2026-10-19, open 09:00-19:00 Paris, one manager who
// also cuts hair, two stylists, two services.
// ---------------------------------------------------------------------------

export const SALON = '10000000-0000-4000-8000-000000000001';
export const OTHER_SALON = '10000000-0000-4000-8000-000000000002';
export const MANAGER = '20000000-0000-4000-8000-000000000001';
export const ANNA = '20000000-0000-4000-8000-000000000002';
export const BEN = '20000000-0000-4000-8000-000000000003';
export const OTHER_MANAGER = '20000000-0000-4000-8000-000000000009';
export const MANAGER_PROFILE = '30000000-0000-4000-8000-000000000001';
export const ANNA_PROFILE = '30000000-0000-4000-8000-000000000002';
export const BEN_PROFILE = '30000000-0000-4000-8000-000000000003';
export const OTHER_PROFILE = '30000000-0000-4000-8000-000000000009';
export const CLIENT = '40000000-0000-4000-8000-000000000001';
export const CLIENT_2 = '40000000-0000-4000-8000-000000000002';
export const CUT = '50000000-0000-4000-8000-000000000001';
export const COLOR = '50000000-0000-4000-8000-000000000002';
export const QR = 'qr-token-of-the-salon';

/** 10:00 Paris on Monday 19 October 2026 (UTC+2). */
export const MONDAY_10H: Instant = Date.UTC(2026, 9, 19, 8, 0);
export const DATE = '2026-10-19';

export function salonRow(
  id: string,
  overrides: Partial<FakeSalon> = {},
): FakeSalon {
  return {
    id,
    status: 'published',
    queue_status: 'open',
    settings: DEFAULT_SALON_SETTINGS,
    queue_version: 0,
    waiting_count: 0,
    current_wait_minutes: null,
    is_full: false,
    estimate_updated_at: null,
    qr_token: QR,
    setup_test_passed_at: null,
    opening_hours_count: 7,
    published_at: null,
    next_free_slots: [],
    ...overrides,
  };
}

function member(
  id: string,
  salon_id: string,
  profile_id: string,
  role: 'manager' | 'stylist',
): FakeMember {
  return {
    id,
    salon_id,
    profile_id,
    role,
    status: 'active',
    is_hairdressing: true,
    specialties: ['cut', 'color'],
    served_today_count: 0,
    presence: null,
    first_name: id.slice(-1),
  };
}

export function seedSalon(db: FakeDb): void {
  db.salons.set(SALON, salonRow(SALON));
  db.salons.set(OTHER_SALON, salonRow(OTHER_SALON, { qr_token: 'other-qr' }));
  db.members.push(
    member(MANAGER, SALON, MANAGER_PROFILE, 'manager'),
    member(ANNA, SALON, ANNA_PROFILE, 'stylist'),
    member(BEN, SALON, BEN_PROFILE, 'stylist'),
    member(OTHER_MANAGER, OTHER_SALON, OTHER_PROFILE, 'manager'),
  );
  db.services.push(
    {
      id: CUT,
      salon_id: SALON,
      duration_minutes: 30,
      required_specialty_code: 'cut',
      is_active: true,
    },
    {
      id: COLOR,
      salon_id: SALON,
      duration_minutes: 60,
      required_specialty_code: 'color',
      is_active: true,
    },
  );
  for (const salon of [SALON, OTHER_SALON]) {
    const week = new Map<number, OpeningHourRow[]>();
    for (let d = 1; d <= 7; d += 1) {
      week.set(d, [{ opens_at: '09:00:00', closes_at: '19:00:00' }]);
    }
    db.hours.set(salon, week);
  }
  for (const id of [MANAGER, ANNA, BEN]) {
    db.presences.set(`${id}:${DATE}`, {
      status: 'available',
      status_since: MONDAY_10H - 3600_000,
      break_type: null,
      expected_back_at: null,
      shift_end_at: null,
      updated_by: null,
    });
  }
  db.profiles.set(CLIENT, { first_name: 'Léa', tracking_consent_at: null });
  db.authPhones.set(CLIENT, '+33612345678');
  db.authPhones.set(CLIENT_2, '+33612345679');
}
