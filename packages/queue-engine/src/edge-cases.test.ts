/** Edge cases of DEV-2: break, overrun, absence, manager « Je coiffe », end of day, DST. */
import { describe, expect, it } from 'vitest';
import {
  computeSchedule,
  detectTimeTriggers,
  pickNextTicket,
} from './index.ts';
import type { QueueState } from './index.ts';
import {
  at,
  callTicket,
  calledTicket,
  completeService,
  inServiceTicket,
  joinQueue,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  memberOf,
  min,
  ok,
  presence,
  resolveClosing,
  setHairdressing,
  setPresence,
  ticketOf,
} from './testing/fixtures.ts';

describe('Stylist break (E25)', () => {
  it('a break moves the estimates but asks no choice to the clients who requested him', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', {
          requested_member_id: 'ines',
          last_notified_start_at: at('10:00'),
        }),
      ],
    });
    const out = ok(
      state,
      setPresence('ines', 'ines', 'on_break', {
        break_type: 'meal',
        until: at('10:45'),
      }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a')).toMatchObject({
      estimated_start_at: at('10:45'),
      stylist_change_pending_since: null,
    });
    expect(memberOf(out.state, 'ines').presence).toMatchObject({
      status: 'on_break',
      break_type: 'meal',
      expected_back_at: at('10:45'),
      status_since: at('10:00'),
    });
    const change = out.notifications.find(
      (n) => n.template === 'estimate_changed',
    );
    expect(change?.params.reason).toBe('stylist_break');
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'presence_changed',
        scope: 'salon',
        subject_member_id: 'ines',
      }),
    );
  });

  it('an overdue break counts from now (no automatic status change, E32 open)', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: presence('on_break', {
            break_type: 'short',
            expected_back_at: at('09:50'),
          }),
        }),
      ],
      tickets: [makeTicket('a')],
    });
    expect(
      computeSchedule(state, at('10:00')).tickets.a?.estimated_start_at,
    ).toBe(at('10:00'));
  });

  it('back from break: estimates move earlier with reason stylist_break_ended', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: presence('on_break', {
            break_type: 'meal',
            expected_back_at: at('11:00'),
          }),
        }),
      ],
      tickets: [
        makeTicket('a', {
          estimated_start_at: at('11:00'),
          last_notified_start_at: at('11:00'),
          estimate_version: 1,
        }),
      ],
    });
    const out = ok(
      state,
      setPresence('ines', 'ines', 'available'),
      at('10:20'),
    );
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        template: 'estimate_changed',
        params: expect.objectContaining({ reason: 'stylist_break_ended' }),
      }),
    );
  });
});

describe('Service overrun', () => {
  it('each tick keeps 5 minutes remaining while the service overruns', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:00'), {
          planned_duration_minutes: 30,
        }),
        makeTicket('a'),
      ],
    });
    const first = detectTimeTriggers(state, at('09:40'));
    expect(ticketOf(first.state, 'a').estimated_start_at).toBe(at('09:45'));
    const second = detectTimeTriggers(first.state, at('09:50'));
    expect(ticketOf(second.state, 'a').estimated_start_at).toBe(at('09:55'));
    expect(ticketOf(second.state, 'a').estimate_version).toBe(2);
  });

  it('completing early moves the next client earlier (reason service_shorter)', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('10:00'), {
          planned_duration_minutes: 60,
        }),
        makeTicket('a', {
          estimated_start_at: at('11:00'),
          last_notified_start_at: at('11:00'),
          estimate_version: 1,
        }),
      ],
    });
    const out = ok(state, completeService('ines', 'x'), at('10:30'));
    expect(ticketOf(out.state, 'a').estimated_start_at).toBe(at('10:30'));
    expect(
      out.notifications.find((n) => n.template === 'estimate_changed')?.params
        .reason,
    ).toBe('service_shorter');
  });
});

