/**
 * `applyCommand`: the queue commands of TRD §6.2 (DEV-2: core commands and
 * appointments, H10; reassignment requests, E9 and E27). Pure: the caller loads the state
 * under the per-salon lock, applies the result and writes the outbox
 * (ADR-003, K38).
 */
import {
  DURATION_DELTAS,
  MAX_DELAY_MINUTES,
  MAX_DURATION_MINUTES,
  MAX_POSTPONE,
  MIN_DELAY_MINUTES,
  MIN_DURATION_MINUTES,
  MINUTE,
  PAST_APPOINTMENT_TOLERANCE_MINUTES,
  REASSIGNMENT_TOLERANCE_MINUTES,
  UNKNOWN_SERVICE_MINUTES,
} from './constants.ts';
import { callableTickets, pickNextTicket } from './distribution.ts';
import { finalize, withVersion } from './output.ts';
import { refresh } from './refresh.ts';
import {
  busyTicketOf,
  canServe,
  compareQueueOrder,
  durationOf,
  findMember,
  findService,
  findTicket,
  fullnessLimit,
  isActiveStatus,
  lastClosingAt,
  masters,
  orderedQueue,
  shiftEndOf,
  waitOffered,
  worksToday,
} from './rules.ts';
import { computeSchedule } from './schedule.ts';
import {
  CLEARED_CALL,
  type ActorIdentity,
  identityOf,
  newTicket,
  patchMember,
  patchTicket,
  salonEvent,
  ticketEvent,
  ticketOrThrow,
} from './state.ts';
import type {
  Actor,
  CancelReason,
  Command,
  CommandResult,
  EngineOutput,
  Instant,
  MemberState,
  PresenceState,
  QueueErrorCode,
  QueueEvent,
  QueueState,
  TicketState,
} from './types.ts';
import { REMOVAL_REASONS } from './types.ts';

// --- plumbing ---------------------------------------------------------------

/** Result of a handler before recalculation. */
interface Step {
  readonly state: QueueState;
  readonly events: readonly QueueEvent[];
  /** False for a command that changes nothing (same value twice). */
  readonly changed?: boolean;
  readonly warnings?: readonly string[];
}

type Handled = Step | QueueErrorCode;

const SHORT_CODE = /^[A-HJ-NP-Z2-9]{5}$/;

function finish(before: QueueState, step: Step, now: Instant): EngineOutput {
  if (step.changed === false) {
    return { state: before, events: [], notifications: [] };
  }
  const refreshed = refresh(step.state, now);
  const output = finalize(
    before,
    withVersion(refreshed.state, before.salon.queue_version + 1),
    [...step.events, ...refreshed.events],
  );
  return step.warnings?.length
    ? { ...output, warnings: step.warnings }
    : output;
}

function activeMember(
  state: QueueState,
  actor: Actor,
): MemberState | QueueErrorCode {
  if (actor.type !== 'member') return 'forbidden';
  const member = findMember(state, actor.member_id);
  return member && member.status === 'active' ? member : 'forbidden';
}

function manager(
  state: QueueState,
  actor: Actor,
): MemberState | QueueErrorCode {
  const member = activeMember(state, actor);
  if (typeof member === 'string') return member;
  return member.role === 'manager' ? member : 'forbidden';
}

function ownsTicket(actor: Actor, ticket: TicketState): boolean {
  if (actor.type === 'client') return ticket.client_id === actor.profile_id;
  if (actor.type === 'ticket_token') return actor.ticket_id === ticket.id;
  return false;
}

/** Ticket of a client command: exists, and belongs to the session or token. */
function clientTicket(
  state: QueueState,
  actor: Actor,
  ticketId: string,
): TicketState | QueueErrorCode {
  const ticket = findTicket(state, ticketId);
  if (!ticket) return 'invalid_payload';
  return ownsTicket(actor, ticket) ? ticket : 'forbidden';
}

function cancel(
  ticket: TicketState,
  reason: CancelReason,
  now: Instant,
): Partial<TicketState> {
  return {
    status: 'cancelled',
    cancelled_at: now,
    cancel_reason: reason,
    stylist_change_pending_since: null,
    priority_since: null,
    ...(ticket.status === 'called' ? CLEARED_CALL : {}),
  };
}

/** Transition 2: waiting → called (K31, E2, K13). */
function callPatch(
  state: QueueState,
  ticket: TicketState,
  memberId: string,
  now: Instant,
): Partial<TicketState> {
  const release =
    now + state.salon.settings.auto_release_after_minutes * MINUTE;
  return {
    status: 'called',
    assigned_member_id: memberId,
    called_at: now,
    call_count: ticket.call_count + 1,
    release_due_at: Math.max(release, ticket.declared_arrival_at ?? release),
    reminder_sent_at: null,
    priority_since: null,
    stylist_change_pending_since: null,
  };
}

/**
 * E6 with the E36 default: a called client whose stylist becomes
 * unavailable goes back to `waiting` at the head of the queue
 * (`priority_since`), without countdown and without a requested stylist, to
 * be taken by the first free stylist who masters his service.
 */
function returnToHead(now: Instant): Partial<TicketState> {
  return {
    status: 'waiting',
    priority_since: now,
    assigned_member_id: null,
    requested_member_id: null,
    stylist_change_pending_since: null,
    ...CLEARED_CALL,
  };
}

// --- ticket creation (transition 1) ----------------------------------------

interface Creation {
  readonly ticket_id: string;
  readonly short_code: string;
  readonly client_id: string | null;
  readonly channel: TicketState['channel'];
  readonly service_id: string | null;
  readonly requested_member_id: string | null;
  readonly declared_arrival_at: Instant | null;
  readonly notifications_consent: boolean;
  readonly created_by_member_id: string | null;
}

function queueOpenError(
  state: QueueState,
  now: Instant,
): QueueErrorCode | null {
  if (now >= state.salon.service_day.ends_at) return 'queue_closed';
  if (state.salon.queue_status === 'closed') return 'queue_closed';
  if (state.salon.queue_status === 'paused') return 'queue_paused';
  return null;
}

function requestedError(
  state: QueueState,
  requested: string | null,
  now: Instant,
): QueueErrorCode | null {
  if (requested === null) return null;
  const member = findMember(state, requested);
  return member && worksToday(member, now) ? null : 'stylist_unavailable';
}

