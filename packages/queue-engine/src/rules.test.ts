/**
 * One `describe` per validated rule H1-H9 (PRD §5.1). H10 (appointments) is
 * step 2 of DEV-2.
 */
import { describe, expect, it } from 'vitest';
import {
  computeSchedule,
  detectTimeTriggers,
  estimateStylist,
  pickNextTicket,
} from './index.ts';
import {
  adjustDuration,
  at,
  callTicket,
  calledTicket,
  cancelTicket,
  completeService,
  confirmArrival,
  fails,
  inServiceTicket,
  joinQueue,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  ok,
  presence,
  removeTicket,
  respondEndOfDay,
  respondEta,
  startService,
  takeNext,
  ticketOf,
  walkIn,
} from './testing/fixtures.ts';

describe('H1 — one queue per salon, first free stylist who masters the service', () => {
  it('a ticket without preference is estimated with the stylist who frees up first (rule 2)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim')],
      tickets: [inServiceTicket('x', 'ines', at('09:50')), makeTicket('a')],
    });
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.tickets.a?.estimated_member_id).toBe('karim');
    expect(schedule.tickets.a?.estimated_start_at).toBe(at('10:00'));
  });

  it('on a tie, the stylist who served the fewest clients today is chosen (rule 2)', () => {
    const state = makeState({
      members: [
        makeMember('ines', { served_today_count: 3 }),
        makeMember('karim', { served_today_count: 1 }),
      ],
      tickets: [makeTicket('a'), makeTicket('b')],
    });
    expect(estimateStylist(state, 'a', at('10:00'))).toBe('karim');
    expect(estimateStylist(state, 'b', at('10:00'))).toBe('ines');
  });

  it('only a stylist who masters the required specialty is estimated (rule 2)', () => {
    const state = makeState({
      members: [
        makeMember('ines', { served_today_count: 0 }),
        makeMember('karim', {
          specialties: ['men_cut', 'color'],
          served_today_count: 5,
        }),
      ],
      tickets: [
        makeTicket('a', { service_id: 'color', planned_duration_minutes: 60 }),
      ],
    });
    expect(estimateStylist(state, 'a', at('10:00'))).toBe('karim');
  });

  it('a requested stylist keeps the ticket for himself even if another is free (rule 1)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim')],
      tickets: [
        inServiceTicket('x', 'ines', at('09:50')),
        makeTicket('a', { requested_member_id: 'ines' }),
      ],
    });
    const estimate = computeSchedule(state, at('10:00')).tickets.a;
    expect(estimate?.estimated_member_id).toBe('ines');
    expect(estimate?.estimated_start_at).toBe(at('10:20'));
  });

  it('the freed stylist calls the first eligible ticket and skips tickets requesting someone else, which keep their rank (rule 4)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim')],
      tickets: [
        makeTicket('a', { requested_member_id: 'karim', queue_rank: 1 }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('10:00'))?.id).toBe('b');
    const out = ok(state, callTicket('ines'), at('10:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'waiting',
      queue_rank: 1,
    });
    expect(ticketOf(out.state, 'b').status).toBe('called');
  });

  it('a service without specialty, or « je ne sais pas encore », is accepted by every stylist (E12)', () => {
    const state = makeState({
      members: [makeMember('karim', { specialties: ['beard'] })],
      tickets: [
        makeTicket('a', { service_id: null, planned_duration_minutes: 30 }),
        makeTicket('b', {
          service_id: 'blowdry',
          planned_duration_minutes: 15,
        }),
        makeTicket('c', { service_id: 'cut' }),
      ],
    });
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.tickets.a?.estimated_member_id).toBe('karim');
    expect(schedule.tickets.b?.estimated_member_id).toBe('karim');
    expect(schedule.tickets.c?.estimated_start_at).toBeNull();
  });

  it('a manager with « Je coiffe » on is an ordinary stylist; off, he is out of the distribution (rule 5)', () => {
    const tickets = [
      makeTicket('a', { service_id: 'blowdry', planned_duration_minutes: 15 }),
    ];
    const on = makeState({
      members: [makeManager('gerant', { is_hairdressing: true })],
      tickets,
    });
    const off = makeState({ members: [makeManager('gerant')], tickets });
    expect(estimateStylist(on, 'a', at('10:00'))).toBe('gerant');
    expect(estimateStylist(off, 'a', at('10:00'))).toBeNull();
  });

  it('no stylist is fixed before the call: assigned_member_id is set by call_ticket only (ADR-015)', () => {
    const state = makeState({ members: [makeMember('ines')] });
    const joined = ok(state, joinQueue('a'), at('10:00'));
    expect(ticketOf(joined.state, 'a')).toMatchObject({
      assigned_member_id: null,
      estimated_member_id: 'ines',
    });
    const called = ok(joined.state, callTicket('ines'), at('10:01'));
    expect(ticketOf(called.state, 'a').assigned_member_id).toBe('ines');
  });
});

