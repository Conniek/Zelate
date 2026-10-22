/**
 * State, command and result types of the queue engine.
 *
 * Names mirror BACKEND_SCHEMA v0.5 (§3 enums, §4.3 salons, §4.4 salon_members,
 * §4.9 services, §4.12 stylist_presence, §4.13 tickets) so that the shared
 * transaction module can map rows to state without renaming.
 *
 * Every instant is a UTC epoch in milliseconds (`Instant`). The engine never
 * reads the clock: `now` is always an argument. The service day (opening
 * ranges, midnight in Paris) is computed by the caller and passed as instants
 * (ADR-010), so daylight-saving days need no time-zone logic here.
 *
 * Privacy (H6, ADR-011, K10): the engine state holds no phone number, no
 * tracking token and no first name. Notification params and events carry
 * only structured values.
 */

/** UTC instant, in epoch milliseconds. */
export type Instant = number;

// ---------------------------------------------------------------------------
// Enumerations (BACKEND_SCHEMA §3)
// ---------------------------------------------------------------------------

export type SalonStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'suspended';

export type QueueStatus = 'closed' | 'open' | 'paused';
export type MemberRole = 'manager' | 'stylist';
export type MemberStatus = 'invited' | 'active' | 'deactivated';

export type PresenceStatus =
  | 'offline'
  | 'available'
  | 'in_service'
  | 'on_break'
  | 'late'
  | 'absent'
  | 'off_duty';

export type BreakType = 'meal' | 'short' | 'unexpected';

export type TicketStatus =
  | 'pending_confirmation'
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type TicketKind = 'queue' | 'appointment';
export type AppointmentSource = 'salon_entry' | 'client_check_in';
export type TicketChannel = 'app' | 'qr' | 'front_desk';
export type EtaResponse = 'on_time' | 'late';
export type EndOfDayChoice = 'stay' | 'cancel';
export type ClosingDecision = 'serve' | 'cancel';

export type CancelReason =
  | 'client_cancelled'
  | 'removed_by_salon'
  | 'stylist_unavailable'
  | 'end_of_day'
  | 'appointment_rejected'
  | 'merged';

export type RemovalReason =
  | 'emergency'
  | 'client_request'
  | 'duplicate'
  | 'inappropriate_behaviour'
  | 'other';

export const REMOVAL_REASONS: readonly RemovalReason[] = [
  'emergency',
  'client_request',
  'duplicate',
  'inappropriate_behaviour',
  'other',
];

export type ActorType = 'client' | 'stylist' | 'manager' | 'system' | 'admin';

export type TicketEventType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'estimate_changed'
  | 'eta_responded'
  | 'postponed'
  | 'stylist_change_requested'
  | 'stylist_change_resolved'
  | 'arrival_confirmed'
  | 'called'
  | 'service_started'
  | 'duration_adjusted'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'end_of_day_warned'
  | 'end_of_day_responded'
  | 'appointment_checked_in'
  | 'appointment_confirmed'
  | 'appointment_rejected'
  | 'appointment_merged'
  | 'appointment_updated'
  | 'appointment_delay_warned'
  | 'reassignment_requested'
  | 'reassignment_resolved';

export type SalonEventType =
  | 'queue_opened'
  | 'queue_paused'
  | 'queue_closed'
  | 'closing_resolved'
  | 'presence_changed'
  | 'hairdressing_toggled';

/** Client notification templates (BACKEND_SCHEMA §3 `notification_template`). */
export type NotificationTemplate =
  | 'ticket_created'
  | 'turn_approaching'
  | 'get_ready'
  | 'your_turn'
  | 'arrival_reminder'
  | 'released_no_show'
  | 'estimate_changed'
  | 'postponed'
  | 'stylist_change_required'
  | 'end_of_day_risk'
  | 'cancelled_by_salon'
  | 'appointment_confirmed'
  | 'appointment_rejected'
  | 'appointment_delay'
  | 'reassignment_request'
  | 'no_show_warning';

/** Anticipation templates: the only ones governed by « Me prévenir » (E17). */
export const ANTICIPATION_TEMPLATES: readonly NotificationTemplate[] = [
  'turn_approaching',
  'get_ready',
  'estimate_changed',
  'end_of_day_risk',
];