function create(
  state: QueueState,
  who: ActorIdentity,
  fields: Creation,
  now: Instant,
): Handled {
  if (findTicket(state, fields.ticket_id)) return 'invalid_payload';
  const service = findService(state, fields.service_id);
  const declared =
    fields.declared_arrival_at !== null && fields.declared_arrival_at > now
      ? fields.declared_arrival_at
      : null;
  const ticket = newTicket({
    id: fields.ticket_id,
    service_date: state.salon.service_day.service_date,
    short_code: fields.short_code,
    client_id: fields.client_id,
    channel: fields.channel,
    service_id: fields.service_id,
    planned_duration_minutes:
      service?.duration_minutes ?? UNKNOWN_SERVICE_MINUTES,
    requested_member_id: fields.requested_member_id,
    queue_rank: Math.max(0, ...state.tickets.map((t) => t.queue_rank)) + 1,
    declared_arrival_at: declared,
    notifications_consent_at: fields.notifications_consent ? now : null,
    created_by_member_id: fields.created_by_member_id,
    created_at: now,
  });
  const withTicket: QueueState = {
    ...state,
    tickets: [...state.tickets, ticket],
  };
  const estimate = computeSchedule(withTicket, now).tickets[ticket.id];
  const start = estimate?.estimated_start_at ?? null;
  const limit = fullnessLimit(state.salon.service_day);
  if (now >= limit || (start !== null && start + durationOf(ticket) > limit)) {
    return 'queue_full';
  }
  return {
    state: patchTicket(withTicket, ticket.id, {
      estimated_start_at: start,
      estimated_member_id: estimate?.estimated_member_id ?? null,
      initial_estimated_start_at: start,
      // `ticket_created` is an essential message that announces this time.
      last_notified_start_at: start,
      estimate_version: start === null ? 0 : 1,
    }),
    events: [ticketEvent(who, 'created', ticket.id)],
  };
}

function joinQueue(
  state: QueueState,
  command: Extract<Command, { command: 'join_queue' }>,
  now: Instant,
): Handled {
  const { actor, payload } = command;
  if (actor.type !== 'client') return 'forbidden';
  const closed = queueOpenError(state, now);
  if (closed) return closed;
  const hasActive =
    payload.has_active_ticket_elsewhere ||
    state.tickets.some(
      (t) => isActiveStatus(t.status) && t.client_id === actor.profile_id,
    );
  if (hasActive) return 'already_has_active_ticket';
  if (payload.service_id !== null) {
    const service = findService(state, payload.service_id);
    if (!service || !service.is_active) return 'service_unavailable';
    const someoneMasters = state.members.some(
      (m) => worksToday(m, now) && masters(m, service),
    );
    if (payload.requested_member_id === null && !someoneMasters) {
      return 'service_unavailable';
    }
  }
  const requested = requestedError(state, payload.requested_member_id, now);
  if (requested) return requested;
  if (
    payload.declared_arrival_at !== null &&
    !(
      Number.isFinite(payload.declared_arrival_at) &&
      payload.declared_arrival_at <= state.salon.service_day.ends_at
    )
  ) {
    return 'invalid_payload';
  }
  return create(
    state,
    identityOf(state, actor),
    {
      ticket_id: payload.ticket_id,
      short_code: payload.short_code,
      client_id: actor.profile_id,
      channel: payload.channel,
      service_id: payload.service_id,
      requested_member_id: payload.requested_member_id,
      declared_arrival_at: payload.declared_arrival_at,
      notifications_consent: payload.notifications_consent,
      created_by_member_id: null,
    },
    now,
  );
}

function registerWalkIn(
  state: QueueState,
  command: Extract<Command, { command: 'register_walk_in' }>,
  now: Instant,
): Handled {
  const boss = manager(state, command.actor);
  if (typeof boss === 'string') return boss;
  const { payload } = command;
  const closed = queueOpenError(state, now);
  if (closed) return closed;
  if (payload.phone_has_active_ticket) return 'already_has_active_ticket';
  if (payload.service_id !== null) {
    const service = findService(state, payload.service_id);
    if (!service || !service.is_active) return 'invalid_payload';
  }
  const requested = requestedError(state, payload.requested_member_id, now);
  if (requested) return requested;
  return create(
    state,
    identityOf(state, command.actor),
    {
      ticket_id: payload.ticket_id,
      short_code: payload.short_code,
      client_id: null,
      channel: 'front_desk',
      service_id: payload.service_id,
      requested_member_id: payload.requested_member_id,
      declared_arrival_at: null,
      // E17: a walk-in gets the essential messages and a link to opt in.
      notifications_consent: false,
      created_by_member_id: boss.id,
    },
    now,
  );
}

// --- stylist commands ------------------------------------------------------

/** Presence that allows calling a client (C-04 scenario 8; rule 5 for the manager). */
function mayCall(member: MemberState, now: Instant): boolean {
  const { status } = member.presence;
  if (status === 'off_duty') return shiftEndOf(member, now) !== null;
  if (member.role === 'manager' && !member.is_hairdressing) {
    // « Je prends le prochain »: only an absence blocks it.
    return status !== 'absent';
  }
  return status === 'available' || status === 'in_service';
}

function callTicket(
  state: QueueState,
  command: Extract<Command, { command: 'call_ticket' }>,
  now: Instant,
): Handled {
  const member = activeMember(state, command.actor);
  if (typeof member === 'string') return member;
  if (busyTicketOf(state, member.id)) return 'call_already_in_progress';
  if (!mayCall(member, now)) return 'invalid_transition';
  const ticket = pickNextTicket(state, member.id, now);
  if (!ticket) return 'no_eligible_ticket';
  return {
    state: patchTicket(
      state,
      ticket.id,
      callPatch(state, ticket, member.id, now),
    ),
    events: [
      ticketEvent(identityOf(state, command.actor), 'called', ticket.id),
    ],
  };
}

function confirmArrival(
  state: QueueState,
  command: Extract<Command, { command: 'confirm_arrival' }>,
  now: Instant,
): Handled {
  const member = activeMember(state, command.actor);
  if (typeof member === 'string') return member;
  const code = command.payload.short_code.toUpperCase();
  if (!SHORT_CODE.test(code)) return 'invalid_payload';
  const matches = state.tickets.filter((t) => t.short_code === code);
  const ticket = matches.find((t) => isActiveStatus(t.status)) ?? matches[0];
  if (!ticket) return 'unknown_code';
  if (!isActiveStatus(ticket.status)) return 'ticket_closed';
  // E34: physical arrival is only recorded at the call (H7), by the ticket code.
  if (ticket.status !== 'called' || ticket.arrived_at !== null) {
    return 'invalid_transition';
  }
  return {
    state: patchTicket(state, ticket.id, { arrived_at: now }),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'arrival_confirmed',
        ticket.id,
      ),
    ],
  };
}

function staffTicket(
  state: QueueState,
  actor: Actor,
  ticketId: string,
): { member: MemberState; ticket: TicketState } | QueueErrorCode {
  const member = activeMember(state, actor);
  if (typeof member === 'string') return member;
  const ticket = findTicket(state, ticketId);
  return ticket ? { member, ticket } : 'invalid_payload';
}