describe('H2 — wait simulated stylist by stylist, +5/+15/+30/+45 adjustments', () => {
  it('T_k = t0 + R + sum of the durations before him', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:50'), {
          planned_duration_minutes: 30,
        }),
        makeTicket('a'),
        makeTicket('b'),
      ],
    });
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.tickets.a?.estimated_start_at).toBe(at('10:20'));
    expect(schedule.tickets.b?.estimated_start_at).toBe(at('10:50'));
    expect(schedule.tickets.a?.wait_minutes).toBe(20);
    expect(schedule.tickets.b?.wait_minutes).toBe(50);
  });

  it('an overrunning service counts for a minimum of 5 minutes', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:20'), {
          planned_duration_minutes: 30,
        }),
        makeTicket('a'),
      ],
    });
    expect(
      computeSchedule(state, at('10:00')).tickets.a?.estimated_start_at,
    ).toBe(at('10:05'));
  });

  it('a service with an unknown duration counts for 30 minutes', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { service_id: null, planned_duration_minutes: 30 }),
        makeTicket('b'),
      ],
    });
    expect(
      computeSchedule(state, at('10:00')).tickets.b?.estimated_start_at,
    ).toBe(at('10:30'));
  });

  it('the displayed wait is rounded up to the next 5 minutes', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:47'), {
          planned_duration_minutes: 30,
        }),
        makeTicket('a'),
      ],
    });
    const estimate = computeSchedule(state, at('10:00')).tickets.a;
    expect(estimate?.estimated_start_at).toBe(at('10:17'));
    expect(estimate?.wait_minutes).toBe(20);
  });

  it('t0 is the end of a break when it is later than now', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: presence('on_break', {
            break_type: 'meal',
            expected_back_at: at('10:40'),
          }),
        }),
      ],
      tickets: [makeTicket('a')],
    });
    expect(
      computeSchedule(state, at('10:00')).tickets.a?.estimated_start_at,
    ).toBe(at('10:40'));
  });

  it('t0 is the expected arrival of a late stylist', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: presence('late', { expected_back_at: at('11:15') }),
        }),
      ],
      tickets: [makeTicket('a')],
    });
    expect(
      computeSchedule(state, at('10:00')).tickets.a?.estimated_start_at,
    ).toBe(at('11:15'));
  });

  it('adjust_duration accepts +5, +15, +30, +45 and moves the following estimates', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:50'), {
          planned_duration_minutes: 30,
        }),
        makeTicket('a'),
      ],
    });
    let current = state;
    for (const delta of [5, 15, 30, 45]) {
      current = ok(
        current,
        adjustDuration('ines', 'x', delta),
        at('10:00'),
      ).state;
    }
    expect(ticketOf(current, 'x').planned_duration_minutes).toBe(125);
    expect(ticketOf(current, 'a').estimated_start_at).toBe(at('11:55'));
    expect(fails(state, adjustDuration('ines', 'x', 10), at('10:00'))).toBe(
      'invalid_payload',
    );
  });
});

