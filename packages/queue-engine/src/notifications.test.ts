/** diffNotifications: templates, dedupe keys, E11/K19 threshold, E17 consent split, K26 reasons. */
import { describe, expect, it } from 'vitest';
import { ANTICIPATION_TEMPLATES, diffNotifications } from './index.ts';
import type { NotificationIntent, QueueState, TicketState } from './index.ts';
import {
  adjustDuration,
  at,
  callTicket,
  calledTicket,
  cancelTicket,
  inServiceTicket,
  joinQueue,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  ok,
  presence,
  removeTicket,
  resolveStylistChange,
  respondEta,
  setHairdressing,
  setPresence,
  takeNext,
  ticketOf,
} from './testing/fixtures.ts';

const withTicket = (state: QueueState, ticket: TicketState): QueueState => ({
  ...state,
  tickets: state.tickets.map((t) => (t.id === ticket.id ? ticket : t)),
});

const changes = (out: { notifications: readonly NotificationIntent[] }) =>
  out.notifications.filter((n) => n.template === 'estimate_changed');

describe('E11 — 10-minute rule measured against the last announced time, small changes add up', () => {
  const base = () =>
    makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('14:30'), {
          planned_duration_minutes: 30,
        }),
        makeTicket('a', {
          estimated_start_at: at('15:00'),
          last_notified_start_at: at('15:00'),
          estimate_version: 1,
        }),
      ],
    });

  it('+5 then +5 again: nothing at 15:05, a notification at 15:10 with reason service_longer', () => {
    const first = ok(base(), adjustDuration('ines', 'x', 5), at('14:40'));
    expect(changes(first)).toEqual([]);
    expect(ticketOf(first.state, 'a').last_notified_start_at).toBe(at('15:00'));
    const second = ok(first.state, adjustDuration('ines', 'x', 5), at('14:41'));
    expect(changes(second)).toEqual([
      {
        ticket_id: 'a',
        template: 'estimate_changed',
        variant: null,
        dedupe_key: 'estimate_changed:v3',
        requires_consent: true,
        params: expect.objectContaining({
          estimated_start_at: at('15:10'),
          previous_start_at: at('15:00'),
          reason: 'service_longer',
        }),
        on_sent: { last_notified_start_at: at('15:10') },
      },
    ]);
    expect(second.events).toContainEqual(
      expect.objectContaining({
        type: 'estimate_changed',
        ticket_id: 'a',
        reason_code: 'service_longer',
      }),
    );
  });

  it('exactly 10 minutes triggers, 9 minutes does not, a back-and-forth within 10 minutes does not', () => {
    const before = base();
    const a = ticketOf(before, 'a');
    const moved = (minutes: number, version: number) =>
      withTicket(before, {
        ...a,
        estimated_start_at: at('15:00') + minutes * 60_000,
        estimate_version: version,
      });
    expect(
      changes({ notifications: diffNotifications(before, moved(10, 2)) }),
    ).toHaveLength(1);
    expect(
      changes({ notifications: diffNotifications(before, moved(9, 2)) }),
    ).toHaveLength(0);
    expect(
      changes({ notifications: diffNotifications(before, moved(-10, 2)) }),
    ).toHaveLength(1);
    expect(
      changes({ notifications: diffNotifications(moved(8, 2), moved(2, 3)) }),
    ).toHaveLength(0);
  });

  it('the engine never moves last_notified_start_at itself (K19): without consent the reference stays', () => {
    const state = base();
    const noConsent = withTicket(state, {
      ...ticketOf(state, 'a'),
      notifications_consent_at: null,
    });
    const out = ok(noConsent, adjustDuration('ines', 'x', 15), at('14:40'));
    expect(changes(out)).toEqual([
      expect.objectContaining({
        requires_consent: true,
        dedupe_key: 'estimate_changed:v2',
      }),
    ]);
    expect(ticketOf(out.state, 'a').last_notified_start_at).toBe(at('15:00'));
  });

  it('E11 — a ticket created without estimate gets its first time silently, then later changes are told', () => {
    const offline = makeState({
      members: [
        makeMember('ines', { presence: presence('offline') }),
        makeManager(),
      ],
    });
    const joined = ok(offline, joinQueue('a'), at('08:55'));
    expect(ticketOf(joined.state, 'a')).toMatchObject({
      estimated_start_at: null,
      last_notified_start_at: null,
    });
    const ready = ok(
      joined.state,
      setPresence('ines', 'ines', 'available'),
      at('09:00'),
    );
    expect(ticketOf(ready.state, 'a')).toMatchObject({
      estimated_start_at: at('09:00'),
      last_notified_start_at: at('09:00'),
    });
    expect(changes(ready)).toEqual([]);
    const pause = ok(
      ready.state,
      setPresence('ines', 'ines', 'on_break', {
        break_type: 'meal',
        until: at('10:00'),
      }),
      at('09:00'),
    );
    expect(changes(pause)).toEqual([
      expect.objectContaining({
        ticket_id: 'a',
        params: expect.objectContaining({
          estimated_start_at: at('10:00'),
          previous_start_at: at('09:00'),
          reason: 'stylist_break',
        }),
      }),
    ]);
  });

  it('no change notification without a previous announced time or without a new estimate version', () => {
    const state = base();
    const a = ticketOf(state, 'a');
    const unannounced = withTicket(state, {
      ...a,
      last_notified_start_at: null,
    });
    const later = withTicket(unannounced, {
      ...a,
      last_notified_start_at: null,
      estimated_start_at: at('16:00'),
      estimate_version: 2,
    });
    expect(diffNotifications(unannounced, later)).toEqual([]);
    const sameVersion = withTicket(state, {
      ...a,
      estimated_start_at: at('16:00'),
    });
    expect(diffNotifications(state, sameVersion)).toEqual([]);
  });
});