function startService(
  state: QueueState,
  command: Extract<Command, { command: 'start_service' }>,
  now: Instant,
): Handled {
  const found = staffTicket(state, command.actor, command.payload.ticket_id);
  if (typeof found === 'string') return found;
  const { member, ticket } = found;
  const { planned_duration_minutes: planned, service_id } = command.payload;
  if (
    !Number.isInteger(planned) ||
    planned < MIN_DURATION_MINUTES ||
    planned > MAX_DURATION_MINUTES ||
    (service_id !== null && !findService(state, service_id))
  ) {
    return 'invalid_payload';
  }
  if (ticket.status !== 'called') return 'invalid_transition';
  if (ticket.assigned_member_id !== member.id) return 'not_assigned_to_you';
  // H7: the arrival is validated by the ticket code before the service.
  if (ticket.arrived_at === null) return 'invalid_transition';
  let next = patchTicket(state, ticket.id, {
    status: 'in_service',
    started_at: now,
    service_id,
    planned_duration_minutes: planned,
    ...CLEARED_CALL,
  });
  if (member.presence.status === 'available') {
    next = patchMember(next, member.id, {
      presence: { ...member.presence, status: 'in_service', status_since: now },
    });
  }
  return {
    state: next,
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'service_started',
        ticket.id,
      ),
    ],
  };
}

function adjustDuration(
  state: QueueState,
  command: Extract<Command, { command: 'adjust_duration' }>,
): Handled {
  const found = staffTicket(state, command.actor, command.payload.ticket_id);
  if (typeof found === 'string') return found;
  const { member, ticket } = found;
  const { delta_minutes: delta } = command.payload;
  if (!DURATION_DELTAS.includes(delta)) return 'invalid_payload';
  if (ticket.status !== 'in_service') return 'invalid_transition';
  if (ticket.assigned_member_id !== member.id) return 'not_assigned_to_you';
  const planned = ticket.planned_duration_minutes + delta;
  if (planned > MAX_DURATION_MINUTES) return 'duration_limit_reached';
  return {
    state: patchTicket(state, ticket.id, { planned_duration_minutes: planned }),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'duration_adjusted',
        ticket.id,
      ),
    ],
  };
}

function completeService(
  state: QueueState,
  command: Extract<Command, { command: 'complete_service' }>,
  now: Instant,
): Handled {
  const found = staffTicket(state, command.actor, command.payload.ticket_id);
  if (typeof found === 'string') return found;
  const { member, ticket } = found;
  if (ticket.status !== 'in_service') return 'invalid_transition';
  // E15: the manager may close a service the stylist forgot.
  if (ticket.assigned_member_id !== member.id && member.role !== 'manager') {
    return 'not_assigned_to_you';
  }
  let next = patchTicket(state, ticket.id, {
    status: 'completed',
    completed_at: now,
    actual_duration_minutes: Math.round(
      (now - (ticket.started_at ?? now)) / MINUTE,
    ),
  });
  const served = findMember(state, ticket.assigned_member_id);
  if (served) {
    next = patchMember(next, served.id, {
      served_today_count: served.served_today_count + 1,
      presence:
        served.presence.status === 'in_service'
          ? { ...served.presence, status: 'available', status_since: now }
          : served.presence,
    });
  }
  return {
    state: next,
    events: [
      ticketEvent(identityOf(state, command.actor), 'completed', ticket.id),
    ],
  };
}

/**
 * Where « Prendre le suivant » puts the late client. He is reinserted right
 * after a ticket that follows him in the effective queue order (priority
 * tickets, E6, are already ahead of him), so the relative order of every
 * other ticket is kept. The places he loses are counted at every stylist who
 * could take him: none may exceed what is left of his 2 places (H5). Among
 * the tickets he lets pass there must be one this stylist can call now. The
 * furthest valid position is chosen. Null when no position qualifies.
 */
function postponement(
  state: QueueState,
  member: MemberState,
  ticket: TicketState,
  now: Instant,
): { places: number; target: TicketState } | null {
  const remaining = MAX_POSTPONE - ticket.postpone_count;
  const after = orderedQueue(state).filter(
    (t) => compareQueueOrder(ticket, t) < 0,
  );
  const servers = state.members.filter(
    (m) =>
      m.id === member.id ||
      (m.status === 'active' &&
        m.is_hairdressing &&
        canServe(state, m, ticket)),
  );
  const callable = new Set(
    callableTickets(state, member.id, now).map((t) => t.id),
  );
  const lost = new Map(servers.map((m) => [m.id, 0]));
  let canCall = false;
  let best: { places: number; target: TicketState } | null = null;
  for (const candidate of after) {
    let counted = false;
    for (const server of servers) {
      if (canServe(state, server, candidate)) {
        lost.set(server.id, (lost.get(server.id) ?? 0) + 1);
        counted = true;
      }
    }
    const places = Math.max(...lost.values());
    if (places > remaining) break;
    canCall ||= callable.has(candidate.id);
    if (canCall && counted) best = { places, target: candidate };
  }
  return best;
}

/**
 * Transition 3 (H5): the late client goes back to `waiting` at the position
 * chosen by `postponement`, and this stylist's next ticket is called. Ranks
 * are permuted inside the moved slice only, so no other ticket moves back.
 */
function takeNext(
  state: QueueState,
  command: Extract<Command, { command: 'take_next' }>,
  now: Instant,
): Handled {
  const found = staffTicket(state, command.actor, command.payload.ticket_id);
  if (typeof found === 'string') return found;
  const { member, ticket } = found;
  if (ticket.status !== 'called') return 'invalid_transition';
  if (ticket.assigned_member_id !== member.id) return 'not_assigned_to_you';
  if (ticket.eta_response !== 'late') return 'invalid_transition';
  if (ticket.postpone_count >= MAX_POSTPONE) return 'postpone_limit_reached';
  const move = postponement(state, member, ticket, now);
  if (!move) return 'no_eligible_ticket';
  const { places, target } = move;

  const slice = state.tickets
    .filter(
      (t) =>
        t.queue_rank >= ticket.queue_rank && t.queue_rank <= target.queue_rank,
    )
    .sort((a, b) => a.queue_rank - b.queue_rank);
  const ranks = slice.map((t) => t.queue_rank);
  const reordered = [...slice.filter((t) => t.id !== ticket.id), ticket];
  const newRank = new Map(reordered.map((t, i) => [t.id, ranks[i] as number]));

  let next: QueueState = {
    ...state,
    tickets: state.tickets.map((t) => {
      const rank = newRank.get(t.id);
      return rank === undefined || rank === t.queue_rank
        ? t
        : { ...t, queue_rank: rank };
    }),
  };
  next = patchTicket(next, ticket.id, {
    status: 'waiting',
    assigned_member_id: null,
    postpone_count: ticket.postpone_count + places,
    ...CLEARED_CALL,
  });
  const nextTicket = pickNextTicket(next, member.id, now) as TicketState;
  next = patchTicket(
    next,
    nextTicket.id,
    callPatch(next, nextTicket, member.id, now),
  );
  const who = identityOf(state, command.actor);
  return {
    state: next,
    events: [
      ticketEvent(who, 'postponed', ticket.id, 'client_late'),
      ticketEvent(who, 'called', nextTicket.id),
    ],
  };
}

