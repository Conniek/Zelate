/**
 * Time triggers of `queue-tick` (TRD §6.1, BACKEND_SCHEMA §10), step 1:
 * end of the service day, release at `release_due_at`, reminder, stylist
 * choice timeout, automatic cancellation after the closing, recalculation
 * with the end-of-day warnings, then T-30 and T-10. Each trigger is guarded
 * by a column so a second tick at the same instant changes nothing.
 */
import {
  GET_READY_MINUTES,
  MINUTE,
  STYLIST_CHANGE_TIMEOUT_MINUTES,
  TURN_APPROACHING_MINUTES,
} from './constants.ts';
import { finalize, withVersion } from './output.ts';
import { refresh } from './refresh.ts';
import { isActiveStatus, lastClosingAt, waitOffered } from './rules.ts';
import { CLEARED_CALL, SYSTEM, ticketEvent } from './state.ts';
import type {
  EngineOutput,
  Instant,
  QueueEvent,
  QueueState,
  TicketState,
} from './types.ts';

type TicketRule = (
  ticket: TicketState,
  state: QueueState,
  events: QueueEvent[],
) => TicketState;

function eachTicket(
  state: QueueState,
  rule: TicketRule,
  events: QueueEvent[],
): QueueState {
  return {
    ...state,
    tickets: state.tickets.map((t) => rule(t, state, events)),
  };
}

function endOfServiceDay(now: Instant): TicketRule {
  // E24, invariant 9: nothing survives midnight in Paris (given by the caller).
  return (t, _state, events) => {
    if (!isActiveStatus(t.status)) return t;
    events.push(ticketEvent(SYSTEM, 'cancelled', t.id, 'end_of_day'));
    return {
      ...t,
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: 'end_of_day',
      stylist_change_pending_since: null,
      priority_since: null,
      ...CLEARED_CALL,
    };
  };
}

function release(now: Instant): TicketRule {
  // Transition 7 (H4, E2): called → no_show at release_due_at without arrival.
  return (t, _state, events) => {
    if (
      t.status !== 'called' ||
      t.arrived_at !== null ||
      t.release_due_at === null ||
      now < t.release_due_at
    ) {
      return t;
    }
    events.push(ticketEvent(SYSTEM, 'no_show', t.id));
    return { ...t, status: 'no_show', no_show_at: now, ...CLEARED_CALL };
  };
}

function reminder(now: Instant): TicketRule {
  // H4: 5 min after the call; with a later announced arrival, 5 min before the release (E33 default).
  return (t, state) => {
    if (
      t.status !== 'called' ||
      t.arrived_at !== null ||
      t.reminder_sent_at !== null ||
      t.release_due_at === null
    ) {
      return t;
    }
    const { auto_release_after_minutes, reminder_after_minutes } =
      state.salon.settings;
    const due =
      t.release_due_at -
      (auto_release_after_minutes - reminder_after_minutes) * MINUTE;
    return now >= due ? { ...t, reminder_sent_at: now } : t;
  };
}

function choiceTimeout(now: Instant): TicketRule {
  // Transition 8: without an answer in 10 min, « premier disponible » if « attendre » is not offered (E7), else he waits.
  return (t, state, events) => {
    if (
      t.status !== 'waiting' ||
      t.stylist_change_pending_since === null ||
      now <
        t.stylist_change_pending_since + STYLIST_CHANGE_TIMEOUT_MINUTES * MINUTE
    ) {
      return t;
    }
    const firstAvailable = !waitOffered(state, t);
    events.push(
      ticketEvent(
        SYSTEM,
        'stylist_change_resolved',
        t.id,
        firstAvailable ? 'first_available' : 'wait',
      ),
    );
    return {
      ...t,
      stylist_change_pending_since: null,
      requested_member_id: firstAvailable ? null : t.requested_member_id,
    };
  };
}

function closingGrace(now: Instant): TicketRule {
  // H9: remaining waiting clients without a manager decision, closing + 15 min.
  return (t, state, events) => {
    const closing = lastClosingAt(state.salon.service_day);
    if (
      closing === null ||
      now < closing + state.salon.settings.closing_grace_minutes * MINUTE ||
      t.status !== 'waiting' ||
      t.closing_decision !== null
    ) {
      return t;
    }
    events.push(ticketEvent(SYSTEM, 'cancelled', t.id, 'end_of_day'));
    return {
      ...t,
      status: 'cancelled',
      cancelled_at: now,
      cancel_reason: 'end_of_day',
      stylist_change_pending_since: null,
      priority_since: null,
    };
  };
}

function anticipation(now: Instant): TicketRule {
  // H3: T-30 once (records the T-30 estimate, K13), T-10 once.
  return (t) => {
    if (t.status !== 'waiting' || t.estimated_start_at === null) return t;
    const left = t.estimated_start_at - now;
    let next = t;
    if (
      t.turn_approaching_sent_at === null &&
      left <= TURN_APPROACHING_MINUTES * MINUTE
    ) {
      next = {
        ...next,
        turn_approaching_sent_at: now,
        t30_estimated_start_at: t.estimated_start_at,
      };
    }
    if (t.get_ready_sent_at === null && left <= GET_READY_MINUTES * MINUTE) {
      next = { ...next, get_ready_sent_at: now };
    }
    return next;
  };
}

function queueSnapshot(state: QueueState): string {
  const salon = { ...state.salon, estimate_updated_at: null, queue_version: 0 };
  return JSON.stringify([salon, state.members, state.tickets]);
}

/** Applies every time trigger due at `now` (one `queue-tick` pass for one salon). */
export function detectTimeTriggers(
  state: QueueState,
  now: Instant,
): EngineOutput {
  const events: QueueEvent[] = [];
  let next = state;
  if (now >= state.salon.service_day.ends_at) {
    next = eachTicket(next, endOfServiceDay(now), events);
  } else {
    next = eachTicket(next, release(now), events);
    next = eachTicket(next, reminder(now), events);
    next = eachTicket(next, choiceTimeout(now), events);
    next = eachTicket(next, closingGrace(now), events);
  }
  const refreshed = refresh(next, now);
  events.push(...refreshed.events);
  next = eachTicket(refreshed.state, anticipation(now), events);
  const changed = queueSnapshot(next) !== queueSnapshot(state);
  return finalize(
    state,
    withVersion(next, state.salon.queue_version + (changed ? 1 : 0)),
    events,
  );
}