describe('Absent stylist', () => {
  const state = () =>
    makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets: [
        inServiceTicket('s', 'ines', at('09:50')),
        makeTicket('a', { requested_member_id: 'ines' }),
        makeTicket('b'),
      ],
    });

  it('no-preference tickets are redistributed without a choice; requested ones get the no-wait choice', () => {
    const out = ok(
      state(),
      setPresence('gerant', 'ines', 'absent'),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'b')).toMatchObject({
      estimated_member_id: 'karim',
      stylist_change_pending_since: null,
    });
    expect(ticketOf(out.state, 'a')).toMatchObject({
      stylist_change_pending_since: at('10:00'),
      estimated_start_at: null,
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'stylist_change_requested',
        ticket_id: 'a',
        actor_type: 'manager',
      }),
    );
  });

  it('a client in service stays in service: the manager completes it (E6)', () => {
    const out = ok(
      state(),
      setPresence('gerant', 'ines', 'absent'),
      at('10:00'),
    );
    expect(ticketOf(out.state, 's').status).toBe('in_service');
  });

  it('a called client goes back to the head of the queue, countdown cleared, taken by the first free stylist (E6, E36 default)', () => {
    const called = makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets: [
        makeTicket('b', { queue_rank: 1 }),
        calledTicket('a', 'ines', at('09:58'), {
          queue_rank: 2,
          requested_member_id: 'ines',
        }),
      ],
    });
    const out = ok(
      called,
      setPresence('gerant', 'ines', 'absent'),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'waiting',
      priority_since: at('10:00'),
      assigned_member_id: null,
      requested_member_id: null,
      called_at: null,
      release_due_at: null,
      reminder_sent_at: null,
      call_count: 1,
      stylist_change_pending_since: null,
    });
    expect(pickNextTicket(out.state, 'karim', at('10:01'))?.id).toBe('a');
    const recalled = ok(out.state, callTicket('karim'), at('10:01'));
    expect(ticketOf(recalled.state, 'a')).toMatchObject({
      status: 'called',
      call_count: 2,
      priority_since: null,
    });
    expect(recalled.notifications.map((n) => n.dedupe_key)).toContain(
      'your_turn:2',
    );
  });

  it('a stylist leaving early only asks the clients who would end after his shift', () => {
    const shift = makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets: [
        makeTicket('a', { requested_member_id: 'ines' }),
        makeTicket('b', { requested_member_id: 'ines' }),
      ],
    });
    const out = ok(
      shift,
      setPresence('ines', 'ines', 'off_duty', { shift_end_at: at('10:40') }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a').stylist_change_pending_since).toBeNull();
    expect(ticketOf(out.state, 'b').stylist_change_pending_since).toBe(
      at('10:00'),
    );
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        ticket_id: 'b',
        template: 'stylist_change_required',
        variant: null,
      }),
    );
    expect(pickNextTicket(out.state, 'ines', at('10:00'))?.id).toBe('a');
    expect(pickNextTicket(out.state, 'ines', at('10:15'))).toBeNull();
  });

  it('end of day now: the stylist leaves the distribution', () => {
    const out = ok(
      state(),
      setPresence('ines', 'ines', 'off_duty'),
      at('10:00'),
    );
    expect(memberOf(out.state, 'ines').presence.shift_end_at).toBe(at('10:00'));
    expect(ticketOf(out.state, 'b').estimated_member_id).toBe('karim');
  });

  it('a late stylist is counted from his expected arrival and becomes available again', () => {
    const late = ok(
      state(),
      setPresence('gerant', 'karim', 'late', { until: at('10:30') }),
      at('10:00'),
    );
    expect(memberOf(late.state, 'karim').presence.expected_back_at).toBe(
      at('10:30'),
    );
    const back = ok(
      late.state,
      setPresence('karim', 'karim', 'available'),
      at('10:25'),
    );
    expect(memberOf(back.state, 'karim').presence).toMatchObject({
      status: 'available',
      expected_back_at: null,
    });
  });
});