// --- client commands ---------------------------------------------------------

function respondEta(
  state: QueueState,
  command: Extract<Command, { command: 'respond_eta' }>,
  now: Instant,
): Handled {
  const ticket = clientTicket(state, command.actor, command.payload.ticket_id);
  if (typeof ticket === 'string') return ticket;
  if (ticket.status !== 'waiting') return 'invalid_transition';
  const who = identityOf(state, command.actor);
  const { response, delay_minutes: delay } = command.payload;
  const answered = ticketEvent(who, 'eta_responded', ticket.id, response);
  if (response === 'cancel') {
    return {
      state: patchTicket(
        state,
        ticket.id,
        cancel(ticket, 'client_cancelled', now),
      ),
      events: [
        answered,
        ticketEvent(who, 'cancelled', ticket.id, 'client_cancelled'),
      ],
    };
  }
  if (response === 'on_time') {
    return {
      state: patchTicket(state, ticket.id, {
        eta_response: 'on_time',
        declared_delay_minutes: null,
        declared_arrival_at:
          ticket.eta_response === 'late' ? null : ticket.declared_arrival_at,
      }),
      events: [answered],
    };
  }
  if (
    delay === null ||
    !Number.isInteger(delay) ||
    delay < MIN_DELAY_MINUTES ||
    delay > MAX_DELAY_MINUTES
  ) {
    return 'invalid_delay';
  }
  // K13 / K43: announced arrival = time announced at T-30 (or current estimate) + delay.
  const base =
    ticket.t30_estimated_start_at ?? ticket.estimated_start_at ?? now;
  return {
    state: patchTicket(state, ticket.id, {
      eta_response: 'late',
      declared_delay_minutes: delay,
      declared_arrival_at: base + delay * MINUTE,
    }),
    events: [answered],
  };
}

function cancelTicket(
  state: QueueState,
  command: Extract<Command, { command: 'cancel_ticket' }>,
  now: Instant,
): Handled {
  const ticket = clientTicket(state, command.actor, command.payload.ticket_id);
  if (typeof ticket === 'string') return ticket;
  if (ticket.status === 'cancelled') return 'already_resolved';
  if (!isActiveStatus(ticket.status) || ticket.status === 'in_service') {
    return 'invalid_transition';
  }
  return {
    state: patchTicket(
      state,
      ticket.id,
      cancel(ticket, 'client_cancelled', now),
    ),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'cancelled',
        ticket.id,
        'client_cancelled',
      ),
    ],
  };
}

function resolveStylistChange(
  state: QueueState,
  command: Extract<Command, { command: 'resolve_stylist_change' }>,
): Handled {
  const ticket = clientTicket(state, command.actor, command.payload.ticket_id);
  if (typeof ticket === 'string') return ticket;
  if (!isActiveStatus(ticket.status)) return 'invalid_transition';
  if (ticket.stylist_change_pending_since === null) return 'already_resolved';
  const { choice } = command.payload;
  if (choice === 'wait' && !waitOffered(state, ticket))
    return 'wait_not_offered';
  return {
    state: patchTicket(state, ticket.id, {
      stylist_change_pending_since: null,
      ...(choice === 'first_available' ? { requested_member_id: null } : {}),
    }),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'stylist_change_resolved',
        ticket.id,
        choice,
      ),
    ],
  };
}

function respondEndOfDay(
  state: QueueState,
  command: Extract<Command, { command: 'respond_end_of_day' }>,
  now: Instant,
): Handled {
  const ticket = clientTicket(state, command.actor, command.payload.ticket_id);
  if (typeof ticket === 'string') return ticket;
  if (!isActiveStatus(ticket.status) || ticket.end_of_day_warned_at === null) {
    return 'invalid_transition';
  }
  if (ticket.end_of_day_choice !== null) return 'already_resolved';
  const who = identityOf(state, command.actor);
  const { choice } = command.payload;
  const answered = ticketEvent(who, 'end_of_day_responded', ticket.id, choice);
  if (choice === 'stay') {
    return {
      state: patchTicket(state, ticket.id, { end_of_day_choice: 'stay' }),
      events: [answered],
    };
  }
  return {
    state: patchTicket(state, ticket.id, {
      ...cancel(ticket, 'client_cancelled', now),
      end_of_day_choice: 'cancel',
    }),
    events: [
      answered,
      ticketEvent(who, 'cancelled', ticket.id, 'client_cancelled'),
    ],
  };
}

// --- manager commands -------------------------------------------------------

function removeTicket(
  state: QueueState,
  command: Extract<Command, { command: 'remove_ticket' }>,
  now: Instant,
): Handled {
  const boss = manager(state, command.actor);
  if (typeof boss === 'string') return boss;
  const ticket = findTicket(state, command.payload.ticket_id);
  if (!ticket) return 'ticket_other_salon';
  const reason = REMOVAL_REASONS.find((r) => r === command.payload.reason_code);
  if (!reason) return 'invalid_payload';
  if (ticket.status !== 'waiting' && ticket.status !== 'called') {
    return 'invalid_transition';
  }
  return {
    state: patchTicket(state, ticket.id, {
      ...cancel(ticket, 'removed_by_salon', now),
      removal_reason: reason,
    }),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'cancelled',
        ticket.id,
        reason,
      ),
    ],
  };
}

// --- appointments (H10, transitions 1 and 1b) ------------------------------

interface Slot {
  readonly duration_minutes: number;
  readonly warnings: readonly string[];
}

/**
 * Checks an appointment slot (E26): today, not too far in the past, a
 * stylist who cuts hair, a service he masters, within opening hours, and no
 * overlap measured on the service duration (back to back is accepted).
 */
