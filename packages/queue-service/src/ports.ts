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

export interface TicketRef {
  readonly ticket_id: string;
  readonly salon_id: string;
  readonly client_id: string | null;
  readonly status: TicketStatus;
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

/** `published` is written by `publish_salon`, outside the engine (K35). */
export type PublishedEvent = Omit<SalonEvent, 'type'> & {
  readonly type: 'published';
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
  ticketByToken(token: string): Promise<TicketRef | null>;
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
}

export interface QueueDb {
  transaction<T>(fn: (tx: QueueTx) => Promise<T>): Promise<T>;
}
