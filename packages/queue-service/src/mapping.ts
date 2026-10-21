/**
 * Rows ↔ engine state, and the diff of two states into SQL-ready writes.
 * Engine names mirror BACKEND_SCHEMA v0.5 (types.ts header), so a ticket field
 * is its column: only instants need converting (epoch ms ↔ ISO).
 */
import {
  isActiveStatus,
  type Instant,
  type MemberState,
  type PresenceState,
  type QueueState,
  type ServiceDay,
  type TicketState,
  type TicketStatus,
} from '../../queue-engine/src/index.ts';
import type {
  Broadcast,
  ContactUpdate,
  DayData,
  DbValue,
  PresenceUpsert,
  TicketUpdate,
} from './ports.ts';

export const iso = (instant: Instant): string =>
  new Date(instant).toISOString();
const isoOrNull = (instant: Instant | null): string | null =>
  instant === null ? null : iso(instant);

/** Every ticket column the engine reads or writes (`TicketState`). */
export const TICKET_FIELDS = [
  'id',
  'service_date',
  'short_code',
  'kind',
  'scheduled_at',
  'appointment_source',
  'confirmed_at',
  'confirmed_by_member_id',
  'confirmation_reminder_sent_at',
  'appointment_delay_warned_steps',
  'client_id',
  'channel',
  'is_test',
  'service_id',
  'planned_duration_minutes',
  'requested_member_id',
  'estimated_member_id',
  'assigned_member_id',
  'status',
  'queue_rank',
  'priority_since',
  'call_count',
  'postpone_count',
  'declared_arrival_at',
  'notifications_consent_at',
  'eta_response',
  'declared_delay_minutes',
  'arrived_at',
  'stylist_change_pending_since',
  'reassignment_member_id',
  'reassignment_requested_at',
  'reassignment_proposed_start_at',
  'estimated_start_at',
  'last_notified_start_at',
  'initial_estimated_start_at',
  't30_estimated_start_at',
  'estimate_version',
  'turn_approaching_sent_at',
  'get_ready_sent_at',
  'called_at',
  'release_due_at',
  'reminder_sent_at',
  'end_of_day_warned_at',
  'end_of_day_choice',
  'closing_decision',
  'started_at',
  'completed_at',
  'actual_duration_minutes',
  'cancelled_at',
  'cancel_reason',
  'removal_reason',
  'no_show_at',
  'created_by_member_id',
  'created_at',
] as const satisfies readonly (keyof TicketState)[];

// Compile-time check: no TicketState field is missing from TICKET_FIELDS.
type MissingField = Exclude<keyof TicketState, (typeof TICKET_FIELDS)[number]>;
export const TICKET_FIELDS_COMPLETE: [MissingField] extends [never]
  ? true
  : MissingField = true;

/** Ticket fields stored as `timestamptz`. */
export const TICKET_INSTANT_FIELDS = [
  'scheduled_at',
  'confirmed_at',
  'confirmation_reminder_sent_at',
  'priority_since',
  'declared_arrival_at',
  'notifications_consent_at',
  'arrived_at',
  'stylist_change_pending_since',
  'reassignment_requested_at',
  'reassignment_proposed_start_at',
  'estimated_start_at',
  'last_notified_start_at',
  'initial_estimated_start_at',
  't30_estimated_start_at',
  'turn_approaching_sent_at',
  'get_ready_sent_at',
  'called_at',
  'release_due_at',
  'reminder_sent_at',
  'end_of_day_warned_at',
  'started_at',
  'completed_at',
  'cancelled_at',
  'no_show_at',
  'created_at',
] as const satisfies readonly (keyof TicketState)[];

const INSTANT_SET: ReadonlySet<string> = new Set(TICKET_INSTANT_FIELDS);

export function ticketColumn(
  key: keyof TicketState,
  value: TicketState[keyof TicketState],
): DbValue {
  if (INSTANT_SET.has(key)) return isoOrNull(value as Instant | null);
  return value as DbValue;
}

/** Every column of a new ticket, from its engine state. */
export function ticketColumns(ticket: TicketState): Record<string, DbValue> {
  const out: Record<string, DbValue> = {};
  for (const key of Object.keys(ticket) as (keyof TicketState)[]) {
    out[key] = ticketColumn(key, ticket[key]);
  }
  return out;
}

export function offlinePresence(since: Instant): PresenceState {
  return {
    status: 'offline',
    status_since: since,
    break_type: null,
    expected_back_at: null,
    shift_end_at: null,
  };
}

export function toState(
  day: DayData,
  serviceDay: ServiceDay,
  now: Instant,
): QueueState {
  const { salon } = day;
  return {
    salon: {
      id: salon.id,
      status: salon.status,
      queue_status: salon.queue_status,
      settings: salon.settings,
      service_day: serviceDay,
      queue_version: salon.queue_version,
      waiting_count: salon.waiting_count,
      current_wait_minutes: salon.current_wait_minutes,
      is_full: salon.is_full,
      estimate_updated_at: salon.estimate_updated_at,
    },
    members: day.members.map((m): MemberState => ({
      ...m,
      presence: m.presence ?? offlinePresence(now),
    })),
    services: day.services,
    tickets: day.tickets,
  };
}

// ---------------------------------------------------------------------------
// Diff
// ---------------------------------------------------------------------------

function changedColumns(
  before: TicketState,
  after: TicketState,
): Record<string, DbValue> {
  const out: Record<string, DbValue> = {};
  for (const key of Object.keys(after) as (keyof TicketState)[]) {
    if (before[key] !== after[key]) out[key] = ticketColumn(key, after[key]);
  }
  return out;
}