/** Reasons of an estimate change (BACKEND_SCHEMA §3, K26). */
export type EstimateChangeReason =
  | 'service_longer'
  | 'service_shorter'
  | 'client_ahead_left'
  | 'client_ahead_late'
  | 'client_postponed'
  | 'client_late'
  | 'stylist_break'
  | 'stylist_break_ended'
  | 'stylist_late'
  | 'stylist_unavailable'
  | 'stylist_available'
  | 'hairdressing_toggled'
  | 'reassigned'
  | 'stylist_choice'
  | 'appointment_ahead'
  | 'appointment_changed'
  | 'your_appointment_changed';

/** `queue.*` error codes used by the engine (TRD §6.2). */
export type QueueErrorCode =
  // common to every command
  | 'forbidden'
  | 'invalid_transition'
  | 'invalid_payload'
  // command-specific
  | 'queue_closed'
  | 'queue_paused'
  | 'queue_full'
  | 'already_has_active_ticket'
  | 'service_unavailable'
  | 'stylist_unavailable'
  | 'invalid_delay'
  | 'already_resolved'
  | 'wait_not_offered'
  | 'unknown_code'
  | 'ticket_other_salon'
  | 'ticket_closed'
  | 'appointment_overlap'
  | 'outside_opening_hours'
  | 'appointment_in_past'
  | 'appointment_not_today'
  | 'appointment_not_editable'
  | 'member_required'
  | 'invalid_merge_target'
  | 'no_eligible_ticket'
  | 'call_already_in_progress'
  | 'not_assigned_to_you'
  | 'postpone_limit_reached'
  | 'duration_limit_reached'
  | 'salon_not_published'
  | 'reassignment_pending'
  | 'closing_not_reached';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Per-salon settings (`salons` columns, BACKEND_SCHEMA §4.3). */
export interface SalonSettings {
  /** Reminder after the call (H4), default 5. */
  readonly reminder_after_minutes: number;
  /** Automatic release after the call (H4), default 10. */
  readonly auto_release_after_minutes: number;
  /** Start of the end-of-day window before the last closing (H9), default 120. */
  readonly end_of_day_warning_minutes: number;
  /** Delay after the last closing before remaining clients are cancelled, default 15. */
  readonly closing_grace_minutes: number;
}

export const DEFAULT_SALON_SETTINGS: SalonSettings = {
  reminder_after_minutes: 5,
  auto_release_after_minutes: 10,
  end_of_day_warning_minutes: 120,
  closing_grace_minutes: 15,
};

/** One opening range of the service day, as instants (several per day possible, S-03). */
export interface OpeningRange {
  readonly opens_at: Instant;
  readonly closes_at: Instant;
}

/**
 * The service day the state belongs to (ADR-010). Computed by the caller in
 * Europe/Paris and given as instants: the engine never converts time zones.
 */
export interface ServiceDay {
  /** `YYYY-MM-DD`, Paris date. */
  readonly service_date: string;
  /** Opening ranges of the day, current hours (E16), in any order. */
  readonly opening_ranges: readonly OpeningRange[];
  /** Next midnight in Paris: no ticket survives it (E24, invariant 9). */
  readonly ends_at: Instant;
}

export interface SalonState {
  readonly id: string;
  readonly status: SalonStatus;
  readonly queue_status: QueueStatus;
  readonly settings: SalonSettings;
  readonly service_day: ServiceDay;
  /** Incremented by every change written through the engine. */
  readonly queue_version: number;
  // Indicators computed by the engine (K36, E31).
  readonly waiting_count: number;
  readonly current_wait_minutes: number | null;
  readonly is_full: boolean;
  readonly estimate_updated_at: Instant | null;
}

/** `stylist_presence` row of the service day (PRD §5.2 « Statuts du coiffeur »). */
export interface PresenceState {
  readonly status: PresenceStatus;
  readonly status_since: Instant;
  readonly break_type: BreakType | null;
  /** End of break (`on_break`) or expected arrival (`late`). */
  readonly expected_back_at: Instant | null;
  /** Planned end of day (`off_duty`): no new client after it. */
  readonly shift_end_at: Instant | null;
}

export interface MemberState {
  readonly id: string;
  readonly role: MemberRole;
  readonly status: MemberStatus;
  /** « Je coiffe » (always true for a stylist). */
  readonly is_hairdressing: boolean;
  /** `member_specialties.specialty_code` values. */
  readonly specialties: readonly string[];
  /** Tie-break of distribution rule 2. */
  readonly served_today_count: number;
  readonly presence: PresenceState;
}

export interface ServiceState {
  readonly id: string;
  readonly duration_minutes: number;
  readonly required_specialty_code: string | null;
  readonly is_active: boolean;
}