describe('Manager « Je coiffe » on and off (E8)', () => {
  const state = (): QueueState =>
    makeState({
      members: [
        makeMember('ines'),
        makeManager('gerant', {
          is_hairdressing: true,
          specialties: ['women_cut'],
        }),
      ],
      tickets: [
        makeTicket('a', { requested_member_id: 'gerant' }),
        makeTicket('b'),
      ],
    });

  it('switching off asks his clients to choose, without « attendre »', () => {
    const out = ok(state(), setHairdressing(false), at('10:00'));
    expect(memberOf(out.state, 'gerant').is_hairdressing).toBe(false);
    expect(ticketOf(out.state, 'a').stylist_change_pending_since).toBe(
      at('10:00'),
    );
    expect(out.notifications).toContainEqual(
      expect.objectContaining({ ticket_id: 'a', variant: 'no_wait' }),
    );
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'hairdressing_toggled',
        reason_code: 'off',
      }),
    );
  });

  it('switching on brings him back into the distribution; repeating the same value is a no-op', () => {
    const off = ok(state(), setHairdressing(false), at('10:00')).state;
    const on = ok(off, setHairdressing(true), at('10:05'));
    expect(ticketOf(on.state, 'b').estimated_member_id).not.toBeNull();
    const same = ok(on.state, setHairdressing(true), at('10:06'));
    expect(same.events).toEqual([]);
  });
});

describe('End of day', () => {
  it('a « serve » client not taken before midnight Paris is cancelled with apologies (E24)', () => {
    const state = makeState({
      tickets: [makeTicket('a', { closing_decision: 'serve' })],
    });
    const before = detectTimeTriggers(state, at('23:59'));
    expect(ticketOf(before.state, 'a').status).toBe('waiting');
    const midnight = detectTimeTriggers(state, Date.UTC(2026, 9, 21, 22, 0));
    expect(ticketOf(midnight.state, 'a')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'end_of_day',
    });
    expect(midnight.notifications).toContainEqual(
      expect.objectContaining({
        template: 'cancelled_by_salon',
        variant: 'end_of_day',
      }),
    );
  });

  it('a client still in service at midnight is closed without an apology message (default)', () => {
    const state = makeState({
      tickets: [inServiceTicket('a', 'ines', at('23:30'))],
    });
    const out = detectTimeTriggers(state, Date.UTC(2026, 9, 21, 22, 0));
    expect(ticketOf(out.state, 'a').status).toBe('cancelled');
    expect(out.notifications).toEqual([]);
  });

  it('the decision box concerns waiting clients; called and in-service clients are not auto-cancelled at closing + 15 min', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim')],
      tickets: [
        calledTicket('a', 'ines', at('19:10'), { arrived_at: at('19:12') }),
        inServiceTicket('b', 'karim', at('18:50')),
      ],
    });
    const out = detectTimeTriggers(state, at('19:16'));
    expect(ticketOf(out.state, 'a').status).toBe('called');
    expect(ticketOf(out.state, 'b').status).toBe('in_service');
  });

  it('after the last closing the salon is full and no warning is sent any more', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const out = detectTimeTriggers(state, at('19:05'));
    expect(out.state.salon.is_full).toBe(true);
    expect(ticketOf(out.state, 'a').end_of_day_warned_at).toBeNull();
  });

  it('a mixed decision leaves undecided clients for the automatic cancellation', () => {
    const state = makeState({
      members: [makeMember('ines'), makeManager()],
      tickets: [makeTicket('a'), makeTicket('b'), makeTicket('c')],
    });
    const served = ok(state, resolveClosing(['a'], 'serve'), at('19:01')).state;
    const cancelled = ok(
      served,
      resolveClosing(['b'], 'cancel'),
      at('19:02'),
    ).state;
    const out = detectTimeTriggers(cancelled, at('19:15'));
    expect(['a', 'b', 'c'].map((id) => ticketOf(out.state, id).status)).toEqual(
      ['waiting', 'cancelled', 'cancelled'],
    );
  });
});

