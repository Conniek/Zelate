/**
 * Which client notifications a state change produces (PRD §5.4, ADR-008).
 *
 * The diff is the single source of notifications for both commands and
 * ticks: a column that changed is a message to send. Dedupe keys follow
 * BACKEND_SCHEMA §4.16; consent only governs the anticipation templates
 * (E17); estimate changes follow the 10-min rule against
 * `last_notified_start_at`, small changes adding up (E11, K19), with a reason
 * from `estimate_change_reason` (K26).
 */
import { ESTIMATE_NOTIFY_THRESHOLD_MINUTES, MINUTE } from './constants.ts';
import { isActiveStatus, isOnSite, waitOffered } from './rules.ts';
import type {
  CancelReason,
  EstimateChangeReason,
  MemberState,
  NotificationIntent,
  NotificationParams,
  NotificationTemplate,
  QueueState,
  TicketState,
} from './types.ts';
import { ANTICIPATION_TEMPLATES } from './types.ts';

const SALON_CANCELLATIONS: readonly CancelReason[] = [
  'removed_by_salon',
  'end_of_day',
  'stylist_unavailable',
];

function intent(
  ticket: TicketState,
  template: NotificationTemplate,
  dedupe_key: string,
  params: NotificationParams,
  options: { variant?: string; announces?: boolean; essential?: boolean } = {},
): NotificationIntent {
  return {
    ticket_id: ticket.id,
    template,
    variant: options.variant ?? null,
    dedupe_key,
    requires_consent:
      !options.essential && ANTICIPATION_TEMPLATES.includes(template),
    params,
    on_sent:
      options.announces && ticket.estimated_start_at !== null
        ? { last_notified_start_at: ticket.estimated_start_at }
        : null,
  };
}

/** Clients before him at his stylist (E13): his stylist's called client and earlier estimates. */
export function positionOf(
  state: QueueState,
  ticket: TicketState,
): number | null {
  const memberId = ticket.estimated_member_id;
  const start = ticket.estimated_start_at;
  if (memberId === null || start === null) return null;
  return state.tickets.filter(
    (t) =>
      t.id !== ticket.id &&
      ((t.status === 'called' && t.assigned_member_id === memberId) ||
        (t.status === 'waiting' &&
          t.estimated_member_id === memberId &&
          t.estimated_start_at !== null &&
          t.estimated_start_at < start)),
  ).length;
}

// --- K26 reason inference -------------------------------------------------

function presenceReason(
  before: MemberState,
  after: MemberState,
): EstimateChangeReason | null {
  if (before.is_hairdressing !== after.is_hairdressing)
    return 'hairdressing_toggled';
  if (after.status !== 'active' && before.status === 'active')
    return 'stylist_unavailable';
  const from = before.presence.status;
  const to = after.presence.status;
  const sameStatus = from === to;
  const serviceSwitch =
    (from === 'in_service' && to === 'available') ||
    (from === 'available' && to === 'in_service');
  if (serviceSwitch) return null;
  if (sameStatus) {
    return before.presence.expected_back_at !==
      after.presence.expected_back_at ||
      before.presence.shift_end_at !== after.presence.shift_end_at
      ? to === 'late'
        ? 'stylist_late'
        : to === 'on_break'
          ? 'stylist_break'
          : 'stylist_unavailable'
      : null;
  }
  if (to === 'on_break') return 'stylist_break';
  if (from === 'on_break') return 'stylist_break_ended';
  if (to === 'late') return 'stylist_late';
  if (to === 'absent' || to === 'off_duty' || to === 'offline')
    return 'stylist_unavailable';
  return 'stylist_available';
}

interface ReasonContext {
  readonly members: ReadonlyMap<string, EstimateChangeReason>;
  readonly tickets: EstimateChangeReason | null;
}