describe('H3 — T-30 with answer, T-10, « votre tour »', () => {
  const base = () =>
    makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('09:30'), {
          planned_duration_minutes: 60,
        }),
        makeTicket('a'),
      ],
    });

  it('T-30 fires once when the estimate is 30 minutes away or less, and records the T-30 estimate', () => {
    const early = detectTimeTriggers(base(), at('09:59'));
    expect(ticketOf(early.state, 'a').turn_approaching_sent_at).toBeNull();

    const out = detectTimeTriggers(base(), at('10:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      turn_approaching_sent_at: at('10:00'),
      t30_estimated_start_at: at('10:30'),
    });
    expect(out.notifications.map((n) => n.dedupe_key)).toContain(
      'turn_approaching',
    );

    const again = detectTimeTriggers(out.state, at('10:01'));
    expect(again.notifications.map((n) => n.template)).not.toContain(
      'turn_approaching',
    );
  });

  it('T-10 fires once when the estimate is 10 minutes away or less', () => {
    const t30 = detectTimeTriggers(base(), at('10:00')).state;
    const out = detectTimeTriggers(t30, at('10:20'));
    expect(ticketOf(out.state, 'a').get_ready_sent_at).toBe(at('10:20'));
    expect(out.notifications.map((n) => n.template)).toContain('get_ready');
    const again = detectTimeTriggers(out.state, at('10:21'));
    expect(again.notifications.map((n) => n.template)).not.toContain(
      'get_ready',
    );
  });

  it('« votre tour » goes out at each call, keyed by call number', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const out = ok(state, callTicket('ines'), at('10:00'));
    const yourTurn = out.notifications.find((n) => n.template === 'your_turn');
    expect(yourTurn).toMatchObject({
      dedupe_key: 'your_turn:1',
      requires_consent: false,
    });
  });

  it('the T-30 answer « late » records the announced arrival time without moving the ticket back (K13, E2)', () => {
    const t30 = detectTimeTriggers(base(), at('10:00')).state;
    const out = ok(t30, respondEta('a', 'late', 20), at('10:02'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      eta_response: 'late',
      declared_delay_minutes: 20,
      declared_arrival_at: at('10:50'),
      postpone_count: 0,
      queue_rank: ticketOf(t30, 'a').queue_rank,
    });
  });
});

describe('H4 — 10-min countdown after the call, reminder at 5 min, automatic release', () => {
  const called = () =>
    makeState({
      tickets: [
        calledTicket('a', 'ines', at('14:00'), { short_code: 'AF2K9' }),
      ],
    });

  it('the call sets release_due_at 10 minutes later', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const out = ok(state, callTicket('ines'), at('14:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'called',
      called_at: at('14:00'),
      release_due_at: at('14:10'),
      call_count: 1,
    });
  });

  it('the reminder goes out 5 minutes after the call, once', () => {
    expect(detectTimeTriggers(called(), at('14:04')).notifications).toEqual([]);
    const out = detectTimeTriggers(called(), at('14:05'));
    expect(ticketOf(out.state, 'a').reminder_sent_at).toBe(at('14:05'));
    expect(out.notifications).toEqual([
      expect.objectContaining({
        template: 'arrival_reminder',
        dedupe_key: 'arrival_reminder:1',
        requires_consent: false,
      }),
    ]);
    const again = detectTimeTriggers(out.state, at('14:06'));
    expect(again.notifications).toEqual([]);
  });

  it('the place is released at release_due_at: called → no_show, call columns cleared (K31)', () => {
    const out = detectTimeTriggers(called(), at('14:10'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'no_show',
      no_show_at: at('14:10'),
      called_at: null,
      release_due_at: null,
      reminder_sent_at: null,
    });
    expect(out.notifications.map((n) => n.template)).toContain(
      'released_no_show',
    );
    expect(out.events).toContainEqual(
      expect.objectContaining({ type: 'no_show', actor_type: 'system' }),
    );
  });

  it('a client whose arrival is validated is neither reminded nor released', () => {
    const arrived = ok(called(), confirmArrival('ines', 'AF2K9'), at('14:04'));
    const out = detectTimeTriggers(arrived.state, at('14:11'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'called',
      reminder_sent_at: null,
    });
  });

  it('with a declared delay, release waits for the announced arrival time and the reminder goes 5 min before it (E2, E33 default)', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', {
          eta_response: 'late',
          declared_delay_minutes: 25,
          declared_arrival_at: at('14:20'),
        }),
      ],
    });
    const out = ok(state, callTicket('ines'), at('14:00'));
    expect(ticketOf(out.state, 'a').release_due_at).toBe(at('14:20'));
    expect(detectTimeTriggers(out.state, at('14:10')).notifications).toEqual(
      [],
    );
    const reminder = detectTimeTriggers(out.state, at('14:15'));
    expect(reminder.notifications.map((n) => n.template)).toEqual([
      'arrival_reminder',
    ]);
    expect(
      ticketOf(detectTimeTriggers(out.state, at('14:19')).state, 'a').status,
    ).toBe('called');
    expect(
      ticketOf(detectTimeTriggers(out.state, at('14:20')).state, 'a').status,
    ).toBe('no_show');
  });

  it('an announced arrival earlier than 10 minutes after the call keeps the 10-min release (E2)', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', {
          eta_response: 'late',
          declared_delay_minutes: 5,
          declared_arrival_at: at('14:05'),
        }),
      ],
    });
    const out = ok(state, callTicket('ines'), at('14:00'));
    expect(ticketOf(out.state, 'a').release_due_at).toBe(at('14:10'));
  });
});