/** Fields of `tickets` the engine reads or writes (BACKEND_SCHEMA §4.13). */
export interface TicketState {
  readonly id: string;
  readonly service_date: string;
  readonly short_code: string;
  readonly kind: TicketKind;
  /** Appointments only (step 2). */
  readonly scheduled_at: Instant | null;
  readonly appointment_source: AppointmentSource | null;
  /** A client check-in confirmed by the salon (transition 1b). */
  readonly confirmed_at: Instant | null;
  readonly confirmed_by_member_id: string | null;
  /** E19: reminder sent to the salon 10 min after an unconfirmed check-in. */
  readonly confirmation_reminder_sent_at: Instant | null;
  /** Last delay step warned (1 = 10 min, 2 = 20 min…), E23. */
  readonly appointment_delay_warned_steps: number;
  readonly client_id: string | null;
  readonly channel: TicketChannel;
  readonly is_test: boolean;
  readonly service_id: string | null;
  readonly planned_duration_minutes: number;
  readonly requested_member_id: string | null;
  readonly estimated_member_id: string | null;
  readonly assigned_member_id: string | null;
  readonly status: TicketStatus;
  readonly queue_rank: number;
  /** Called client put back at the head when his stylist became unavailable (E6, E36 default). */
  readonly priority_since: Instant | null;
  readonly call_count: number;
  readonly postpone_count: number;
  /** H8 arrival time, or T-30 estimate + declared delay (K13, K43). */
  readonly declared_arrival_at: Instant | null;
  readonly notifications_consent_at: Instant | null;
  readonly eta_response: EtaResponse | null;
  readonly declared_delay_minutes: number | null;
  readonly arrived_at: Instant | null;
  readonly stylist_change_pending_since: Instant | null;
  // Reassignment (S-13, U-17): read only in step 1.
  readonly reassignment_member_id: string | null;
  readonly reassignment_requested_at: Instant | null;
  readonly reassignment_proposed_start_at: Instant | null;
  // Estimates.
  readonly estimated_start_at: Instant | null;
  readonly last_notified_start_at: Instant | null;
  readonly initial_estimated_start_at: Instant | null;
  readonly t30_estimated_start_at: Instant | null;
  readonly estimate_version: number;
  // Time triggers.
  readonly turn_approaching_sent_at: Instant | null;
  readonly get_ready_sent_at: Instant | null;
  readonly called_at: Instant | null;
  readonly release_due_at: Instant | null;
  readonly reminder_sent_at: Instant | null;
  readonly end_of_day_warned_at: Instant | null;
  readonly end_of_day_choice: EndOfDayChoice | null;
  readonly closing_decision: ClosingDecision | null;
  // Service.
  readonly started_at: Instant | null;
  readonly completed_at: Instant | null;
  readonly actual_duration_minutes: number | null;
  // Closure.
  readonly cancelled_at: Instant | null;
  readonly cancel_reason: CancelReason | null;
  readonly removal_reason: RemovalReason | null;
  readonly no_show_at: Instant | null;
  readonly created_by_member_id: string | null;
  readonly created_at: Instant;
}