function ticketReason(
  before: QueueState,
  after: QueueState,
): EstimateChangeReason | null {
  const previous = new Map(before.tickets.map((t) => [t.id, t]));
  const changed = after.tickets
    .map((t) => [previous.get(t.id), t] as const)
    .filter(
      (pair): pair is readonly [TicketState, TicketState] =>
        pair[0] !== undefined,
    );
  const has = (test: (b: TicketState, a: TicketState) => boolean) =>
    changed.some(([b, a]) => test(b, a));

  if (has((b, a) => b.priority_since === null && a.priority_since !== null)) {
    return 'stylist_unavailable';
  }
  if (
    after.tickets.some(
      (t) =>
        t.kind === 'appointment' &&
        t.status === 'waiting' &&
        !previous.has(t.id),
    )
  ) {
    return 'appointment_ahead';
  }
  if (
    has((b, a) => a.kind === 'appointment' && a.scheduled_at !== b.scheduled_at)
  ) {
    return 'appointment_changed';
  }
  if (has((b, a) => a.postpone_count > b.postpone_count))
    return 'client_postponed';
  if (
    has(
      (b, a) =>
        a.status === 'in_service' &&
        b.status === 'in_service' &&
        a.planned_duration_minutes > b.planned_duration_minutes,
    )
  ) {
    return 'service_longer';
  }
  if (
    has(
      (b, a) =>
        (b.status === 'waiting' || b.status === 'called') &&
        (a.status === 'cancelled' || a.status === 'no_show'),
    )
  ) {
    return 'client_ahead_left';
  }
  const completed = changed.find(
    ([b, a]) => b.status === 'in_service' && a.status === 'completed',
  );
  if (completed) {
    const [b, a] = completed;
    const plannedEnd =
      (b.started_at ?? 0) + b.planned_duration_minutes * MINUTE;
    return (a.completed_at ?? plannedEnd) < plannedEnd
      ? 'service_shorter'
      : 'service_longer';
  }
  if (has((b, a) => b.eta_response !== 'late' && a.eta_response === 'late')) {
    return 'client_ahead_late';
  }
  return null;
}

function reasonContext(before: QueueState, after: QueueState): ReasonContext {
  const members = new Map<string, EstimateChangeReason>();
  for (const member of after.members) {
    const previous = before.members.find((m) => m.id === member.id);
    const reason = previous ? presenceReason(previous, member) : null;
    if (reason) members.set(member.id, reason);
  }
  return { members, tickets: ticketReason(before, after) };
}

function inferReason(
  context: ReasonContext,
  before: TicketState,
  after: TicketState,
  later: boolean,
): EstimateChangeReason {
  if (
    after.assigned_member_id !== before.assigned_member_id ||
    (before.requested_member_id !== after.requested_member_id &&
      after.requested_member_id !== null)
  ) {
    return 'reassigned';
  }
  if (before.requested_member_id !== after.requested_member_id)
    return 'stylist_choice';
  if (
    after.kind === 'appointment' &&
    after.scheduled_at !== before.scheduled_at
  ) {
    return 'your_appointment_changed';
  }
  const own = [
    after.estimated_member_id,
    before.estimated_member_id,
    after.requested_member_id,
  ]
    .map((id) => (id === null ? undefined : context.members.get(id)))
    .find((r) => r !== undefined);
  const anyMember = context.members.values().next().value;
  return (
    own ??
    anyMember ??
    context.tickets ??
    (later ? 'service_longer' : 'service_shorter')
  );
}

// --- diff -------------------------------------------------------------------

function estimateChange(
  context: ReasonContext,
  before: TicketState,
  after: TicketState,
): NotificationIntent | null {
  if (after.status !== 'waiting') return null;
  const reference = after.last_notified_start_at;
  if (before.status === 'called' && after.priority_since !== null) {
    // E6 / E36: a called client put back at the head is always told. The
    // message concerns his place and ends his call, so it is essential (E17),
    // even when no stylist can give him a time yet.
    return intent(
      after,
      'estimate_changed',
      `estimate_changed:requeued:${after.call_count}`,
      {
        estimated_start_at: after.estimated_start_at,
        previous_start_at: before.last_notified_start_at,
        reason: 'stylist_unavailable',
      },
      { announces: true, essential: true },
    );
  }
  if (after.estimated_start_at === null) return null;
  if (after.estimate_version === before.estimate_version) return null;
  if (before.status !== 'waiting' || reference === null) return null;
  // E23: an appointment not yet on site is told by `appointment_delay`.
  const own = after.kind === 'appointment';
  if (own && after.scheduled_at === before.scheduled_at && !isOnSite(after)) {
    return null;
  }
  const delta = after.estimated_start_at - reference;
  if (Math.abs(delta) < ESTIMATE_NOTIFY_THRESHOLD_MINUTES * MINUTE) return null;
  const selfDeclared =
    before.eta_response !== after.eta_response ||
    before.declared_arrival_at !== after.declared_arrival_at;
  if (selfDeclared) return null;
  return intent(
    after,
    'estimate_changed',
    `estimate_changed:v${after.estimate_version}`,
    {
      estimated_start_at: after.estimated_start_at,
      previous_start_at: reference,
      reason: inferReason(context, before, after, delta > 0),
    },
    {
      announces: true,
      // E23: a moved appointment is told to its client, consent or not.
      essential:
        after.kind === 'appointment' &&
        after.scheduled_at !== before.scheduled_at,
    },
  );
}