describe('H5 — no free reordering; back at most 2 places, only after a declared delay', () => {
  const lateCalled = (postpone_count = 0) =>
    makeState({
      tickets: [
        calledTicket('a', 'ines', at('10:00'), {
          queue_rank: 1,
          eta_response: 'late',
          declared_delay_minutes: 15,
          declared_arrival_at: at('10:20'),
          postpone_count,
        }),
        makeTicket('b', { queue_rank: 2 }),
        makeTicket('c', { queue_rank: 3 }),
        makeTicket('d', { queue_rank: 4 }),
      ],
    });

  it('« Prendre le suivant » moves the late client back 2 places and calls the next one', () => {
    const out = ok(lateCalled(), takeNext('ines', 'a'), at('10:02'));
    const order = [...out.state.tickets]
      .sort((x, y) => x.queue_rank - y.queue_rank)
      .map((t) => t.id);
    expect(order).toEqual(['b', 'c', 'a', 'd']);
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'waiting',
      postpone_count: 2,
      called_at: null,
      release_due_at: null,
      reminder_sent_at: null,
      assigned_member_id: null,
    });
    expect(ticketOf(out.state, 'b')).toMatchObject({
      status: 'called',
      assigned_member_id: 'ines',
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'postponed',
        ticket_id: 'a',
        reason_code: 'client_late',
      }),
    );
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        ticket_id: 'a',
        template: 'postponed',
        requires_consent: false,
      }),
    );
  });

  it('the total move back is capped at 2 places', () => {
    const out = ok(lateCalled(1), takeNext('ines', 'a'), at('10:02'));
    expect(ticketOf(out.state, 'a').postpone_count).toBe(2);
    const order = [...out.state.tickets]
      .sort((x, y) => x.queue_rank - y.queue_rank)
      .map((t) => t.id);
    expect(order).toEqual(['b', 'a', 'c', 'd']);
    expect(fails(lateCalled(2), takeNext('ines', 'a'), at('10:02'))).toBe(
      'postpone_limit_reached',
    );
  });

  it('without a declared delay the client cannot be moved back', () => {
    const state = makeState({
      tickets: [calledTicket('a', 'ines', at('10:00')), makeTicket('b')],
    });
    expect(fails(state, takeNext('ines', 'a'), at('10:02'))).toBe(
      'invalid_transition',
    );
  });

  it('a declared delay alone never moves a ticket back (E2)', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { queue_rank: 1 }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    const out = ok(state, respondEta('a', 'late', 30), at('10:00'));
    expect(pickNextTicket(out.state, 'ines', at('10:01'))?.id).toBe('a');
    expect(ticketOf(out.state, 'a').postpone_count).toBe(0);
  });
});

describe('H6 — the client phone number never reaches the engine output', () => {
  it('walk-in, join and call produce no phone, token or first name in state, events or notifications', () => {
    const state = makeState({ members: [makeMember('ines'), makeManager()] });
    const joined = ok(state, joinQueue('a'), at('10:00'));
    const walked = ok(joined.state, walkIn('b'), at('10:01'));
    const called = ok(walked.state, callTicket('ines'), at('10:02'));
    const serialized = JSON.stringify([joined, walked, called]);
    expect(serialized).not.toMatch(/phone|token|first_name|display_name|\+33/);
  });
});

