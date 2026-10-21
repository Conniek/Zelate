/** Distribution rules 1-5 of PRD §5.2 (H1), assignment at the call (ADR-015). */
import {
  appointmentToTake,
  appointmentsOf,
  awaitsDeclaredArrival,
  canServe,
  durationOf,
  findMember,
  isOnSite,
  orderedQueue,
  readyStart,
  shiftEndOf,
} from './rules.ts';
import { computeSchedule } from './schedule.ts';
import type { Instant, QueueState, TicketState } from './types.ts';

/**
 * Rule 2: the stylist retained for the estimate of a waiting ticket — the
 * requested one, or the one who masters the service and frees up first
 * (tie: fewest clients served today). Null when nobody can take it today.
 */
export function estimateStylist(
  state: QueueState,
  ticketId: string,
  now: Instant,
): string | null {
  return (
    computeSchedule(state, now).tickets[ticketId]?.estimated_member_id ?? null
  );
}

/**
 * Tickets this member could call now, in call order (rules 4, 6, 7, 8): his
 * appointment that is due (or the next one when the first is more than 10
 * minutes late and would overrun it), then walk-ins in queue order, then an
 * early appointment whose client is on site. Walk-ins requesting someone else
 * are skipped and keep their rank (E12); a ticket whose declared arrival time
 * is not reached is skipped (H8); a declared delay does not skip a ticket
 * (E2). A walk-in must end before the member's next appointment (margin 0)
 * and before his end of day when he leaves early.
 */
export function callableTickets(
  state: QueueState,
  memberId: string,
  now: Instant,
): TicketState[] {
  const member = findMember(state, memberId);
  if (!member) return [];
  const shiftEnd = shiftEndOf(member, now);
  const fitsShift = (ticket: TicketState): boolean =>
    shiftEnd === null ||
    readyStart(ticket, now) + durationOf(ticket) <= shiftEnd;
  const mine = appointmentsOf(state, memberId);
  const first = mine[0];
  const due = first !== undefined && (first.scheduled_at as Instant) <= now;
  const taken = due ? appointmentToTake(mine, now) : undefined;
  const limit =
    first === undefined || due
      ? Number.POSITIVE_INFINITY
      : (first.scheduled_at as Instant);
  const walkIns = orderedQueue(state).filter(
    (ticket) =>
      canServe(state, member, ticket) &&
      !awaitsDeclaredArrival(ticket, now) &&
      fitsShift(ticket) &&
      readyStart(ticket, now) + durationOf(ticket) <= limit,
  );
  const early =
    !due && first !== undefined && isOnSite(first) && fitsShift(first)
      ? [first]
      : [];
  return taken ? [taken, ...walkIns] : [...walkIns, ...early];
}

/** The next client of a member who frees up, or null. */
export function pickNextTicket(
  state: QueueState,
  memberId: string,
  now: Instant,
): TicketState | null {
  return callableTickets(state, memberId, now)[0] ?? null;
}