describe('Lunch closure between two opening ranges (E24)', () => {
  it('a service that would start during the closure is estimated at the next opening', () => {
    const state = makeState({
      salon: {
        service_day: {
          service_date: '2026-10-21',
          opening_ranges: [
            { opens_at: at('09:00'), closes_at: at('12:00') },
            { opens_at: at('14:00'), closes_at: at('19:00') },
          ],
          ends_at: Date.UTC(2026, 9, 21, 22),
        },
      },
      tickets: [makeTicket('a'), makeTicket('b')],
    });
    const schedule = computeSchedule(state, at('11:50'));
    expect(schedule.tickets.a?.estimated_start_at).toBe(at('11:50'));
    expect(schedule.tickets.b?.estimated_start_at).toBe(at('14:00'));
  });
});

describe('Daylight saving days (ADR-010)', () => {
  // Sunday 25/10/2026: Paris goes from UTC+2 to UTC+1 at 03:00, a 25-hour day.
  const fallBack = (): QueueState =>
    makeState({
      salon: {
        service_day: {
          service_date: '2026-10-25',
          opening_ranges: [
            {
              opens_at: Date.UTC(2026, 9, 25, 8),
              closes_at: Date.UTC(2026, 9, 25, 18),
            },
          ],
          ends_at: Date.UTC(2026, 9, 25, 23),
        },
      },
      tickets: [
        makeTicket('a', {
          service_date: '2026-10-25',
          closing_decision: 'serve',
        }),
      ],
    });

  it('the end of the service day follows the instant given by the caller, not a fixed 24 h', () => {
    // 22:00 UTC is still 23:00 in Paris after the change: the ticket survives.
    expect(
      ticketOf(
        detectTimeTriggers(fallBack(), Date.UTC(2026, 9, 25, 22)).state,
        'a',
      ).status,
    ).toBe('waiting');
    expect(
      ticketOf(
        detectTimeTriggers(fallBack(), Date.UTC(2026, 9, 25, 23)).state,
        'a',
      ).status,
    ).toBe('cancelled');
  });

  it('the end-of-day window starts 2 h before the closing instant (17:00 Paris = 16:00 UTC)', () => {
    const state = makeState({
      ...{},
      salon: fallBack().salon,
      tickets: [
        inServiceTicket('x', 'ines', Date.UTC(2026, 9, 25, 15, 45), {
          service_date: '2026-10-25',
          planned_duration_minutes: 120,
        }),
        makeTicket('a', { service_date: '2026-10-25' }),
      ],
    });
    expect(
      ticketOf(
        detectTimeTriggers(state, Date.UTC(2026, 9, 25, 15, 59)).state,
        'a',
      ).end_of_day_warned_at,
    ).toBeNull();
    expect(
      ticketOf(detectTimeTriggers(state, Date.UTC(2026, 9, 25, 16)).state, 'a')
        .end_of_day_warned_at,
    ).toBe(Date.UTC(2026, 9, 25, 16));
  });

  // Sunday 29/03/2026: Paris goes from UTC+1 to UTC+2 at 02:00, a 23-hour day.
  it('a 23-hour day ends at 22:00 UTC', () => {
    const state = makeState({
      salon: {
        service_day: {
          service_date: '2026-03-29',
          opening_ranges: [
            {
              opens_at: Date.UTC(2026, 2, 29, 7),
              closes_at: Date.UTC(2026, 2, 29, 17),
            },
          ],
          ends_at: Date.UTC(2026, 2, 29, 22),
        },
      },
      tickets: [
        makeTicket('a', {
          service_date: '2026-03-29',
          closing_decision: 'serve',
        }),
      ],
    });
    expect(
      ticketOf(
        detectTimeTriggers(state, Date.UTC(2026, 2, 29, 21, 59)).state,
        'a',
      ).status,
    ).toBe('waiting');
    expect(
      ticketOf(detectTimeTriggers(state, Date.UTC(2026, 2, 29, 22)).state, 'a')
        .status,
    ).toBe('cancelled');
  });
});