/**
 * Order of ticket updates, so that the partial unique indexes hold after each
 * statement: tickets that close come first (a merged ticket frees its client),
 * then tickets that leave `called`/`in_service` (a stylist is freed), then the
 * rest.
 */
function updateRank(status: TicketStatus): number {
  if (!isActiveStatus(status)) return 0;
  if (status === 'waiting' || status === 'pending_confirmation') return 1;
  return 2;
}

function samePresence(a: PresenceState, b: PresenceState): boolean {
  return (
    a.status === b.status &&
    a.status_since === b.status_since &&
    a.break_type === b.break_type &&
    a.expected_back_at === b.expected_back_at &&
    a.shift_end_at === b.shift_end_at
  );
}

export interface StateDiff {
  readonly salon: Record<string, DbValue>;
  readonly members: { id: string; columns: Record<string, DbValue> }[];
  readonly presences: PresenceUpsert[];
  /** Existing tickets that changed, in a safe order. */
  readonly ticket_updates: TicketUpdate[];
  /** Tickets present in `after` only. */
  readonly new_tickets: TicketState[];
  readonly contact_updates: ContactUpdate[];
  readonly broadcasts: Broadcast[];
  readonly changed: boolean;
}

export function diffStates(
  before: QueueState,
  after: QueueState,
  actorMemberId: string | null,
): StateDiff {
  const salon: Record<string, DbValue> = {};
  const b = before.salon;
  const a = after.salon;
  if (a.queue_status !== b.queue_status) salon.queue_status = a.queue_status;
  if (a.queue_version !== b.queue_version)
    salon.queue_version = a.queue_version;
  if (a.waiting_count !== b.waiting_count)
    salon.waiting_count = a.waiting_count;
  if (a.current_wait_minutes !== b.current_wait_minutes) {
    salon.current_wait_minutes = a.current_wait_minutes;
  }
  if (a.is_full !== b.is_full) salon.is_full = a.is_full;
  if (a.estimate_updated_at !== b.estimate_updated_at) {
    salon.estimate_updated_at = isoOrNull(a.estimate_updated_at);
  }

  const members: StateDiff['members'] = [];
  const presences: PresenceUpsert[] = [];
  const beforeMembers = new Map(before.members.map((m) => [m.id, m]));
  for (const member of after.members) {
    const old = beforeMembers.get(member.id);
    if (!old) continue;
    const columns: Record<string, DbValue> = {};
    if (member.is_hairdressing !== old.is_hairdressing) {
      columns.is_hairdressing = member.is_hairdressing;
    }
    if (member.served_today_count !== old.served_today_count) {
      columns.served_today_count = member.served_today_count;
    }
    if (Object.keys(columns).length > 0)
      members.push({ id: member.id, columns });
    if (!samePresence(member.presence, old.presence)) {
      const p = member.presence;
      presences.push({
        member_id: member.id,
        status: p.status,
        status_since: iso(p.status_since),
        break_type: p.break_type,
        expected_back_at: isoOrNull(p.expected_back_at),
        shift_end_at: isoOrNull(p.shift_end_at),
        updated_by_member_id: actorMemberId,
      });
    }
  }

  const beforeTickets = new Map(before.tickets.map((t) => [t.id, t]));
  const updates: { rank: number; update: TicketUpdate }[] = [];
  const newTickets: TicketState[] = [];
  const contactUpdates: ContactUpdate[] = [];
  const ticketBroadcasts: Broadcast[] = [];
  for (const ticket of after.tickets) {
    const old = beforeTickets.get(ticket.id);
    if (!old) {
      newTickets.push(ticket);
      ticketBroadcasts.push({
        kind: 'ticket',
        ticket_id: ticket.id,
        status: ticket.status,
      });
      continue;
    }
    if (old === ticket) continue;
    const columns = changedColumns(old, ticket);
    if (Object.keys(columns).length === 0) continue;
    updates.push({
      rank: updateRank(ticket.status),
      update: { id: ticket.id, columns },
    });
    ticketBroadcasts.push({
      kind: 'ticket',
      ticket_id: ticket.id,
      status: ticket.status,
    });
    if (isActiveStatus(old.status) && !isActiveStatus(ticket.status)) {
      contactUpdates.push({ ticket_id: ticket.id, close: true });
    } else if (
      old.status === 'pending_confirmation' &&
      ticket.status !== 'pending_confirmation'
    ) {
      contactUpdates.push({
        ticket_id: ticket.id,
        close: false,
        is_pending_confirmation: false,
      });
    }
  }
  updates.sort((x, y) => x.rank - y.rank);

  // A recalculation that moved nothing only refreshes `estimate_updated_at`:
  // not a change, nothing to write or broadcast (every queue-tick pass).
  const salonChanged = Object.keys(salon).some(
    (k) => k !== 'estimate_updated_at',
  );
  const changed =
    salonChanged ||
    members.length > 0 ||
    presences.length > 0 ||
    updates.length > 0 ||
    newTickets.length > 0;

  if (!changed) delete salon.estimate_updated_at;

  const broadcasts: Broadcast[] = [];
  if (changed) {
    broadcasts.push({ kind: 'salon', event: 'queue_updated' });
    if ('queue_status' in salon) {
      broadcasts.push({ kind: 'salon', event: 'queue_status_changed' });
    }
    if (presences.length > 0 || members.length > 0) {
      broadcasts.push({ kind: 'salon', event: 'presence_changed' });
    }
    broadcasts.push({ kind: 'salon_public' }, ...ticketBroadcasts);
  }

  return {
    salon,
    members,
    presences,
    ticket_updates: updates.map((u) => u.update),
    new_tickets: newTickets,
    contact_updates: contactUpdates,
    broadcasts,
    changed,
  };
}