function slotError(
  state: QueueState,
  now: Instant,
  p: {
    readonly member_id: string;
    readonly scheduled_at: Instant;
    readonly service_id: string | null;
    readonly duration_minutes?: number | undefined;
    readonly exclude_id: string | null;
    readonly check_past: boolean;
  },
): QueueErrorCode | Slot {
  if (!Number.isFinite(p.scheduled_at)) return 'invalid_payload';
  if (p.scheduled_at >= state.salon.service_day.ends_at) {
    return 'appointment_not_today';
  }
  if (
    p.check_past &&
    p.scheduled_at < now - PAST_APPOINTMENT_TOLERANCE_MINUTES * MINUTE
  ) {
    return 'appointment_in_past';
  }
  const member = findMember(state, p.member_id);
  if (!member || member.status !== 'active' || !member.is_hairdressing) {
    return 'stylist_unavailable';
  }
  const service = findService(state, p.service_id);
  if (p.service_id !== null && (!service || !service.is_active)) {
    return 'service_unavailable';
  }
  if (!masters(member, service)) return 'service_unavailable';
  const duration =
    p.duration_minutes ?? service?.duration_minutes ?? UNKNOWN_SERVICE_MINUTES;
  const end = p.scheduled_at + duration * MINUTE;
  const inHours = state.salon.service_day.opening_ranges.some(
    (r) => p.scheduled_at >= r.opens_at && end <= r.closes_at,
  );
  if (!inHours) return 'outside_opening_hours';
  const overlaps = state.tickets.some(
    (t) =>
      t.id !== p.exclude_id &&
      t.kind === 'appointment' &&
      t.status === 'waiting' &&
      t.assigned_member_id === p.member_id &&
      t.scheduled_at !== null &&
      p.scheduled_at < t.scheduled_at + durationOf(t) &&
      t.scheduled_at < end,
  );
  if (overlaps) return 'appointment_overlap';
  return {
    duration_minutes: duration,
    warnings: member.presence.status === 'absent' ? ['stylist_absent'] : [],
  };
}

/** The manager, or the stylist the appointment belongs to. */
function appointmentActor(
  state: QueueState,
  actor: Actor,
  stylistId: string | null,
): MemberState | QueueErrorCode {
  const member = activeMember(state, actor);
  if (typeof member === 'string') return member;
  return member.role === 'manager' || member.id === stylistId
    ? member
    : 'forbidden';
}

/** First estimate of a new waiting ticket: the reference of later changes (E11). */
function seedEstimate(
  state: QueueState,
  ticketId: string,
  now: Instant,
): QueueState {
  const estimate = computeSchedule(state, now).tickets[ticketId];
  const start = estimate?.estimated_start_at ?? null;
  return patchTicket(state, ticketId, {
    estimated_start_at: start,
    estimated_member_id: estimate?.estimated_member_id ?? null,
    initial_estimated_start_at: start,
    last_notified_start_at: start,
    estimate_version: start === null ? 0 : 1,
  });
}

function nextRank(state: QueueState): number {
  return Math.max(0, ...state.tickets.map((t) => t.queue_rank)) + 1;
}

function createAppointment(
  state: QueueState,
  command: Extract<Command, { command: 'create_appointment' }>,
  now: Instant,
): Handled {
  const { payload } = command;
  const actor = appointmentActor(state, command.actor, payload.member_id);
  if (typeof actor === 'string') return actor;
  if (findTicket(state, payload.ticket_id)) return 'invalid_payload';
  if (payload.phone_has_active_ticket) return 'already_has_active_ticket';
  const slot = slotError(state, now, {
    member_id: payload.member_id,
    scheduled_at: payload.scheduled_at,
    service_id: payload.service_id,
    exclude_id: null,
    check_past: true,
  });
  if (typeof slot === 'string') return slot;
  const ticket: TicketState = {
    ...newTicket({
      id: payload.ticket_id,
      service_date: state.salon.service_day.service_date,
      short_code: payload.short_code,
      client_id: null,
      channel: 'front_desk',
      service_id: payload.service_id,
      planned_duration_minutes: slot.duration_minutes,
      requested_member_id: null,
      queue_rank: nextRank(state),
      declared_arrival_at: null,
      notifications_consent_at: null,
      created_by_member_id: actor.id,
      created_at: now,
    }),
    kind: 'appointment',
    scheduled_at: payload.scheduled_at,
    appointment_source: 'salon_entry',
    assigned_member_id: payload.member_id,
  };
  const next = seedEstimate(
    { ...state, tickets: [...state.tickets, ticket] },
    ticket.id,
    now,
  );
  return {
    state: next,
    events: [
      ticketEvent(identityOf(state, command.actor), 'created', ticket.id),
    ],
    warnings: slot.warnings,
  };
}

function updateAppointment(
  state: QueueState,
  command: Extract<Command, { command: 'update_appointment' }>,
  now: Instant,
): Handled {
  const { payload } = command;
  const ticket = findTicket(state, payload.ticket_id);
  if (!ticket) return 'ticket_other_salon';
  const actor = appointmentActor(
    state,
    command.actor,
    ticket.assigned_member_id,
  );
  if (typeof actor === 'string') return actor;
  if (
    actor.role !== 'manager' &&
    payload.member_id !== undefined &&
    payload.member_id !== actor.id
  ) {
    return 'forbidden';
  }
  if (
    ticket.kind !== 'appointment' ||
    ticket.status !== 'waiting' ||
    ticket.scheduled_at === null ||
    ticket.assigned_member_id === null
  ) {
    return 'appointment_not_editable';
  }
  const memberId = payload.member_id ?? ticket.assigned_member_id;
  const scheduledAt = payload.scheduled_at ?? ticket.scheduled_at;
  const serviceId =
    payload.service_id === undefined ? ticket.service_id : payload.service_id;
  const timeChanged = scheduledAt !== ticket.scheduled_at;
  const serviceChanged = serviceId !== ticket.service_id;
  if (
    !timeChanged &&
    !serviceChanged &&
    memberId === ticket.assigned_member_id
  ) {
    return { state, events: [], changed: false };
  }
  const slot = slotError(state, now, {
    member_id: memberId,
    scheduled_at: scheduledAt,
    service_id: serviceId,
    duration_minutes: serviceChanged
      ? undefined
      : ticket.planned_duration_minutes,
    exclude_id: ticket.id,
    check_past: timeChanged,
  });
  if (typeof slot === 'string') return slot;
  return {
    state: patchTicket(state, ticket.id, {
      scheduled_at: scheduledAt,
      assigned_member_id: memberId,
      service_id: serviceId,
      planned_duration_minutes: slot.duration_minutes,
    }),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'appointment_updated',
        ticket.id,
      ),
    ],
    warnings: slot.warnings,
  };
}