describe('H7 — arrival validated by the ticket code', () => {
  it('confirm_arrival stamps arrived_at; start_service requires it', () => {
    const state = makeState({
      tickets: [
        calledTicket('a', 'ines', at('10:00'), { short_code: 'AF2K9' }),
      ],
    });
    expect(fails(state, startService('ines', 'a'), at('10:01'))).toBe(
      'invalid_transition',
    );
    const arrived = ok(state, confirmArrival('ines', 'af2k9'), at('10:03'));
    expect(ticketOf(arrived.state, 'a').arrived_at).toBe(at('10:03'));
    expect(arrived.events).toContainEqual(
      expect.objectContaining({ type: 'arrival_confirmed', ticket_id: 'a' }),
    );
    const started = ok(arrived.state, startService('ines', 'a'), at('10:04'));
    expect(ticketOf(started.state, 'a').status).toBe('in_service');
  });

  it('a client already arrived and at the head can be called then started at once', () => {
    const state = makeState({
      tickets: [makeTicket('a', { arrived_at: at('09:58') })],
    });
    const called = ok(state, callTicket('ines'), at('10:00'));
    const started = ok(called.state, startService('ines', 'a'), at('10:00'));
    expect(ticketOf(started.state, 'a').status).toBe('in_service');
  });
});

describe('H8 — declared arrival time', () => {
  it('when his turn comes before his declared time, the next ticket passes', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { queue_rank: 1, declared_arrival_at: at('10:20') }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('10:00'))?.id).toBe('b');
    const schedule = computeSchedule(state, at('10:00'));
    expect(schedule.tickets.b?.estimated_start_at).toBe(at('10:00'));
    expect(schedule.tickets.a?.estimated_start_at).toBe(at('10:30'));
  });

  it('he takes the head of the queue back once his declared time is reached', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { queue_rank: 1, declared_arrival_at: at('10:20') }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('10:20'))?.id).toBe('a');
  });

  it('E34 — he takes the head back at his declared time, not at a physical arrival', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', {
          queue_rank: 1,
          declared_arrival_at: at('10:20'),
          arrived_at: at('10:05'),
        }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('10:06'))?.id).toBe('b');
    expect(pickNextTicket(state, 'ines', at('10:20'))?.id).toBe('a');
  });

  it('E34 — after his declared time he is eligible again even without a recorded arrival', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { queue_rank: 1, declared_arrival_at: at('10:20') }),
        makeTicket('b', { queue_rank: 2 }),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('10:25'))?.id).toBe('a');
    const called = ok(state, callTicket('ines'), at('10:25'));
    expect(ticketOf(called.state, 'a')).toMatchObject({
      status: 'called',
      arrived_at: null,
      release_due_at: at('10:35'),
    });
  });

  it('the stylist with no other client waits for the declared time in the estimate', () => {
    const state = makeState({
      tickets: [makeTicket('a', { declared_arrival_at: at('10:20') })],
    });
    const estimate = computeSchedule(state, at('10:00')).tickets.a;
    expect(estimate?.estimated_start_at).toBe(at('10:20'));
    expect(estimate?.wait_minutes).toBe(20);
  });

  it('join_queue records the declared arrival time', () => {
    const out = ok(
      makeState(),
      joinQueue('a', { declared_arrival_at: at('10:45') }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a')).toMatchObject({
      declared_arrival_at: at('10:45'),
      estimated_start_at: at('10:45'),
    });
  });
});

