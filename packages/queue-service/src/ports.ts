/**
 * Ports of the queue service: what it reads from the database and the single
 * set of writes it hands back. `postgres.ts` implements them with SQL, and
 * `testing.ts` in memory. Instants are UTC epoch milliseconds, as in the engine.
 */
import type {
  Instant,
  MemberRole,
  MemberState,
  NotificationTemplate,
  PresenceState,
  QueueEvent,
  SalonEvent,
  SalonSettings,
  SalonStatus,
  QueueStatus,
  ServiceState,
  TicketState,
  TicketStatus,
} from '../../queue-engine/src/index.ts';
import type { OpeningHourRow } from './time.ts';

/** Active membership of the signed-in profile (ADR-019: deactivated members are absent). */
export interface MemberRef {
  readonly member_id: string;
  readonly salon_id: string;
  readonly role: MemberRole;
}

export interface MemberRecord {
  readonly member_id: string;
  readonly salon_id: string;
  readonly profile_id: string | null;
  readonly role: MemberRole;
  readonly status: 'invited' | 'active' | 'deactivated';
}

export interface TicketRef {
  readonly ticket_id: string;
  readonly salon_id: string;
  readonly client_id: string | null;
  readonly status: TicketStatus;
}

/** One entry of `salons.next_free_slots` (ADR-017). */
export interface FreeSlotRow {
  readonly service_id: string;
  readonly start_at: string;
}

export interface SalonRow {
  readonly id: string;
  readonly status: SalonStatus;
  readonly queue_status: QueueStatus;
  readonly settings: SalonSettings;
  readonly queue_version: number;
  readonly waiting_count: number;
  readonly current_wait_minutes: number | null;
  readonly is_full: boolean;
  readonly estimate_updated_at: Instant | null;
  readonly qr_token: string;
  readonly setup_test_passed_at: Instant | null;
  readonly opening_hours_count: number;
  readonly next_free_slots: readonly FreeSlotRow[];
}

/** A salon member and its presence row of the day (null = none yet, offline). */
export interface MemberRow extends Omit<MemberState, 'presence'> {
  readonly presence: PresenceState | null;
}

export interface DayData {
  readonly salon: SalonRow;
  readonly members: readonly MemberRow[];
  readonly services: readonly ServiceState[];
  /** Tickets of the service day, every status. */
  readonly tickets: readonly TicketState[];
  /** Opening ranges of the day's weekday. */
  readonly opening_hours: readonly OpeningHourRow[];
  /** A `salon_closures` row covers the day. */
  readonly closed: boolean;
}

