/**
 * Recalculation run after every command and every tick: writes the schedule
 * into the tickets and the salon indicators, then sends the end-of-day
 * warnings, since « chaque événement relance le calcul » inside the window
 * (H9).
 */
import { MINUTE } from './constants.ts';
import { durationOf, lastClosingAt } from './rules.ts';
import { computeSchedule } from './schedule.ts';
import { SYSTEM, ticketEvent } from './state.ts';
import type { Instant, QueueEvent, QueueState, TicketState } from './types.ts';

export interface Refreshed {
  readonly state: QueueState;
  readonly events: QueueEvent[];
}

function applyEstimates(state: QueueState, now: Instant): QueueState {
  const schedule = computeSchedule(state, now);
  const tickets = state.tickets.map((ticket): TicketState => {
    const estimate = schedule.tickets[ticket.id];
    if (!estimate) return ticket;
    const startChanged =
      estimate.estimated_start_at !== ticket.estimated_start_at;
    if (
      !startChanged &&
      estimate.estimated_member_id === ticket.estimated_member_id
    ) {
      return ticket;
    }
    return {
      ...ticket,
      estimated_start_at: estimate.estimated_start_at,
      estimated_member_id: estimate.estimated_member_id,
      estimate_version: ticket.estimate_version + (startChanged ? 1 : 0),
    };
  });
  return {
    ...state,
    tickets,
    salon: {
      ...state.salon,
      ...schedule.salon,
      estimate_updated_at: now,
    },
  };
}

/**
 * H9: from `end_of_day_warning_minutes` before the last closing until the
 * closing, every waiting client whose estimated end passes the closing is
 * warned once (invariant 6). Clients without estimate are left to the
 * stylist-choice flow; clients already decided by the manager are skipped.
 */
function warnEndOfDay(state: QueueState, now: Instant): Refreshed {
  const closing = lastClosingAt(state.salon.service_day);
  const events: QueueEvent[] = [];
  if (closing === null) return { state, events };
  const windowStart =
    closing - state.salon.settings.end_of_day_warning_minutes * MINUTE;
  if (now < windowStart || now >= closing) return { state, events };
  const tickets = state.tickets.map((ticket): TicketState => {
    if (
      ticket.status !== 'waiting' ||
      ticket.kind !== 'queue' ||
      ticket.end_of_day_warned_at !== null ||
      ticket.closing_decision !== null ||
      ticket.estimated_start_at === null ||
      ticket.estimated_start_at + durationOf(ticket) <= closing
    ) {
      return ticket;
    }
    events.push(ticketEvent(SYSTEM, 'end_of_day_warned', ticket.id));
    return { ...ticket, end_of_day_warned_at: now };
  });
  return { state: { ...state, tickets }, events };
}

export function refresh(state: QueueState, now: Instant): Refreshed {
  return warnEndOfDay(applyEstimates(state, now), now);
}