/** Everything the engine needs about one salon and one service day. */
export interface QueueState {
  readonly salon: SalonState;
  readonly members: readonly MemberState[];
  readonly services: readonly ServiceState[];
  /** Tickets of the service day (all statuses). */
  readonly tickets: readonly TicketState[];
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export interface TicketEstimate {
  readonly ticket_id: string;
  /** Estimated service start (`T_k`), rounded up to the minute; null if no stylist can take it. */
  readonly estimated_start_at: Instant | null;
  /** Requested stylist, or the stylist picked by the simulation (ADR-015). */
  readonly estimated_member_id: string | null;
  /** Displayed wait: max(T, declared arrival) − now, rounded up to 5 min (H2, H8). */
  readonly wait_minutes: number | null;
  /** Clients before him at his stylist (E13). */
  readonly position: number | null;
}

export interface SalonIndicators {
  /** Waiting clients in the salon (E31). */
  readonly waiting_count: number;
  /** Wait for a new « premier disponible » client, rounded up to 5 min (E31). */
  readonly current_wait_minutes: number | null;
  /** The next service would end after the last closing of the day (K36). */
  readonly is_full: boolean;
}

/** First hole that fits a service (E22); an indication, not a reservation. */
export interface FreeSlot {
  readonly service_id: string;
  readonly start_at: Instant;
  readonly member_id: string;
}

export interface Schedule {
  /** Keyed by ticket id, one entry per waiting ticket. */
  readonly tickets: Readonly<Record<string, TicketEstimate>>;
  readonly salon: SalonIndicators;
}

// ---------------------------------------------------------------------------
// Commands (TRD §6.2)
// ---------------------------------------------------------------------------

/** Who sends the command, resolved by `queue-command` from the session or the tracking token. */
export type Actor =
  | { readonly type: 'client'; readonly profile_id: string }
  | { readonly type: 'ticket_token'; readonly ticket_id: string }
  | { readonly type: 'member'; readonly member_id: string }
  | { readonly type: 'system' };

interface CommandOf<Name extends string, Payload> {
  readonly command: Name;
  readonly actor: Actor;
  readonly payload: Payload;
}

export type JoinQueueCommand = CommandOf<
  'join_queue',
  {
    /** Generated by the caller (randomness stays outside the engine). */
    readonly ticket_id: string;
    readonly short_code: string;
    /** null = « je ne sais pas encore » (30 min, E12). */
    readonly service_id: string | null;
    readonly requested_member_id: string | null;
    readonly declared_arrival_at: Instant | null;
    readonly channel: 'app' | 'qr';
    readonly notifications_consent: boolean;
    /** Active ticket of this client or phone in another salon, checked by the caller. */
    readonly has_active_ticket_elsewhere: boolean;
  }
>;

export type RegisterWalkInCommand = CommandOf<
  'register_walk_in',
  {
    readonly ticket_id: string;
    readonly short_code: string;
    readonly service_id: string | null;
    readonly requested_member_id: string | null;
    /** The caller checks the phone hash against every active ticket (ADR-011). */
    readonly phone_has_active_ticket: boolean;
  }
>;

export type CallTicketCommand = CommandOf<
  'call_ticket',
  Readonly<Record<string, never>>
>;
export type ConfirmArrivalCommand = CommandOf<
  'confirm_arrival',
  { readonly short_code: string }
>;
export type StartServiceCommand = CommandOf<
  'start_service',
  {
    readonly ticket_id: string;
    readonly service_id: string | null;
    readonly planned_duration_minutes: number;
  }
>;
export type AdjustDurationCommand = CommandOf<
  'adjust_duration',
  { readonly ticket_id: string; readonly delta_minutes: number }
>;
export type CompleteServiceCommand = CommandOf<
  'complete_service',
  { readonly ticket_id: string }
>;
export type TakeNextCommand = CommandOf<
  'take_next',
  { readonly ticket_id: string }
>;
export type RespondEtaCommand = CommandOf<
  'respond_eta',
  {
    readonly ticket_id: string;
    readonly response: 'on_time' | 'late' | 'cancel';
    readonly delay_minutes: number | null;
  }
>;
export type CancelTicketCommand = CommandOf<
  'cancel_ticket',
  { readonly ticket_id: string }
>;
export type RemoveTicketCommand = CommandOf<
  'remove_ticket',
  { readonly ticket_id: string; readonly reason_code: string }
>;
export type CreateAppointmentCommand = CommandOf<
  'create_appointment',
  {
    readonly ticket_id: string;
    readonly short_code: string;
    readonly scheduled_at: Instant;
    readonly member_id: string;
    readonly service_id: string | null;
    /** The caller checks the phone hash against every active ticket (ADR-011). */
    readonly phone_has_active_ticket: boolean;
  }
>;
export type UpdateAppointmentCommand = CommandOf<
  'update_appointment',
  {
    readonly ticket_id: string;
    readonly scheduled_at?: Instant;
    readonly member_id?: string;
    /** `null` = « je ne sais pas encore ». */
    readonly service_id?: string | null;
  }
>;
export type CancelAppointmentCommand = CommandOf<
  'cancel_appointment',
  { readonly ticket_id: string; readonly reason_code: string }
>;
export type CheckInAppointmentCommand = CommandOf<
  'check_in_appointment',
  {
    readonly ticket_id: string;
    readonly short_code: string;
    /** `scheduled_time` of the TRD, already turned into an instant of the day by the caller, who also checks the QR token. */
    readonly scheduled_at: Instant;
    /** null = « je ne sais plus ». */
    readonly member_id: string | null;
    readonly service_id: string | null;
    readonly notifications_consent: boolean;
    readonly has_active_ticket_elsewhere: boolean;
  }
>;
export type ConfirmAppointmentCommand = CommandOf<
  'confirm_appointment',
  {
    readonly ticket_id: string;
    readonly decision: 'confirm' | 'reject';
    readonly member_id?: string;
    readonly merge_into_ticket_id?: string;
    readonly reason_code?: string;
  }
>;
export type SetPresenceCommand = CommandOf<
  'set_presence',
  {
    readonly member_id: string;
    readonly status: PresenceStatus;
    readonly break_type: BreakType | null;
    /** End of break, or expected arrival when `late`. */
    readonly until: Instant | null;
    readonly shift_end_at: Instant | null;
  }
>;
export type ResolveStylistChangeCommand = CommandOf<
  'resolve_stylist_change',
  { readonly ticket_id: string; readonly choice: 'wait' | 'first_available' }
>;
export type ReassignTicketCommand = CommandOf<
  'reassign_ticket',
  { readonly ticket_id: string; readonly member_id: string }
>;
export type RespondReassignmentCommand = CommandOf<
  'respond_reassignment',
  { readonly ticket_id: string; readonly choice: 'accept' | 'refuse' }
>;
export type RespondEndOfDayCommand = CommandOf<
  'respond_end_of_day',
  { readonly ticket_id: string; readonly choice: EndOfDayChoice }
>;
export type SetHairdressingCommand = CommandOf<
  'set_hairdressing',
  { readonly is_hairdressing: boolean }
>;
export type SetQueueStatusCommand = CommandOf<
  'set_queue_status',
  { readonly status: QueueStatus }
>;
export type ResolveClosingCommand = CommandOf<
  'resolve_closing',
  {
    readonly ticket_ids: readonly string[];
    readonly decision: ClosingDecision;
  }
>;

export type Command =
  | JoinQueueCommand
  | RegisterWalkInCommand
  | CallTicketCommand
  | ConfirmArrivalCommand
  | StartServiceCommand
  | AdjustDurationCommand
  | CompleteServiceCommand
  | TakeNextCommand
  | RespondEtaCommand
  | CancelTicketCommand
  | RemoveTicketCommand
  | CreateAppointmentCommand
  | UpdateAppointmentCommand
  | CancelAppointmentCommand
  | CheckInAppointmentCommand
  | ConfirmAppointmentCommand
  | SetPresenceCommand
  | ResolveStylistChangeCommand
  | ReassignTicketCommand
  | RespondReassignmentCommand
  | RespondEndOfDayCommand
  | SetHairdressingCommand
  | SetQueueStatusCommand
  | ResolveClosingCommand;

export type CommandName = Command['command'];

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

interface EventActor {
  readonly actor_type: ActorType;
  readonly actor_member_id: string | null;
  readonly actor_profile_id: string | null;
  /** Structured reason (`^[a-z_]+$`), never free text (K10). */
  readonly reason_code: string | null;
}

export interface TicketEvent extends EventActor {
  readonly scope: 'ticket';
  readonly type: TicketEventType;
  readonly ticket_id: string;
  /** `estimate_changed`: the time it moves away from (U-10: undone, the explanation goes). */
  readonly previous_start_at?: Instant | null;
}

export interface SalonEvent extends EventActor {
  readonly scope: 'salon';
  readonly type: SalonEventType;
  readonly subject_member_id: string | null;
}

export type QueueEvent = TicketEvent | SalonEvent;

/** Structured template variables; names, phone and links are added by the sender. */
export type NotificationParams = Readonly<
  Record<string, string | number | null>
>;

/** A client notification to write to the outbox (ADR-008). */
export interface NotificationIntent {
  readonly ticket_id: string;
  readonly template: NotificationTemplate;
  /** Dictionary variant, for example `no_wait` or `end_of_day`. */
  readonly variant: string | null;
  /** Unique per ticket and channel (BACKEND_SCHEMA §4.16). */
  readonly dedupe_key: string;
  /** True for the four anticipation templates only (E17). */
  readonly requires_consent: boolean;
  readonly params: NotificationParams;
  /**
   * Columns to write only once the notification really leaves (K19): the
   * engine never moves `last_notified_start_at` itself.
   */
  readonly on_sent: { readonly last_notified_start_at: Instant } | null;
}

export interface EngineOutput {
  readonly state: QueueState;
  readonly events: readonly QueueEvent[];
  readonly notifications: readonly NotificationIntent[];
  /** Non-blocking warnings, for example `stylist_absent` (E26); absent when empty. */
  readonly warnings?: readonly string[];
}

export interface QueueError {
  readonly code: QueueErrorCode;
}

export type CommandResult =
  | ({ readonly ok: true } & EngineOutput)
  | { readonly ok: false; readonly error: QueueError };