describe('Salon indicators (E31, K36)', () => {
  it('waiting count, wait for « premier disponible » and full flag', () => {
    const state = makeState({ tickets: [makeTicket('a'), makeTicket('b')] });
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.salon).toEqual({
      waiting_count: 2,
      current_wait_minutes: 60,
      is_full: false,
    });
    expect(computeSchedule(state, at('17:50')).salon.is_full).toBe(true);
  });

  it('no estimate and not full while no stylist is present', () => {
    const state = makeState({
      members: [makeMember('ines', { presence: presence('offline') })],
      tickets: [makeTicket('a')],
    });
    const schedule = computeSchedule(state, at('09:00'));
    expect(schedule.tickets.a).toMatchObject({
      estimated_start_at: null,
      wait_minutes: null,
      position: null,
    });
    expect(schedule.salon).toEqual({
      waiting_count: 1,
      current_wait_minutes: null,
      is_full: false,
    });
  });

  it('a day without opening ranges uses midnight as the limit', () => {
    const state = makeState({
      salon: {
        service_day: {
          service_date: '2026-10-21',
          opening_ranges: [],
          ends_at: Date.UTC(2026, 9, 21, 22),
        },
      },
    });
    expect(computeSchedule(state, at('10:00')).salon.is_full).toBe(false);
    expect(computeSchedule(state, at('23:50')).salon.is_full).toBe(true);
  });

  it('position counts the clients before him at his stylist, the called one included (E13)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim')],
      tickets: [
        calledTicket('c', 'ines', at('09:59')),
        makeTicket('a', { requested_member_id: 'ines' }),
        makeTicket('b', { requested_member_id: 'ines' }),
        makeTicket('k', { requested_member_id: 'karim' }),
      ],
    });
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.tickets.a?.position).toBe(1);
    expect(schedule.tickets.b?.position).toBe(2);
    expect(schedule.tickets.k?.position).toBe(0);
  });

  it('a called client not yet arrived occupies his stylist from his announced arrival', () => {
    const state = makeState({
      tickets: [
        calledTicket('c', 'ines', at('10:00'), {
          eta_response: 'late',
          declared_delay_minutes: 20,
          declared_arrival_at: at('10:20'),
          release_due_at: at('10:20'),
        }),
        makeTicket('a'),
      ],
    });
    expect(
      computeSchedule(state, at('10:00')).tickets.a?.estimated_start_at,
    ).toBe(at('10:50'));
  });
});

describe('Pending-confirmation and appointment tickets (step 2 placeholders)', () => {
  it('pending_confirmation tickets never count in any estimate (invariant 8)', () => {
    const state = makeState({
      tickets: [
        makeTicket('p', {
          status: 'pending_confirmation',
          kind: 'appointment',
          scheduled_at: at('10:00'),
          appointment_source: 'client_check_in',
        }),
        makeTicket('a'),
      ],
    });
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.tickets.p).toBeUndefined();
    expect(schedule.tickets.a?.estimated_start_at).toBe(at('10:00'));
    expect(schedule.salon.waiting_count).toBe(1);
  });
});

describe('Repeated join after an earlier ticket of the day', () => {
  it('rank keeps growing across the day', () => {
    const first = ok(makeState(), joinQueue('a'), at('10:00')).state;
    const second = ok(first, joinQueue('b'), at('10:01')).state;
    expect(ticketOf(second, 'b').queue_rank).toBe(
      ticketOf(second, 'a').queue_rank + 1,
    );
    expect(min(1)).toBe(60_000);
  });
});