export interface StoredResponse {
  readonly status: number;
  readonly body: unknown;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** A column value ready for SQL: text, number, boolean, null, or ISO time. */
export type DbValue = string | number | boolean | null;

export interface NewTicketRow {
  readonly columns: Readonly<Record<string, DbValue>>;
}

export interface TicketUpdate {
  readonly id: string;
  readonly columns: Readonly<Record<string, DbValue>>;
}

export interface PresenceUpsert {
  readonly member_id: string;
  readonly status: string;
  readonly status_since: string;
  readonly break_type: string | null;
  readonly expected_back_at: string | null;
  readonly shift_end_at: string | null;
  readonly updated_by_member_id: string | null;
}

export interface NewContact {
  readonly ticket_id: string;
  readonly phone_e164: string;
  readonly phone_hash: Uint8Array;
  readonly is_pending_confirmation: boolean;
}

export interface ContactUpdate {
  readonly ticket_id: string;
  /** Close the contact (ticket left the active statuses). */
  readonly close: boolean;
  readonly is_pending_confirmation?: boolean;
}

/** K14: the surviving ticket takes the number of the merged one, whose contact closes. */
export interface ContactMove {
  readonly from_ticket_id: string;
  readonly to_ticket_id: string;
}

/** New phone for an appointment entered by the salon (update_appointment). */
export interface ContactReplace {
  readonly ticket_id: string;
  readonly phone_e164: string;
  readonly phone_hash: Uint8Array;
}

export interface NotificationRow {
  readonly ticket_id: string | null;
  readonly recipient_profile_id: string | null;
  readonly recipient_member_id: string | null;
  readonly channel: 'push' | 'sms';
  readonly template: NotificationTemplate | 'appointment_checked_in';
  readonly params: Readonly<Record<string, DbValue>>;
  readonly dedupe_key: string;
  readonly requires_consent: boolean;
}

/** Salon events written by the service itself: K35 and S-16. */
export type PublishedEvent = Omit<SalonEvent, 'type'> & {
  readonly type: 'published' | 'member_sessions_revoked' | 'member_deactivated';
};

export type EventRow = (QueueEvent | PublishedEvent) & {
  readonly command_id: string | null;
};

/** Broadcast targets, turned into topics by the adapter (the token never leaves SQL). */
export type Broadcast =
  | {
      readonly kind: 'salon';
      readonly event:
        | 'queue_updated'
        | 'queue_status_changed'
        | 'presence_changed'
        | 'appointment_pending';
    }
  | { readonly kind: 'salon_public' }
  | {
      readonly kind: 'ticket';
      readonly ticket_id: string;
      readonly status: TicketStatus;
    };

export interface WriteSet {
  readonly salon_id: string;
  readonly service_date: string;
  readonly profile?: { readonly id: string; readonly first_name: string };
  readonly profile_consent?: {
    readonly id: string;
    readonly tracking_consent_at: string | null;
  };
  readonly salon: Readonly<Record<string, DbValue>>;
  readonly members: readonly {
    readonly id: string;
    readonly columns: Readonly<Record<string, DbValue>>;
  }[];
  readonly presences: readonly PresenceUpsert[];
  readonly new_tickets: readonly NewTicketRow[];
  /** Applied in this order: closing tickets first, then freed stylists (unique indexes). */
  readonly ticket_updates: readonly TicketUpdate[];
  readonly new_contacts: readonly NewContact[];
  readonly contact_updates: readonly ContactUpdate[];
  readonly contact_moves: readonly ContactMove[];
  readonly contact_replaces: readonly ContactReplace[];
  readonly events: readonly EventRow[];
  readonly notifications: readonly NotificationRow[];
  /** S-16: Auth sessions to delete (profile ids) and members whose push subscriptions go. */
  readonly revoke_sessions_of?: readonly string[];
  readonly delete_push_of_members?: readonly string[];
  /** Payload `{ version }` (and `status` for a ticket); sent inside the transaction. */
  readonly broadcasts: readonly Broadcast[];
  readonly version: number;
}

// ---------------------------------------------------------------------------
// Transaction
// ---------------------------------------------------------------------------

export interface QueueTx {
  /** `pg_advisory_xact_lock` on the salon (ADR-003). */
  lockSalon(salonId: string): Promise<void>;
  findProcessed(commandId: string): Promise<StoredResponse | null>;
  saveProcessed(
    commandId: string,
    command: string,
    salonId: string,
    response: StoredResponse,
  ): Promise<void>;

  memberships(profileId: string): Promise<MemberRef[]>;
  ticketRef(ticketId: string): Promise<TicketRef | null>;
  /** Salon of a member (any status), for `set_presence` on someone else. */
  memberSalon(memberId: string): Promise<string | null>;
  /** A member of any status (S-16). */
  memberById(memberId: string): Promise<MemberRecord | null>;
  /** Active managers of a salon (at least one must stay, S-16 scenario 8). */
  activeManagerCount(salonId: string): Promise<number>;
  ticketByToken(token: string): Promise<TicketRef | null>;
  /**
   * Ends the places of earlier days still active (S-15 scenario 15), when
   * `queue-tick` did not: none may block its client the next day.
   */
  closePastDays(
    today: string,
    profileId: string | null,
    phoneHash: Uint8Array | null,
  ): Promise<void>;
  /** Active, non-test ticket of a client in any salon. */
  activeTicketOfClient(profileId: string): Promise<TicketRef | null>;
  /**
   * Salons holding an active, confirmed contact with this number (ADR-011),
   * leaving out the given ticket.
   */
  salonsWithActivePhone(
    phoneHash: Uint8Array,
    exceptTicketId: string | null,
  ): Promise<string[]>;
  /** Phone hash of a ticket's open contact. */
  contactHash(ticketId: string): Promise<Uint8Array | null>;

  profileFirstName(profileId: string): Promise<string | null>;
  /** Phone of the Auth account (`auth.users.phone`), E.164. */
  authPhone(profileId: string): Promise<string | null>;

  loadDay(
    salonId: string,
    serviceDate: string,
    weekday: number,
  ): Promise<DayData | null>;
  /** K15: appointments entered by the salon since an instant. */
  appointmentsCreatedSince(salonId: string, since: Instant): Promise<number>;

  apply(writes: WriteSet): Promise<void>;

  /**
   * `queue-tick`: published salons for today, and every salon and day that
   * still holds an active ticket (a past day is closed at midnight, E24).
   */
  dueSalonDays(
    today: string,
  ): Promise<{ salon_id: string; service_date: string }[]>;
  /**
   * K8, E10, E28: records the absences of these tickets by number and returns
   * the tickets whose number reaches 5 absences in 30 days and was not warned
   * in the last 30 days (the warning is recorded at the same time).
   */
  recordNoShows(ticketIds: readonly string[], now: Instant): Promise<string[]>;
}

export interface QueueDb {
  transaction<T>(fn: (tx: QueueTx) => Promise<T>): Promise<T>;
}