describe('H9 — end of day: one warning from 2 h before the last closing, manager decides at closing', () => {
  const risky = () =>
    makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('16:45'), {
          planned_duration_minutes: 120,
        }),
        makeTicket('a'),
      ],
    });

  it('no warning before the window', () => {
    const out = detectTimeTriggers(risky(), at('16:59'));
    expect(ticketOf(out.state, 'a').end_of_day_warned_at).toBeNull();
  });

  it('a client whose estimated end passes the last closing is warned once', () => {
    const out = detectTimeTriggers(risky(), at('17:00'));
    expect(ticketOf(out.state, 'a').end_of_day_warned_at).toBe(at('17:00'));
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        template: 'end_of_day_risk',
        dedupe_key: 'end_of_day_risk',
        requires_consent: true,
      }),
    );
    const again = detectTimeTriggers(out.state, at('17:01'));
    expect(again.notifications.map((n) => n.template)).not.toContain(
      'end_of_day_risk',
    );
    expect(ticketOf(again.state, 'a').end_of_day_warned_at).toBe(at('17:00'));
  });

  it('commands inside the window also relaunch the warning check', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('17:30'), {
          planned_duration_minutes: 60,
        }),
        makeTicket('a'),
      ],
    });
    const out = ok(state, adjustDuration('ines', 'x', 45), at('17:40'));
    expect(ticketOf(out.state, 'a').end_of_day_warned_at).toBe(at('17:40'));
  });

  it("« Je reste » and « J'annule » answer the warning", () => {
    const warned = detectTimeTriggers(risky(), at('17:00')).state;
    const stay = ok(warned, respondEndOfDay('a', 'stay'), at('17:05'));
    expect(ticketOf(stay.state, 'a').end_of_day_choice).toBe('stay');
    const cancel = ok(warned, respondEndOfDay('a', 'cancel'), at('17:05'));
    expect(ticketOf(cancel.state, 'a')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'client_cancelled',
      end_of_day_choice: 'cancel',
    });
  });

  it('without a manager decision, remaining clients are cancelled 15 min after the last closing', () => {
    const state = makeState({
      tickets: [
        makeTicket('a'),
        makeTicket('b', { closing_decision: 'serve' }),
      ],
    });
    expect(
      ticketOf(detectTimeTriggers(state, at('19:14')).state, 'a').status,
    ).toBe('waiting');
    const out = detectTimeTriggers(state, at('19:15'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'end_of_day',
    });
    expect(ticketOf(out.state, 'b').status).toBe('waiting');
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        ticket_id: 'a',
        template: 'cancelled_by_salon',
        variant: 'end_of_day',
        requires_consent: false,
      }),
    );
  });

  it('a lunch break does not count as the closing: only the last range of the day does', () => {
    const state = makeState({
      salon: {
        service_day: {
          service_date: '2026-10-21',
          opening_ranges: [
            { opens_at: at('14:00'), closes_at: at('19:00') },
            { opens_at: at('09:00'), closes_at: at('12:00') },
          ],
          ends_at: Date.UTC(2026, 9, 21, 22),
        },
      },
      tickets: [makeTicket('a')],
    });
    const lunch = detectTimeTriggers(state, at('12:30'));
    expect(ticketOf(lunch.state, 'a').status).toBe('waiting');
    expect(ticketOf(lunch.state, 'a').end_of_day_warned_at).toBeNull();
  });
});

describe('Cancelling and removing (transition 6, E3)', () => {
  it('a called client cancels for free, without an absence', () => {
    const state = makeState({
      tickets: [calledTicket('a', 'ines', at('10:00'))],
    });
    const out = ok(state, cancelTicket('a'), at('10:03'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'client_cancelled',
      no_show_at: null,
      called_at: null,
    });
  });

  it('removal by the manager needs a reason from removal_reason', () => {
    const state = makeState({
      members: [makeMember('ines'), makeManager()],
      tickets: [makeTicket('a')],
    });
    expect(fails(state, removeTicket('a', 'because'), at('10:00'))).toBe(
      'invalid_payload',
    );
    const out = ok(state, removeTicket('a', 'duplicate'), at('10:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'removed_by_salon',
      removal_reason: 'duplicate',
    });
  });

  it('the manager can complete a service the stylist forgot (E15)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeManager()],
      tickets: [inServiceTicket('a', 'ines', at('10:00'))],
    });
    const out = ok(state, completeService('gerant', 'a'), at('10:40'));
    expect(ticketOf(out.state, 'a').status).toBe('completed');
    expect(out.events).toContainEqual(
      expect.objectContaining({ type: 'completed', actor_type: 'manager' }),
    );
  });
});
