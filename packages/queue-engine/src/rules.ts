/** Small rule helpers shared by the schedule, distribution, commands and triggers. */
import { MINUTE } from './constants.ts';
import type {
  Instant,
  MemberState,
  QueueState,
  ServiceDay,
  ServiceState,
  TicketState,
  TicketStatus,
} from './types.ts';

const ACTIVE: readonly TicketStatus[] = [
  'pending_confirmation',
  'waiting',
  'called',
  'in_service',
];

/** Active = pending_confirmation, waiting, called, in_service (BACKEND_SCHEMA §3). */
export function isActiveStatus(status: TicketStatus): boolean {
  return ACTIVE.includes(status);
}

/** Last closing of the service day (H9, E5); null on a day without opening range. */
export function lastClosingAt(day: ServiceDay): Instant | null {
  if (day.opening_ranges.length === 0) return null;
  return Math.max(...day.opening_ranges.map((r) => r.closes_at));
}

/** Limit used for « file complète »: last closing, or midnight on a day without range. */
export function fullnessLimit(day: ServiceDay): Instant {
  return lastClosingAt(day) ?? day.ends_at;
}

/**
 * Moves an instant that falls in a closure between two opening ranges (lunch
 * break) to the next opening; the queue resumes there (E24).
 */
export function skipClosures(day: ServiceDay, t: Instant): Instant {
  const ranges = [...day.opening_ranges].sort(
    (a, b) => a.opens_at - b.opens_at,
  );
  for (let i = 0; i < ranges.length - 1; i += 1) {
    const current = ranges[i] as (typeof ranges)[number];
    const next = ranges[i + 1] as (typeof ranges)[number];
    if (t >= current.closes_at && t < next.opens_at) return next.opens_at;
  }
  return t;
}

export function findMember(
  state: QueueState,
  id: string | null,
): MemberState | undefined {
  return id === null ? undefined : state.members.find((m) => m.id === id);
}

export function findService(
  state: QueueState,
  id: string | null,
): ServiceState | undefined {
  return id === null ? undefined : state.services.find((s) => s.id === id);
}

export function findTicket(
  state: QueueState,
  id: string,
): TicketState | undefined {
  return state.tickets.find((t) => t.id === id);
}

/**
 * A member masters a service when it has no required specialty, or when he
 * has it. An unknown service (« je ne sais pas encore ») is accepted by
 * everyone (E12).
 */
export function masters(
  member: MemberState,
  service: ServiceState | null | undefined,
): boolean {
  if (!service || service.required_specialty_code === null) return true;
  return member.specialties.includes(service.required_specialty_code);
}

/** Rule 4: the ticket requests him, or has no preference and he masters the service. */
export function canServe(
  state: QueueState,
  member: MemberState,
  ticket: TicketState,
): boolean {
  if (ticket.requested_member_id !== null) {
    return ticket.requested_member_id === member.id;
  }
  return masters(member, findService(state, ticket.service_id));
}

/** End of shift of a member who declared his end of day for later. */
export function shiftEndOf(member: MemberState, now: Instant): Instant | null {
  const { status, shift_end_at } = member.presence;
  return status === 'off_duty' && shift_end_at !== null && shift_end_at > now
    ? shift_end_at
    : null;
}

/**
 * The member still works today and can be requested: active, cutting hair,
 * not absent, not past his end of day (rule 1).
 */
export function worksToday(member: MemberState, now: Instant): boolean {
  if (member.status !== 'active' || !member.is_hairdressing) return false;
  const { status } = member.presence;
  if (status === 'absent') return false;
  if (status === 'off_duty') return shiftEndOf(member, now) !== null;
  return true;
}

/**
 * « Attendre » is offered unless the requested stylist is absent all day,
 * deactivated or a manager who stopped cutting hair (E7, E8).
 */
export function waitOffered(state: QueueState, ticket: TicketState): boolean {
  const member = findMember(state, ticket.requested_member_id);
  if (!member) return false;
  return (
    member.status === 'active' &&
    member.is_hairdressing &&
    member.presence.status !== 'absent'
  );
}

/**
 * H8 (E34): the client declared an arrival time that is not reached yet; he
 * takes the head back at that time, whether or not he is physically there
 * (arrival is only recorded at the call). A delay declared at T-30
 * (`eta_response = late`) never makes a ticket skipped (E2): only « Prendre
 * le suivant » moves it back.
 */
export function awaitsDeclaredArrival(
  ticket: TicketState,
  t: Instant,
): boolean {
  return (
    ticket.declared_arrival_at !== null &&
    ticket.declared_arrival_at > t &&
    ticket.eta_response !== 'late'
  );
}

/** Earliest start of a ready ticket at time t: a late client is waited for until his announced time (E2). */
export function readyStart(ticket: TicketState, t: Instant): Instant {
  if (
    ticket.eta_response === 'late' &&
    ticket.declared_arrival_at !== null &&
    ticket.arrived_at === null
  ) {
    return Math.max(t, ticket.declared_arrival_at);
  }
  return t;
}

export function durationOf(ticket: TicketState): number {
  return ticket.planned_duration_minutes * MINUTE;
}

/**
 * Queue order (rule 3): a called client put back at the head comes first
 * (E6, `priority_since`), then registration rank.
 */
export function compareQueueOrder(a: TicketState, b: TicketState): number {
  const pa = a.priority_since ?? Number.POSITIVE_INFINITY;
  const pb = b.priority_since ?? Number.POSITIVE_INFINITY;
  if (pa !== pb) return pa < pb ? -1 : 1;
  return a.queue_rank - b.queue_rank;
}

/**
 * Waiting walk-in tickets in queue order. Appointments (`kind =
 * 'appointment'`, H10) are handled in step 2 of DEV-2 and are left out here;
 * `pending_confirmation` never enters any estimate (invariant 8).
 */
export function orderedQueue(state: QueueState): TicketState[] {
  return state.tickets
    .filter((t) => t.status === 'waiting' && t.kind === 'queue')
    .sort(compareQueueOrder);
}

/** The called or in-service ticket of a member (invariant 2: at most one). */
export function busyTicketOf(
  state: QueueState,
  memberId: string,
): TicketState | undefined {
  return state.tickets.find(
    (t) =>
      t.assigned_member_id === memberId &&
      (t.status === 'called' || t.status === 'in_service'),
  );
}

export const ceilToMinute = (t: Instant): Instant =>
  Math.ceil(t / MINUTE) * MINUTE;