function cancelAppointment(
  state: QueueState,
  command: Extract<Command, { command: 'cancel_appointment' }>,
  now: Instant,
): Handled {
  const ticket = findTicket(state, command.payload.ticket_id);
  if (!ticket) return 'ticket_other_salon';
  const actor = appointmentActor(
    state,
    command.actor,
    ticket.assigned_member_id,
  );
  if (typeof actor === 'string') return actor;
  const reason = REMOVAL_REASONS.find((r) => r === command.payload.reason_code);
  if (!reason) return 'invalid_payload';
  if (ticket.kind !== 'appointment' || ticket.status !== 'waiting') {
    return 'appointment_not_editable';
  }
  return {
    state: patchTicket(state, ticket.id, {
      ...cancel(ticket, 'removed_by_salon', now),
      removal_reason: reason,
    }),
    events: [
      ticketEvent(
        identityOf(state, command.actor),
        'cancelled',
        ticket.id,
        reason,
      ),
    ],
  };
}

function checkInAppointment(
  state: QueueState,
  command: Extract<Command, { command: 'check_in_appointment' }>,
  now: Instant,
): Handled {
  const { actor, payload } = command;
  if (actor.type !== 'client') return 'forbidden';
  const closed = queueOpenError(state, now);
  if (closed) return closed;
  if (findTicket(state, payload.ticket_id)) return 'invalid_payload';
  const hasActive =
    payload.has_active_ticket_elsewhere ||
    state.tickets.some(
      (t) => isActiveStatus(t.status) && t.client_id === actor.profile_id,
    );
  if (hasActive) return 'already_has_active_ticket';
  if (!Number.isFinite(payload.scheduled_at)) return 'invalid_payload';
  const service = findService(state, payload.service_id);
  if (payload.service_id !== null && (!service || !service.is_active)) {
    return 'service_unavailable';
  }
  const requested = requestedError(state, payload.member_id, now);
  if (requested) return requested;
  const duration = service?.duration_minutes ?? UNKNOWN_SERVICE_MINUTES;
  const inHours = state.salon.service_day.opening_ranges.some(
    (r) =>
      payload.scheduled_at >= r.opens_at &&
      payload.scheduled_at + duration * MINUTE <= r.closes_at,
  );
  if (!inHours) return 'outside_opening_hours';
  const ticket: TicketState = {
    ...newTicket({
      id: payload.ticket_id,
      service_date: state.salon.service_day.service_date,
      short_code: payload.short_code,
      client_id: actor.profile_id,
      channel: 'qr',
      service_id: payload.service_id,
      planned_duration_minutes: duration,
      requested_member_id: payload.member_id,
      queue_rank: nextRank(state),
      declared_arrival_at: null,
      notifications_consent_at: payload.notifications_consent ? now : null,
      created_by_member_id: null,
      created_at: now,
    }),
    kind: 'appointment',
    scheduled_at: payload.scheduled_at,
    appointment_source: 'client_check_in',
    status: 'pending_confirmation',
  };
  return {
    state: { ...state, tickets: [...state.tickets, ticket] },
    events: [
      ticketEvent(
        identityOf(state, actor),
        'appointment_checked_in',
        ticket.id,
      ),
    ],
  };
}

function confirmAppointment(
  state: QueueState,
  command: Extract<Command, { command: 'confirm_appointment' }>,
  now: Instant,
): Handled {
  const { payload } = command;
  const ticket = findTicket(state, payload.ticket_id);
  if (!ticket) return 'ticket_other_salon';
  const actor = activeMember(state, command.actor);
  if (typeof actor === 'string') return actor;
  const mayDecide =
    actor.role === 'manager' ||
    ticket.requested_member_id === actor.id ||
    (ticket.requested_member_id === null &&
      (payload.decision === 'reject' || payload.member_id === actor.id));
  if (!mayDecide) return 'forbidden';
  if (ticket.kind !== 'appointment') return 'invalid_payload';
  if (ticket.status !== 'pending_confirmation') return 'already_resolved';
  const who = identityOf(state, command.actor);

  if (payload.decision === 'reject') {
    const reason = REMOVAL_REASONS.find((r) => r === payload.reason_code);
    if (!reason) return 'invalid_payload';
    return {
      state: patchTicket(state, ticket.id, {
        ...cancel(ticket, 'appointment_rejected', now),
        removal_reason: reason,
      }),
      events: [ticketEvent(who, 'appointment_rejected', ticket.id, reason)],
    };
  }

  const memberId = payload.member_id ?? ticket.requested_member_id;
  if (memberId === null) return 'member_required';
  const scheduledAt = ticket.scheduled_at as Instant;
  const confirmation = {
    confirmed_at: now,
    confirmed_by_member_id: actor.id,
  };

  if (payload.merge_into_ticket_id !== undefined) {
    const target = findTicket(state, payload.merge_into_ticket_id);
    if (!target) return 'ticket_other_salon';
    if (
      target.id === ticket.id ||
      target.kind !== 'appointment' ||
      target.appointment_source !== 'salon_entry' ||
      target.status !== 'waiting' ||
      target.assigned_member_id !== memberId
    ) {
      return 'invalid_merge_target';
    }
    // The salon's ticket survives and takes over the client and his consent.
    const merged = patchTicket(state, target.id, {
      client_id: ticket.client_id,
      notifications_consent_at: ticket.notifications_consent_at,
      ...confirmation,
    });
    return {
      state: patchTicket(merged, ticket.id, cancel(ticket, 'merged', now)),
      events: [
        ticketEvent(who, 'appointment_merged', ticket.id),
        ticketEvent(who, 'appointment_confirmed', target.id),
      ],
    };
  }

  const slot = slotError(state, now, {
    member_id: memberId,
    scheduled_at: scheduledAt,
    service_id: ticket.service_id,
    duration_minutes: ticket.planned_duration_minutes,
    exclude_id: ticket.id,
    check_past: false,
  });
  if (typeof slot === 'string') return slot;
  return {
    state: seedEstimate(
      patchTicket(state, ticket.id, {
        status: 'waiting',
        assigned_member_id: memberId,
        ...confirmation,
      }),
      ticket.id,
      now,
    ),
    events: [ticketEvent(who, 'appointment_confirmed', ticket.id)],
    warnings: slot.warnings,
  };
}

/** Requests the stylist choice of transition 8 for the given tickets. */
// --- reassignment (E9, E27) ---------------------------------------------------

/** Estimated start of the ticket if `memberId` served it, the rest unchanged. */
function startWith(
  state: QueueState,
  ticket: TicketState,
  memberId: string,
  now: Instant,
): Instant | null {
  const moved = patchTicket(
    state,
    ticket.id,
    ticket.kind === 'appointment'
      ? { assigned_member_id: memberId }
      : { requested_member_id: memberId },
  );
  return (
    computeSchedule(moved, now).tickets[ticket.id]?.estimated_start_at ?? null
  );
}

