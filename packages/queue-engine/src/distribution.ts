/** Distribution rules 1-5 of PRD §5.2 (H1), assignment at the call (ADR-015). */
import {
  awaitsDeclaredArrival,
  canServe,
  durationOf,
  findMember,
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
 * Tickets this member could call now, in queue order (rule 4): requesting
 * him, or without preference with a service he masters (E12). Tickets
 * requesting someone else are skipped and keep their rank; a ticket whose
 * declared arrival time is not reached is skipped (H8); a declared delay does
 * not skip a ticket (E2). A member leaving early only takes a client who ends
 * before his end of day.
 */
export function callableTickets(
  state: QueueState,
  memberId: string,
  now: Instant,
): TicketState[] {
  const member = findMember(state, memberId);
  if (!member) return [];
  const shiftEnd = shiftEndOf(member, now);
  return orderedQueue(state).filter(
    (ticket) =>
      canServe(state, member, ticket) &&
      !awaitsDeclaredArrival(ticket, now) &&
      (shiftEnd === null ||
        readyStart(ticket, now) + durationOf(ticket) <= shiftEnd),
  );
}

/** Rule 4: the next client of a member who frees up, or null. */
export function pickNextTicket(
  state: QueueState,
  memberId: string,
  now: Instant,
): TicketState | null {
  return callableTickets(state, memberId, now)[0] ?? null;
}