describe('E17 — consent only governs the four anticipation templates', () => {
  it('lists exactly turn_approaching, get_ready, estimate_changed, end_of_day_risk', () => {
    expect([...ANTICIPATION_TEMPLATES].sort()).toEqual(
      [
        'end_of_day_risk',
        'estimate_changed',
        'get_ready',
        'turn_approaching',
      ].sort(),
    );
  });

  it('essential templates never require consent', () => {
    const state = makeState({
      members: [makeMember('ines'), makeManager()],
      tickets: [
        makeTicket('a', { notifications_consent_at: null }),
        makeTicket('b'),
      ],
    });
    const called = ok(state, callTicket('ines'), at('10:00'));
    const removed = ok(
      called.state,
      removeTicket('b', 'emergency'),
      at('10:01'),
    );
    for (const n of [...called.notifications, ...removed.notifications]) {
      expect(n.requires_consent).toBe(
        ANTICIPATION_TEMPLATES.includes(n.template),
      );
    }
    expect(removed.notifications).toContainEqual(
      expect.objectContaining({
        ticket_id: 'b',
        template: 'cancelled_by_salon',
        variant: null,
        requires_consent: false,
        params: expect.objectContaining({ reason: 'emergency' }),
      }),
    );
  });
});

describe('Dedupe keys (K23, K31)', () => {
  it('your_turn and arrival_reminder are numbered by call, postponed by total places', () => {
    const state = makeState({
      tickets: [
        calledTicket('a', 'ines', at('10:00'), {
          queue_rank: 1,
          eta_response: 'late',
          declared_delay_minutes: 10,
          declared_arrival_at: at('10:15'),
        }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    const out = ok(state, takeNext('ines', 'a'), at('10:01'));
    expect(out.notifications.map((n) => n.dedupe_key).sort()).toEqual(
      ['postponed:1', 'your_turn:1'].sort(),
    );
    const postponed = out.notifications.find((n) => n.template === 'postponed');
    expect(postponed?.params).toMatchObject({
      reason: 'client_late',
      position: 1,
    });
    expect(postponed?.on_sent).toEqual({
      last_notified_start_at: ticketOf(out.state, 'a').estimated_start_at,
    });
  });

  it('a client cancelling himself receives nothing', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    expect(ok(state, cancelTicket('a'), at('10:00')).notifications).toEqual([]);
  });
});

describe('K26 — estimate_change_reason inference', () => {
  const twoStylists = (tickets: TicketState[]) =>
    makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets,
    });

  const announced = (
    id: string,
    hhmm: string,
    extra: Partial<TicketState> = {},
  ) =>
    makeTicket(id, {
      estimated_start_at: at(hhmm),
      last_notified_start_at: at(hhmm),
      estimate_version: 1,
      ...extra,
    });

  it('client_ahead_left when a client before him cancels', () => {
    const state = makeState({
      tickets: [
        announced('a', '10:00'),
        announced('b', '10:30'),
        announced('c', '11:00'),
      ],
    });
    const out = ok(state, cancelTicket('a'), at('10:00'));
    expect(changes(out).map((n) => n.params.reason)).toEqual([
      'client_ahead_left',
      'client_ahead_left',
    ]);
  });

  it('client_postponed for the clients who pass before a late client', () => {
    const state = makeState({
      tickets: [
        calledTicket('a', 'ines', at('10:00'), {
          queue_rank: 1,
          eta_response: 'late',
          declared_delay_minutes: 20,
          declared_arrival_at: at('10:25'),
        }),
        announced('b', '10:55', { queue_rank: 2 }),
        announced('c', '11:25', { queue_rank: 3 }),
      ],
    });
    const out = ok(state, takeNext('ines', 'a'), at('10:01'));
    expect(changes(out).map((n) => [n.ticket_id, n.params.reason])).toEqual([
      ['c', 'client_postponed'],
    ]);
  });

  it('client_ahead_late when a client before him declares a delay', () => {
    const state = makeState({
      tickets: [announced('a', '10:00'), announced('b', '10:30')],
    });
    const out = ok(state, respondEta('a', 'late', 30), at('10:00'));
    expect(changes(out).map((n) => [n.ticket_id, n.params.reason])).toEqual([
      ['b', 'client_ahead_late'],
    ]);
  });

  it('stylist_late, stylist_unavailable, stylist_available', () => {
    const state = twoStylists([
      inServiceTicket('s', 'karim', at('09:50'), {
        planned_duration_minutes: 60,
      }),
      announced('a', '10:00', { estimated_member_id: 'ines' }),
    ]);
    const late = ok(
      state,
      setPresence('gerant', 'ines', 'late', { until: at('10:30') }),
      at('10:00'),
    );
    expect(changes(late)[0]?.params.reason).toBe('stylist_late');
    const absent = ok(
      state,
      setPresence('gerant', 'ines', 'absent'),
      at('10:00'),
    );
    expect(changes(absent)[0]?.params.reason).toBe('stylist_unavailable');
    const offline = twoStylists([
      announced('a', '10:30', {}),
      inServiceTicket('s', 'ines', at('09:30'), {
        planned_duration_minutes: 60,
      }),
    ]);
    const karimOffline = {
      ...offline,
      members: offline.members.map((m) =>
        m.id === 'karim' ? { ...m, presence: presence('offline') } : m,
      ),
    };
    const ready = ok(
      karimOffline,
      setPresence('karim', 'karim', 'available'),
      at('10:00'),
    );
    expect(changes(ready)[0]?.params.reason).toBe('stylist_available');
  });

  it('hairdressing_toggled when the manager starts cutting hair', () => {
    const state = makeState({
      members: [
        makeMember('ines'),
        makeManager('gerant', { specialties: ['women_cut'] }),
      ],
      tickets: [
        inServiceTicket('s', 'ines', at('09:50'), {
          planned_duration_minutes: 60,
        }),
        announced('a', '10:50'),
      ],
    });
    const out = ok(state, setHairdressing(true), at('10:00'));
    expect(changes(out)[0]?.params.reason).toBe('hairdressing_toggled');
  });

  it('stylist_choice when the client switches to « premier disponible »', () => {
    const state = twoStylists([
      inServiceTicket('s', 'ines', at('09:50'), {
        planned_duration_minutes: 60,
      }),
      announced('a', '10:50', {
        requested_member_id: 'ines',
        stylist_change_pending_since: at('09:55'),
      }),
    ]);
    const out = ok(
      state,
      resolveStylistChange('a', 'first_available'),
      at('10:00'),
    );
    expect(changes(out)[0]?.params.reason).toBe('stylist_choice');
  });

  it('E6/E36 — a called client put back at the head is always told, as an essential message', () => {
    const state = twoStylists([
      calledTicket('a', 'ines', at('09:59'), {
        notifications_consent_at: null,
      }),
    ]);
    const out = ok(state, setPresence('gerant', 'ines', 'absent'), at('10:00'));
    expect(changes(out)).toEqual([
      expect.objectContaining({
        ticket_id: 'a',
        dedupe_key: 'estimate_changed:requeued:1',
        requires_consent: false,
        params: expect.objectContaining({
          reason: 'stylist_unavailable',
          estimated_start_at: at('10:00'),
        }),
        on_sent: { last_notified_start_at: at('10:00') },
      }),
    ]);
  });

  it('E6/E36 — told even when no stylist is left to give him a time (single hairdresser absent)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeManager()],
      tickets: [calledTicket('a', 'ines', at('09:59'))],
    });
    const out = ok(state, setPresence('gerant', 'ines', 'absent'), at('10:00'));
    expect(ticketOf(out.state, 'a').estimated_start_at).toBeNull();
    expect(changes(out)).toEqual([
      expect.objectContaining({
        dedupe_key: 'estimate_changed:requeued:1',
        requires_consent: false,
        params: expect.objectContaining({
          reason: 'stylist_unavailable',
          estimated_start_at: null,
        }),
        on_sent: null,
      }),
    ]);
  });

  it('falls back to service_longer / service_shorter when nothing else explains the change', () => {
    const state = makeState({ tickets: [announced('a', '10:00')] });
    const a = ticketOf(state, 'a');
    const later = withTicket(state, {
      ...a,
      estimated_start_at: at('10:20'),
      estimate_version: 2,
    });
    const earlier = withTicket(state, {
      ...a,
      estimated_start_at: at('09:40'),
      estimate_version: 2,
    });
    expect(diffNotifications(state, later)[0]?.params.reason).toBe(
      'service_longer',
    );
    expect(diffNotifications(state, earlier)[0]?.params.reason).toBe(
      'service_shorter',
    );
  });

  it('a service completed after its planned end explains a later time as service_longer', () => {
    const before = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:00'), {
          planned_duration_minutes: 30,
        }),
        announced('a', '09:30'),
      ],
    });
    const after: QueueState = {
      ...before,
      tickets: [
        {
          ...ticketOf(before, 'x'),
          status: 'completed',
          completed_at: at('09:50'),
        },
        {
          ...ticketOf(before, 'a'),
          estimated_start_at: at('09:50'),
          estimate_version: 2,
        },
      ],
    };
    expect(diffNotifications(before, after)[0]?.params.reason).toBe(
      'service_longer',
    );
  });
});