function reassignError(
  state: QueueState,
  ticket: TicketState,
  memberId: string,
  now: Instant,
): QueueErrorCode | null {
  const target = findMember(state, memberId);
  if (!target || !worksToday(target, now)) return 'stylist_unavailable';
  if (!masters(target, findService(state, ticket.service_id))) {
    return 'stylist_unavailable';
  }
  if (ticket.kind === 'appointment' && ticket.scheduled_at !== null) {
    const end = ticket.scheduled_at + durationOf(ticket) * MINUTE;
    const clash = state.tickets.some(
      (t) =>
        t.id !== ticket.id &&
        t.kind === 'appointment' &&
        t.status === 'waiting' &&
        t.assigned_member_id === memberId &&
        t.scheduled_at !== null &&
        t.scheduled_at < end &&
        t.scheduled_at + durationOf(t) * MINUTE > ticket.scheduled_at!,
    );
    if (clash) return 'appointment_overlap';
  }
  return null;
}

const NO_REASSIGNMENT = {
  reassignment_member_id: null,
  reassignment_requested_at: null,
  reassignment_proposed_start_at: null,
} as const;

function applyReassignment(
  state: QueueState,
  ticket: TicketState,
  memberId: string,
): QueueState {
  return patchTicket(state, ticket.id, {
    ...NO_REASSIGNMENT,
    ...(ticket.kind === 'appointment'
      ? { assigned_member_id: memberId }
      : { requested_member_id: memberId, stylist_change_pending_since: null }),
  });
}

function askReassignment(
  state: QueueState,
  who: ActorIdentity,
  ticket: TicketState,
  memberId: string,
  proposed: Instant,
  now: Instant,
): Step {
  return {
    state: patchTicket(state, ticket.id, {
      reassignment_member_id: memberId,
      reassignment_requested_at: now,
      reassignment_proposed_start_at: proposed,
    }),
    events: [ticketEvent(who, 'reassignment_requested', ticket.id, memberId)],
  };
}

function reassignTicket(
  state: QueueState,
  command: Extract<Command, { command: 'reassign_ticket' }>,
  now: Instant,
): Handled {
  const actor = manager(state, command.actor);
  if (typeof actor === 'string') return actor;
  const { ticket_id, member_id } = command.payload;
  const ticket = findTicket(state, ticket_id);
  if (!ticket) return 'ticket_other_salon';
  if (ticket.status !== 'waiting') return 'invalid_transition';
  if (ticket.reassignment_requested_at !== null) return 'reassignment_pending';
  const error = reassignError(state, ticket, member_id, now);
  if (error) return error;
  const current =
    computeSchedule(state, now).tickets[ticket.id]?.estimated_start_at ?? null;
  const proposed = startWith(state, ticket, member_id, now);
  if (proposed === null) return 'stylist_unavailable';
  const who = identityOf(state, command.actor);
  if (current === null || proposed <= current) {
    return {
      state: applyReassignment(state, ticket, member_id),
      events: [ticketEvent(who, 'reassigned', ticket.id, member_id)],
    };
  }
  return askReassignment(state, who, ticket, member_id, proposed, now);
}

function respondReassignment(
  state: QueueState,
  command: Extract<Command, { command: 'respond_reassignment' }>,
  now: Instant,
): Handled {
  const ticket = clientTicket(state, command.actor, command.payload.ticket_id);
  if (typeof ticket === 'string') return ticket;
  const memberId = ticket.reassignment_member_id;
  const asked = ticket.reassignment_proposed_start_at;
  if (ticket.status !== 'waiting' || memberId === null || asked === null) {
    return 'already_resolved';
  }
  const who = identityOf(state, command.actor);
  const resolved = (result: string) =>
    ticketEvent(who, 'reassignment_resolved', ticket.id, result);
  if (command.payload.choice === 'refuse') {
    return {
      state: patchTicket(state, ticket.id, NO_REASSIGNMENT),
      events: [resolved('refused')],
    };
  }
  const error = reassignError(state, ticket, memberId, now);
  if (error) return error;
  const proposed = startWith(state, ticket, memberId, now);
  if (proposed === null) return 'stylist_unavailable';
  if (proposed >= asked + REASSIGNMENT_TOLERANCE_MINUTES * MINUTE) {
    return askReassignment(state, who, ticket, memberId, proposed, now);
  }
  return {
    state: applyReassignment(state, ticket, memberId),
    events: [
      ticketEvent(who, 'reassigned', ticket.id, memberId),
      resolved('accepted'),
    ],
  };
}

function requestChoice(
  state: QueueState,
  who: ActorIdentity,
  tickets: readonly TicketState[],
  now: Instant,
  renew: boolean,
): Step {
  let next = state;
  const events: QueueEvent[] = [];
  for (const ticket of tickets) {
    if (ticket.stylist_change_pending_since !== null && !renew) continue;
    next = patchTicket(next, ticket.id, { stylist_change_pending_since: now });
    events.push(ticketEvent(who, 'stylist_change_requested', ticket.id));
  }
  return { state: next, events };
}

const waitingFor = (state: QueueState, memberId: string): TicketState[] =>
  state.tickets.filter(
    (t) =>
      t.status === 'waiting' &&
      t.kind === 'queue' &&
      t.requested_member_id === memberId,
  );

function presencePayload(
  command: Extract<Command, { command: 'set_presence' }>,
  now: Instant,
): PresenceState | null {
  const { status, break_type, until, shift_end_at } = command.payload;
  const base: PresenceState = {
    status,
    status_since: now,
    break_type: null,
    expected_back_at: null,
    shift_end_at: null,
  };
  switch (status) {
    case 'available':
    case 'absent':
      return base;
    case 'on_break':
      return break_type !== null && until !== null && until > now
        ? { ...base, break_type, expected_back_at: until }
        : null;
    case 'late':
      return until !== null && until > now
        ? { ...base, expected_back_at: until }
        : null;
    case 'off_duty':
      return {
        ...base,
        shift_end_at:
          shift_end_at !== null && shift_end_at > now ? shift_end_at : now,
      };
    case 'in_service':
    case 'offline':
      return null;
  }
}

/**
 * `set_presence` (PRD §5.2 « Statuts du coiffeur »): late and absent are
 * declared by the manager; a break triggers no choice (E25); absent, late or
 * leaving early asks the clients who requested him (transition 8, E7); his
 * called client goes back to the head (E6); his client in service stays for
 * the manager to complete.
 */
