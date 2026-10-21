/** Immutable state helpers and event builders. */
import type {
  Actor,
  ActorType,
  Instant,
  MemberState,
  QueueState,
  SalonEvent,
  SalonEventType,
  TicketEvent,
  TicketEventType,
  TicketState,
} from './types.ts';

/** Columns cleared when a ticket leaves `called` (K31). */
export const CLEARED_CALL = {
  called_at: null,
  release_due_at: null,
  reminder_sent_at: null,
} as const;

export interface NewTicketFields {
  readonly id: string;
  readonly service_date: string;
  readonly short_code: string;
  readonly client_id: string | null;
  readonly channel: TicketState['channel'];
  readonly service_id: string | null;
  readonly planned_duration_minutes: number;
  readonly requested_member_id: string | null;
  readonly queue_rank: number;
  readonly declared_arrival_at: Instant | null;
  readonly notifications_consent_at: Instant | null;
  readonly created_by_member_id: string | null;
  readonly created_at: Instant;
}

/** A fresh waiting walk-in ticket (transition 1). */
export function newTicket(fields: NewTicketFields): TicketState {
  return {
    ...fields,
    kind: 'queue',
    scheduled_at: null,
    appointment_source: null,
    confirmed_at: null,
    confirmed_by_member_id: null,
    confirmation_reminder_sent_at: null,
    appointment_delay_warned_steps: 0,
    is_test: false,
    estimated_member_id: null,
    assigned_member_id: null,
    status: 'waiting',
    priority_since: null,
    call_count: 0,
    postpone_count: 0,
    eta_response: null,
    declared_delay_minutes: null,
    arrived_at: null,
    stylist_change_pending_since: null,
    reassignment_member_id: null,
    reassignment_requested_at: null,
    reassignment_proposed_start_at: null,
    estimated_start_at: null,
    last_notified_start_at: null,
    initial_estimated_start_at: null,
    t30_estimated_start_at: null,
    estimate_version: 0,
    turn_approaching_sent_at: null,
    get_ready_sent_at: null,
    called_at: null,
    release_due_at: null,
    reminder_sent_at: null,
    end_of_day_warned_at: null,
    end_of_day_choice: null,
    closing_decision: null,
    started_at: null,
    completed_at: null,
    actual_duration_minutes: null,
    cancelled_at: null,
    cancel_reason: null,
    removal_reason: null,
    no_show_at: null,
  };
}

export function patchTicket(
  state: QueueState,
  id: string,
  patch: Partial<TicketState>,
): QueueState {
  return {
    ...state,
    tickets: state.tickets.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

export function patchMember(
  state: QueueState,
  id: string,
  patch: Partial<MemberState>,
): QueueState {
  return {
    ...state,
    members: state.members.map((m) => (m.id === id ? { ...m, ...patch } : m)),
  };
}

export function ticketOrThrow(state: QueueState, id: string): TicketState {
  const ticket = state.tickets.find((t) => t.id === id);
  /* c8 ignore next */
  if (!ticket) throw new Error(`ticket ${id} vanished`);
  return ticket;
}

/** Audit identity of the actor (no free text, no personal data, K10). */
export interface ActorIdentity {
  readonly actor_type: ActorType;
  readonly actor_member_id: string | null;
  readonly actor_profile_id: string | null;
}

export const SYSTEM: ActorIdentity = {
  actor_type: 'system',
  actor_member_id: null,
  actor_profile_id: null,
};

export function identityOf(state: QueueState, actor: Actor): ActorIdentity {
  switch (actor.type) {
    case 'client':
      return {
        actor_type: 'client',
        actor_member_id: null,
        actor_profile_id: actor.profile_id,
      };
    case 'ticket_token':
      return {
        actor_type: 'client',
        actor_member_id: null,
        actor_profile_id: null,
      };
    case 'member': {
      const member = state.members.find((m) => m.id === actor.member_id);
      return {
        actor_type: member?.role ?? 'stylist',
        actor_member_id: actor.member_id,
        actor_profile_id: null,
      };
    }
    case 'system':
      return SYSTEM;
  }
}

export function ticketEvent(
  who: ActorIdentity,
  type: TicketEventType,
  ticket_id: string,
  reason_code: string | null = null,
): TicketEvent {
  return { scope: 'ticket', type, ticket_id, reason_code, ...who };
}

export function salonEvent(
  who: ActorIdentity,
  type: SalonEventType,
  subject_member_id: string | null,
  reason_code: string | null = null,
): SalonEvent {
  return { scope: 'salon', type, subject_member_id, reason_code, ...who };
}