/** Client notifications produced by the change from `before` to `after`. */
export function diffNotifications(
  before: QueueState,
  after: QueueState,
): NotificationIntent[] {
  const out: NotificationIntent[] = [];
  const previous = new Map(before.tickets.map((t) => [t.id, t]));
  let context: ReasonContext | null = null;

  for (const a of after.tickets) {
    const b = previous.get(a.id);
    if (!b) {
      if (a.status === 'waiting') {
        out.push(
          intent(a, 'ticket_created', 'ticket_created', {
            estimated_start_at: a.estimated_start_at,
            position: positionOf(after, a),
          }),
        );
      }
      continue;
    }

    if (b.status !== a.status) {
      if (a.status === 'called') {
        out.push(
          intent(a, 'your_turn', `your_turn:${a.call_count}`, {
            call_count: a.call_count,
            release_due_at: a.release_due_at,
          }),
        );
      } else if (
        a.status === 'cancelled' &&
        a.cancel_reason === 'appointment_rejected' &&
        b.status === 'pending_confirmation'
      ) {
        out.push(
          intent(a, 'appointment_rejected', 'appointment_rejected', {
            reason: a.removal_reason,
          }),
        );
      } else if (a.status === 'no_show') {
        out.push(intent(a, 'released_no_show', 'released_no_show', {}));
      } else if (
        a.status === 'cancelled' &&
        a.cancel_reason !== null &&
        SALON_CANCELLATIONS.includes(a.cancel_reason) &&
        b.status !== 'in_service'
      ) {
        const endOfDay = a.cancel_reason === 'end_of_day';
        out.push(
          intent(
            a,
            'cancelled_by_salon',
            'cancelled_by_salon',
            { reason: endOfDay ? null : (a.removal_reason ?? a.cancel_reason) },
            endOfDay ? { variant: 'end_of_day' } : {},
          ),
        );
      }
    }

    if (a.appointment_delay_warned_steps > b.appointment_delay_warned_steps) {
      out.push(
        intent(
          a,
          'appointment_delay',
          `appointment_delay:${a.appointment_delay_warned_steps}`,
          {
            estimated_start_at: a.estimated_start_at,
            scheduled_at: a.scheduled_at,
          },
          { essential: true },
        ),
      );
    }

    if (
      a.reassignment_requested_at !== null &&
      a.reassignment_requested_at !== b.reassignment_requested_at
    ) {
      out.push(
        intent(
          a,
          'reassignment_request',
          `reassignment_request:${a.reassignment_requested_at}`,
          {
            member_id: a.reassignment_member_id,
            proposed_start_at: a.reassignment_proposed_start_at,
          },
        ),
      );
    }

    if (b.confirmed_at === null && a.confirmed_at !== null) {
      out.push(
        intent(
          a,
          'appointment_confirmed',
          'appointment_confirmed',
          {
            scheduled_at: a.scheduled_at,
            estimated_start_at: a.estimated_start_at,
          },
          { announces: true },
        ),
      );
    }

    if (
      a.status === 'called' &&
      a.reminder_sent_at !== null &&
      b.reminder_sent_at === null
    ) {
      out.push(
        intent(a, 'arrival_reminder', `arrival_reminder:${a.call_count}`, {
          release_due_at: a.release_due_at,
        }),
      );
    }

    const postponed = a.postpone_count > b.postpone_count;
    if (postponed) {
      out.push(
        intent(
          a,
          'postponed',
          `postponed:${a.postpone_count}`,
          {
            position: positionOf(after, a),
            estimated_start_at: a.estimated_start_at,
            reason: 'client_late',
          },
          { announces: true },
        ),
      );
    }

    const choiceRequested =
      a.status === 'waiting' &&
      a.stylist_change_pending_since !== null &&
      a.stylist_change_pending_since !== b.stylist_change_pending_since;
    if (choiceRequested) {
      const noWait = !waitOffered(after, a);
      out.push(
        intent(
          a,
          'stylist_change_required',
          `stylist_change_required:${a.stylist_change_pending_since}`,
          { member_id: a.requested_member_id },
          noWait ? { variant: 'no_wait' } : {},
        ),
      );
    }

    if (
      a.turn_approaching_sent_at !== null &&
      b.turn_approaching_sent_at === null
    ) {
      out.push(
        intent(
          a,
          'turn_approaching',
          'turn_approaching',
          { estimated_start_at: a.estimated_start_at },
          { announces: true },
        ),
      );
    }
    if (a.get_ready_sent_at !== null && b.get_ready_sent_at === null) {
      out.push(
        intent(
          a,
          'get_ready',
          'get_ready',
          { estimated_start_at: a.estimated_start_at },
          { announces: true },
        ),
      );
    }
    if (a.end_of_day_warned_at !== null && b.end_of_day_warned_at === null) {
      out.push(
        intent(a, 'end_of_day_risk', 'end_of_day_risk', {
          estimated_start_at: a.estimated_start_at,
        }),
      );
    }

    if (!postponed && !choiceRequested && isActiveStatus(a.status)) {
      context ??= reasonContext(before, after);
      const change = estimateChange(context, b, a);
      if (change) out.push(change);
    }
  }
  return out;
}