function setPresence(
  state: QueueState,
  command: Extract<Command, { command: 'set_presence' }>,
  now: Instant,
): Handled {
  const actor = activeMember(state, command.actor);
  if (typeof actor === 'string') return actor;
  const target = findMember(state, command.payload.member_id);
  if (!target) return 'invalid_payload';
  const status = command.payload.status;
  if (
    actor.role !== 'manager' &&
    (target.id !== actor.id || status === 'late' || status === 'absent')
  ) {
    return 'forbidden';
  }
  const presence = presencePayload(command, now);
  if (!presence) return 'invalid_payload';
  const busy = busyTicketOf(state, target.id);
  if (status === 'on_break' && busy) return 'invalid_transition';

  const who = identityOf(state, command.actor);
  let next = patchMember(state, target.id, { presence });
  const events: QueueEvent[] = [
    salonEvent(who, 'presence_changed', target.id, status),
  ];

  const unavailableNow =
    status === 'absent' ||
    status === 'late' ||
    (status === 'off_duty' && (presence.shift_end_at ?? now) <= now);
  if (busy?.status === 'called' && unavailableNow) {
    next = patchTicket(next, busy.id, returnToHead(now));
  }

  let choice: Step | null = null;
  if (status === 'absent') {
    choice = requestChoice(next, who, waitingFor(next, target.id), now, true);
  } else if (status === 'late') {
    choice = requestChoice(next, who, waitingFor(next, target.id), now, false);
  } else if (status === 'off_duty') {
    const schedule = computeSchedule(next, now);
    const shiftEnd = presence.shift_end_at ?? now;
    const exceeding = waitingFor(next, target.id).filter((t) => {
      const start = schedule.tickets[t.id]?.estimated_start_at ?? null;
      return start === null || start + durationOf(t) > shiftEnd;
    });
    choice = requestChoice(next, who, exceeding, now, false);
  }
  if (choice) {
    next = choice.state;
    events.push(...choice.events);
  }
  return { state: next, events };
}

/** « Je coiffe » (S-02): switched off, his clients choose without « attendre » (E8). */
function setHairdressing(
  state: QueueState,
  command: Extract<Command, { command: 'set_hairdressing' }>,
  now: Instant,
): Handled {
  const boss = manager(state, command.actor);
  if (typeof boss === 'string') return boss;
  const on = command.payload.is_hairdressing;
  if (boss.is_hairdressing === on) return { state, events: [], changed: false };
  const who = identityOf(state, command.actor);
  const next = patchMember(state, boss.id, { is_hairdressing: on });
  const events: QueueEvent[] = [
    salonEvent(who, 'hairdressing_toggled', boss.id, on ? 'on' : 'off'),
  ];
  if (on) return { state: next, events };
  const choice = requestChoice(next, who, waitingFor(next, boss.id), now, true);
  return { state: choice.state, events: [...events, ...choice.events] };
}

function setQueueStatus(
  state: QueueState,
  command: Extract<Command, { command: 'set_queue_status' }>,
): Handled {
  const boss = manager(state, command.actor);
  if (typeof boss === 'string') return boss;
  if (state.salon.status !== 'published') return 'salon_not_published';
  const status = command.payload.status;
  if (state.salon.queue_status === status)
    return { state, events: [], changed: false };
  const type =
    status === 'open'
      ? 'queue_opened'
      : status === 'paused'
        ? 'queue_paused'
        : 'queue_closed';
  return {
    // Closing the queue cancels nobody: only the end of day does (H9).
    state: { ...state, salon: { ...state.salon, queue_status: status } },
    events: [salonEvent(identityOf(state, command.actor), type, null)],
  };
}

/** H9 at closing: « Servir » or « Annuler avec excuses » for the remaining waiting clients. */
function resolveClosing(
  state: QueueState,
  command: Extract<Command, { command: 'resolve_closing' }>,
  now: Instant,
): Handled {
  const boss = manager(state, command.actor);
  if (typeof boss === 'string') return boss;
  const { ticket_ids, decision } = command.payload;
  const tickets = ticket_ids.map((id) => findTicket(state, id));
  if (tickets.length === 0 || tickets.some((t) => t === undefined)) {
    return 'invalid_payload';
  }
  const closing = lastClosingAt(state.salon.service_day);
  if (closing === null || now < closing) return 'closing_not_reached';
  if (tickets.some((t) => t?.status !== 'waiting')) return 'invalid_transition';
  const who = identityOf(state, command.actor);
  let next = state;
  const events: QueueEvent[] = [];
  for (const ticket of tickets as TicketState[]) {
    if (decision === 'serve') {
      next = patchTicket(next, ticket.id, { closing_decision: 'serve' });
    } else {
      next = patchTicket(next, ticket.id, {
        ...cancel(ticketOrThrow(next, ticket.id), 'end_of_day', now),
        closing_decision: 'cancel',
      });
      events.push(ticketEvent(who, 'cancelled', ticket.id, 'end_of_day'));
    }
  }
  events.push(salonEvent(who, 'closing_resolved', null, decision));
  return { state: next, events };
}

// --- entry point --------------------------------------------------------------

function handle(state: QueueState, command: Command, now: Instant): Handled {
  switch (command.command) {
    case 'join_queue':
      return joinQueue(state, command, now);
    case 'register_walk_in':
      return registerWalkIn(state, command, now);
    case 'call_ticket':
      return callTicket(state, command, now);
    case 'confirm_arrival':
      return confirmArrival(state, command, now);
    case 'start_service':
      return startService(state, command, now);
    case 'adjust_duration':
      return adjustDuration(state, command);
    case 'complete_service':
      return completeService(state, command, now);
    case 'take_next':
      return takeNext(state, command, now);
    case 'respond_eta':
      return respondEta(state, command, now);
    case 'cancel_ticket':
      return cancelTicket(state, command, now);
    case 'remove_ticket':
      return removeTicket(state, command, now);
    case 'create_appointment':
      return createAppointment(state, command, now);
    case 'update_appointment':
      return updateAppointment(state, command, now);
    case 'cancel_appointment':
      return cancelAppointment(state, command, now);
    case 'check_in_appointment':
      return checkInAppointment(state, command, now);
    case 'confirm_appointment':
      return confirmAppointment(state, command, now);
    case 'set_presence':
      return setPresence(state, command, now);
    case 'reassign_ticket':
      return reassignTicket(state, command, now);
    case 'respond_reassignment':
      return respondReassignment(state, command, now);
    case 'resolve_stylist_change':
      return resolveStylistChange(state, command);
    case 'respond_end_of_day':
      return respondEndOfDay(state, command, now);
    case 'set_hairdressing':
      return setHairdressing(state, command, now);
    case 'set_queue_status':
      return setQueueStatus(state, command);
    case 'resolve_closing':
      return resolveClosing(state, command, now);
    default:
      return 'invalid_payload';
  }
}

/**
 * Applies one queue command at instant `now`. Returns the new state, the
 * audit events and the client notifications, or a `queue.*` error code
 * (TRD §6.2). Never reads the clock.
 */
export function applyCommand(
  state: QueueState,
  command: Command,
  now: Instant,
): CommandResult {
  const handled = handle(state, command, now);
  if (typeof handled === 'string')
    return { ok: false, error: { code: handled } };
  return { ok: true, ...finish(state, handled, now) };
}
