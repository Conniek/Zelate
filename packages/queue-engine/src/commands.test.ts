/** Error codes of every core command (TRD §6.2). */
import { describe, expect, it } from 'vitest';
import { applyCommand } from './index.ts';
import type { Command } from './index.ts';
import {
  adjustDuration,
  at,
  callTicket,
  calledTicket,
  cancelTicket,
  client,
  completeService,
  confirmArrival,
  fails,
  inServiceTicket,
  joinQueue,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  member,
  ok,
  presence,
  removeTicket,
  resolveClosing,
  resolveStylistChange,
  respondEndOfDay,
  respondEta,
  setHairdressing,
  setPresence,
  setQueueStatus,
  startService,
  takeNext,
  ticketOf,
  token,
  walkIn,
} from './testing/fixtures.ts';

const team = () => [makeMember('ines'), makeMember('karim'), makeManager()];

describe('join_queue errors', () => {
  it('queue_closed and queue_paused', () => {
    expect(
      fails(
        makeState({ salon: { queue_status: 'closed' } }),
        joinQueue('a'),
        at('10:00'),
      ),
    ).toBe('queue_closed');
    expect(
      fails(
        makeState({ salon: { queue_status: 'paused' } }),
        joinQueue('a'),
        at('10:00'),
      ),
    ).toBe('queue_paused');
  });

  it('queue_full when the new service would end after the last closing (K36)', () => {
    expect(fails(makeState(), joinQueue('a'), at('18:31'))).toBe('queue_full');
    expect(
      ok(makeState(), joinQueue('a', { service_id: 'blowdry' }), at('18:31'))
        .state.tickets,
    ).toHaveLength(1);
  });

  it('already_has_active_ticket, in this salon or elsewhere', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    expect(fails(state, joinQueue('b', {}, client('a')), at('10:00'))).toBe(
      'already_has_active_ticket',
    );
    expect(
      fails(
        makeState(),
        joinQueue('a', { has_active_ticket_elsewhere: true }),
        at('10:00'),
      ),
    ).toBe('already_has_active_ticket');
    const closed = makeState({
      tickets: [
        makeTicket('a', { status: 'completed', completed_at: at('09:30') }),
      ],
    });
    expect(
      ok(closed, joinQueue('b', {}, client('a')), at('10:00')).state.tickets,
    ).toHaveLength(2);
  });

  it('service_unavailable for an unknown, inactive or unmastered service', () => {
    expect(
      fails(makeState(), joinQueue('a', { service_id: 'nope' }), at('10:00')),
    ).toBe('service_unavailable');
    expect(
      fails(
        makeState(),
        joinQueue('a', { service_id: 'retired' }),
        at('10:00'),
      ),
    ).toBe('service_unavailable');
    expect(
      fails(makeState(), joinQueue('a', { service_id: 'color' }), at('10:00')),
    ).toBe('service_unavailable');
  });

  it('stylist_unavailable when the requested stylist does not work today (rule 1)', () => {
    const state = makeState({
      members: [
        makeMember('ines'),
        makeMember('karim', { presence: presence('absent') }),
        makeMember('lea', { status: 'deactivated' }),
        makeManager('gerant'),
      ],
    });
    for (const requested of ['karim', 'lea', 'gerant', 'nobody']) {
      expect(
        fails(
          state,
          joinQueue('a', { requested_member_id: requested }),
          at('10:00'),
        ),
      ).toBe('stylist_unavailable');
    }
    expect(
      ok(state, joinQueue('a', { requested_member_id: 'ines' }), at('10:00'))
        .state.tickets,
    ).toHaveLength(1);
  });

  it('forbidden for a non-client actor; invalid_payload for a declared arrival after the end of the day', () => {
    expect(
      fails(makeState(), joinQueue('a', {}, member('ines')), at('10:00')),
    ).toBe('forbidden');
    expect(
      fails(
        makeState(),
        joinQueue('a', { declared_arrival_at: at('23:59') + 60_000 * 10 }),
        at('10:00'),
      ),
    ).toBe('invalid_payload');
  });

  it('a declared arrival already passed is ignored', () => {
    const out = ok(
      makeState(),
      joinQueue('a', { declared_arrival_at: at('09:00') }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a').declared_arrival_at).toBeNull();
  });
});

describe('register_walk_in errors', () => {
  it('manager only', () => {
    expect(
      fails(
        makeState({ members: team() }),
        walkIn('w', {}, member('ines')),
        at('10:00'),
      ),
    ).toBe('forbidden');
  });

  it('queue_closed, queue_paused, queue_full, already_has_active_ticket, stylist_unavailable', () => {
    const closed = makeState({
      members: team(),
      salon: { queue_status: 'closed' },
    });
    expect(fails(closed, walkIn('w'), at('10:00'))).toBe('queue_closed');
    const paused = makeState({
      members: team(),
      salon: { queue_status: 'paused' },
    });
    expect(fails(paused, walkIn('w'), at('10:00'))).toBe('queue_paused');
    expect(
      fails(makeState({ members: team() }), walkIn('w'), at('18:45')),
    ).toBe('queue_full');
    expect(
      fails(
        makeState({ members: team() }),
        walkIn('w', { phone_has_active_ticket: true }),
        at('10:00'),
      ),
    ).toBe('already_has_active_ticket');
    expect(
      fails(
        makeState({ members: team() }),
        walkIn('w', { requested_member_id: 'nobody' }),
        at('10:00'),
      ),
    ).toBe('stylist_unavailable');
  });

  it('invalid_payload for an inactive service', () => {
    expect(
      fails(
        makeState({ members: team() }),
        walkIn('w', { service_id: 'retired' }),
        at('10:00'),
      ),
    ).toBe('invalid_payload');
  });

  it('a duplicate ticket id is refused', () => {
    const state = makeState({ members: team(), tickets: [makeTicket('w')] });
    expect(fails(state, walkIn('w'), at('10:00'))).toBe('invalid_payload');
  });
});

describe('call_ticket errors', () => {
  it('call_already_in_progress with a called or in-service client', () => {
    const called = makeState({
      tickets: [calledTicket('a', 'ines', at('10:00')), makeTicket('b')],
    });
    expect(fails(called, callTicket('ines'), at('10:01'))).toBe(
      'call_already_in_progress',
    );
    const inService = makeState({
      tickets: [inServiceTicket('a', 'ines', at('10:00')), makeTicket('b')],
    });
    expect(fails(inService, callTicket('ines'), at('10:01'))).toBe(
      'call_already_in_progress',
    );
  });

  it('no_eligible_ticket when nothing is left for this stylist', () => {
    const state = makeState({
      members: team(),
      tickets: [makeTicket('a', { requested_member_id: 'karim' })],
    });
    expect(fails(state, callTicket('ines'), at('10:00'))).toBe(
      'no_eligible_ticket',
    );
  });

  it('two stylists calling in turn: the second gets the next ticket, then no_eligible_ticket (TRD §14)', () => {
    const state = makeState({
      members: team(),
      tickets: [makeTicket('a'), makeTicket('b')],
    });
    const first = ok(state, callTicket('ines'), at('10:00'));
    const second = ok(first.state, callTicket('karim'), at('10:00'));
    expect(ticketOf(second.state, 'b').assigned_member_id).toBe('karim');
    expect(fails(second.state, callTicket('gerant'), at('10:00'))).toBe(
      'no_eligible_ticket',
    );
  });

  it('invalid_transition when the stylist is on break, late, absent, offline or after his shift', () => {
    const statuses = [
      presence('on_break', {
        break_type: 'short',
        expected_back_at: at('10:15'),
      }),
      presence('late', { expected_back_at: at('10:30') }),
      presence('absent'),
      presence('offline'),
      presence('off_duty', { shift_end_at: at('09:30') }),
    ];
    for (const p of statuses) {
      const state = makeState({
        members: [makeMember('ines', { presence: p })],
        tickets: [makeTicket('a')],
      });
      expect(fails(state, callTicket('ines'), at('10:00'))).toBe(
        'invalid_transition',
      );
    }
  });

  it('forbidden for a client, an unknown or a deactivated member', () => {
    const state = makeState({
      members: [makeMember('ines', { status: 'deactivated' })],
      tickets: [makeTicket('a')],
    });
    expect(fails(state, callTicket('ines'), at('10:00'))).toBe('forbidden');
    expect(fails(state, callTicket('nobody'), at('10:00'))).toBe('forbidden');
    const asClient: Command = {
      command: 'call_ticket',
      actor: client('a'),
      payload: {},
    };
    expect(fails(state, asClient, at('10:00'))).toBe('forbidden');
  });
});

describe('confirm_arrival errors', () => {
  const state = () =>
    makeState({
      tickets: [
        calledTicket('a', 'ines', at('10:00'), { short_code: 'AF2K9' }),
        makeTicket('b', {
          short_code: 'BBBBB',
          status: 'no_show',
          no_show_at: at('09:40'),
        }),
        makeTicket('c', { short_code: 'CCCCC', arrived_at: at('09:55') }),
      ],
    });

  it('unknown_code, ticket_closed, invalid_transition when already arrived, invalid_payload for a malformed code', () => {
    expect(fails(state(), confirmArrival('ines', 'ZZZZZ'), at('10:01'))).toBe(
      'unknown_code',
    );
    expect(fails(state(), confirmArrival('ines', 'BBBBB'), at('10:01'))).toBe(
      'ticket_closed',
    );
    expect(fails(state(), confirmArrival('ines', 'CCCCC'), at('10:01'))).toBe(
      'invalid_transition',
    );
    expect(fails(state(), confirmArrival('ines', 'A0'), at('10:01'))).toBe(
      'invalid_payload',
    );
  });

  it('E34 — arrival is only recorded at the call: a waiting ticket is refused', () => {
    const state = makeState({
      tickets: [makeTicket('a', { short_code: 'AF2K9' })],
    });
    expect(fails(state, confirmArrival('ines', 'AF2K9'), at('10:00'))).toBe(
      'invalid_transition',
    );
  });

  it('forbidden for a client', () => {
    const cmd: Command = {
      command: 'confirm_arrival',
      actor: client('a'),
      payload: { short_code: 'AF2K9' },
    };
    expect(fails(state(), cmd, at('10:01'))).toBe('forbidden');
  });
});

describe('start_service, adjust_duration, complete_service errors', () => {
  const state = () =>
    makeState({
      members: team(),
      tickets: [
        calledTicket('a', 'ines', at('10:00'), { arrived_at: at('10:02') }),
        inServiceTicket('b', 'karim', at('10:00'), {
          planned_duration_minutes: 200,
        }),
        makeTicket('c'),
      ],
    });

  it('start_service: not_assigned_to_you, invalid_transition, invalid_payload', () => {
    expect(fails(state(), startService('karim', 'a'), at('10:03'))).toBe(
      'not_assigned_to_you',
    );
    expect(fails(state(), startService('ines', 'c'), at('10:03'))).toBe(
      'invalid_transition',
    );
    expect(fails(state(), startService('ines', 'a', 300), at('10:03'))).toBe(
      'invalid_payload',
    );
    expect(fails(state(), startService('ines', 'zz'), at('10:03'))).toBe(
      'invalid_payload',
    );
    expect(
      fails(state(), startService('ines', 'a', 30, 'nope'), at('10:03')),
    ).toBe('invalid_payload');
  });

  it('adjust_duration: not_assigned_to_you, duration_limit_reached, invalid_transition', () => {
    expect(fails(state(), adjustDuration('ines', 'b', 5), at('10:03'))).toBe(
      'not_assigned_to_you',
    );
    expect(fails(state(), adjustDuration('karim', 'b', 45), at('10:03'))).toBe(
      'duration_limit_reached',
    );
    expect(
      ok(
        state(),
        adjustDuration('karim', 'b', 30),
        at('10:03'),
      ).state.tickets.find((t) => t.id === 'b')?.planned_duration_minutes,
    ).toBe(230);
    expect(fails(state(), adjustDuration('ines', 'a', 5), at('10:03'))).toBe(
      'invalid_transition',
    );
  });

  it('complete_service: not_assigned_to_you for another stylist, invalid_transition when not in service', () => {
    expect(fails(state(), completeService('ines', 'b'), at('10:30'))).toBe(
      'not_assigned_to_you',
    );
    expect(fails(state(), completeService('ines', 'a'), at('10:30'))).toBe(
      'invalid_transition',
    );
  });

  it('an unknown ticket id is invalid_payload', () => {
    expect(fails(state(), completeService('ines', 'nope'), at('10:30'))).toBe(
      'invalid_payload',
    );
  });
});

describe('take_next errors', () => {
  const late = {
    eta_response: 'late' as const,
    declared_delay_minutes: 15,
    declared_arrival_at: at('10:20'),
  };

  it('not_assigned_to_you, postpone_limit_reached, no_eligible_ticket, invalid_transition', () => {
    const state = makeState({
      members: team(),
      tickets: [calledTicket('a', 'karim', at('10:00'), late), makeTicket('b')],
    });
    expect(fails(state, takeNext('ines', 'a'), at('10:01'))).toBe(
      'not_assigned_to_you',
    );
    const alone = makeState({
      tickets: [calledTicket('a', 'ines', at('10:00'), late)],
    });
    expect(fails(alone, takeNext('ines', 'a'), at('10:01'))).toBe(
      'no_eligible_ticket',
    );
    const waiting = makeState({
      tickets: [makeTicket('a', late), makeTicket('b')],
    });
    expect(fails(waiting, takeNext('ines', 'a'), at('10:01'))).toBe(
      'invalid_transition',
    );
  });
});

describe('respond_eta errors', () => {
  it('invalid_delay outside 5 to 30 minutes; bounds accepted', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    for (const delay of [4, 31, 35, null, 12.5]) {
      expect(fails(state, respondEta('a', 'late', delay), at('10:00'))).toBe(
        'invalid_delay',
      );
    }
    for (const delay of [5, 30]) {
      expect(
        ticketOf(
          ok(state, respondEta('a', 'late', delay), at('10:00')).state,
          'a',
        ).declared_delay_minutes,
      ).toBe(delay);
    }
  });

  it('forbidden for another client or token; invalid_transition once called or closed', () => {
    const state = makeState({
      tickets: [makeTicket('a'), calledTicket('b', 'ines', at('10:00'))],
    });
    expect(
      fails(state, respondEta('a', 'on_time', null, token('b')), at('10:00')),
    ).toBe('forbidden');
    expect(
      fails(state, respondEta('a', 'on_time', null, client('b')), at('10:00')),
    ).toBe('forbidden');
    expect(fails(state, respondEta('b', 'on_time'), at('10:01'))).toBe(
      'invalid_transition',
    );
  });

  it('« on time » after « late » clears the delay; « cancel » cancels for free', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const late = ok(state, respondEta('a', 'late', 10), at('10:00')).state;
    const onTime = ok(late, respondEta('a', 'on_time'), at('10:02'));
    expect(ticketOf(onTime.state, 'a')).toMatchObject({
      eta_response: 'on_time',
      declared_delay_minutes: null,
      declared_arrival_at: null,
    });
    const cancel = ok(
      state,
      respondEta('a', 'cancel', null, client('a')),
      at('10:02'),
    );
    expect(ticketOf(cancel.state, 'a')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'client_cancelled',
    });
  });
});

describe('cancel_ticket errors', () => {
  it('already_resolved when already cancelled, invalid_transition when served or absent', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', {
          status: 'cancelled',
          cancelled_at: at('09:00'),
          cancel_reason: 'client_cancelled',
        }),
        inServiceTicket('b', 'ines', at('09:50')),
        makeTicket('c', { status: 'no_show', no_show_at: at('09:30') }),
      ],
    });
    expect(fails(state, cancelTicket('a'), at('10:00'))).toBe(
      'already_resolved',
    );
    expect(fails(state, cancelTicket('b'), at('10:00'))).toBe(
      'invalid_transition',
    );
    expect(fails(state, cancelTicket('c'), at('10:00'))).toBe(
      'invalid_transition',
    );
    expect(fails(state, cancelTicket('a', member('ines')), at('10:00'))).toBe(
      'forbidden',
    );
  });
});

describe('remove_ticket errors', () => {
  it('manager only; ticket_other_salon for a ticket outside this salon; invalid_transition when in service', () => {
    const state = makeState({
      members: team(),
      tickets: [makeTicket('a'), inServiceTicket('b', 'ines', at('09:50'))],
    });
    expect(
      fails(state, removeTicket('a', 'emergency', member('ines')), at('10:00')),
    ).toBe('forbidden');
    expect(fails(state, removeTicket('zz'), at('10:00'))).toBe(
      'ticket_other_salon',
    );
    expect(fails(state, removeTicket('b'), at('10:00'))).toBe(
      'invalid_transition',
    );
  });
});

describe('set_presence errors', () => {
  it("a stylist only changes his own status; late and absent are the manager's", () => {
    const state = makeState({ members: team() });
    expect(
      fails(
        state,
        setPresence('ines', 'karim', 'on_break', {
          break_type: 'meal',
          until: at('11:00'),
        }),
        at('10:00'),
      ),
    ).toBe('forbidden');
    expect(
      fails(state, setPresence('ines', 'ines', 'absent'), at('10:00')),
    ).toBe('forbidden');
    expect(
      fails(
        state,
        setPresence('ines', 'ines', 'late', { until: at('11:00') }),
        at('10:00'),
      ),
    ).toBe('forbidden');
  });

  it('invalid_payload: break without type or end, late without arrival time, automatic statuses, unknown member', () => {
    const state = makeState({ members: team() });
    expect(
      fails(
        state,
        setPresence('ines', 'ines', 'on_break', { until: at('11:00') }),
        at('10:00'),
      ),
    ).toBe('invalid_payload');
    expect(
      fails(
        state,
        setPresence('ines', 'ines', 'on_break', { break_type: 'meal' }),
        at('10:00'),
      ),
    ).toBe('invalid_payload');
    expect(
      fails(
        state,
        setPresence('gerant', 'ines', 'late', { until: at('09:00') }),
        at('10:00'),
      ),
    ).toBe('invalid_payload');
    expect(
      fails(state, setPresence('ines', 'ines', 'in_service'), at('10:00')),
    ).toBe('invalid_payload');
    expect(
      fails(state, setPresence('ines', 'ines', 'offline'), at('10:00')),
    ).toBe('invalid_payload');
    expect(
      fails(state, setPresence('gerant', 'nobody', 'available'), at('10:00')),
    ).toBe('invalid_payload');
  });

  it('a break is refused while a client is called or in service (default)', () => {
    const state = makeState({
      tickets: [calledTicket('a', 'ines', at('10:00'))],
    });
    expect(
      fails(
        state,
        setPresence('ines', 'ines', 'on_break', {
          break_type: 'short',
          until: at('10:20'),
        }),
        at('10:01'),
      ),
    ).toBe('invalid_transition');
  });
});

describe('resolve_stylist_change errors', () => {
  it('wait_not_offered when the requested stylist is absent, not hairdressing or deactivated (E7, E8)', () => {
    for (const ines of [
      makeMember('ines', { presence: presence('absent') }),
      makeMember('ines', { status: 'deactivated' }),
      makeManager('ines'),
    ]) {
      const state = makeState({
        members: [ines, makeMember('karim')],
        tickets: [
          makeTicket('a', {
            requested_member_id: 'ines',
            stylist_change_pending_since: at('10:00'),
          }),
        ],
      });
      expect(fails(state, resolveStylistChange('a', 'wait'), at('10:02'))).toBe(
        'wait_not_offered',
      );
    }
  });

  it('already_resolved without a pending choice; invalid_transition on a closed ticket', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { requested_member_id: 'ines' }),
        makeTicket('b', {
          status: 'cancelled',
          cancelled_at: at('09:00'),
          cancel_reason: 'client_cancelled',
        }),
      ],
    });
    expect(
      fails(state, resolveStylistChange('a', 'first_available'), at('10:00')),
    ).toBe('already_resolved');
    expect(
      fails(state, resolveStylistChange('b', 'first_available'), at('10:00')),
    ).toBe('invalid_transition');
  });

  it('« wait » keeps the requested stylist when it is offered', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: presence('late', { expected_back_at: at('11:00') }),
        }),
      ],
      tickets: [
        makeTicket('a', {
          requested_member_id: 'ines',
          stylist_change_pending_since: at('10:00'),
        }),
      ],
    });
    const out = ok(state, resolveStylistChange('a', 'wait'), at('10:02'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      stylist_change_pending_since: null,
    });
  });
});

describe('respond_end_of_day errors', () => {
  it('invalid_transition without a warning; already_resolved after an answer', () => {
    const state = makeState({
      tickets: [
        makeTicket('a'),
        makeTicket('b', {
          end_of_day_warned_at: at('17:00'),
          end_of_day_choice: 'stay',
        }),
      ],
    });
    expect(fails(state, respondEndOfDay('a', 'stay'), at('17:10'))).toBe(
      'invalid_transition',
    );
    expect(fails(state, respondEndOfDay('b', 'cancel'), at('17:10'))).toBe(
      'already_resolved',
    );
  });
});

describe('set_hairdressing errors', () => {
  it('only a manager, for himself', () => {
    const state = makeState({ members: team() });
    expect(fails(state, setHairdressing(true, 'ines'), at('10:00'))).toBe(
      'forbidden',
    );
  });
});

describe('set_queue_status errors', () => {
  it('salon_not_published; manager only', () => {
    const draft = makeState({ members: team(), salon: { status: 'approved' } });
    expect(fails(draft, setQueueStatus('open'), at('10:00'))).toBe(
      'salon_not_published',
    );
    expect(
      fails(
        makeState({ members: team() }),
        setQueueStatus('open', 'ines'),
        at('10:00'),
      ),
    ).toBe('forbidden');
  });

  it('records queue_opened, queue_paused and queue_closed; closing cancels nobody', () => {
    const state = makeState({
      members: team(),
      salon: { queue_status: 'closed' },
      tickets: [makeTicket('a')],
    });
    const opened = ok(state, setQueueStatus('open'), at('09:00'));
    const paused = ok(opened.state, setQueueStatus('paused'), at('11:00'));
    const closed = ok(paused.state, setQueueStatus('closed'), at('12:00'));
    expect([opened, paused, closed].map((o) => o.events[0]?.type)).toEqual([
      'queue_opened',
      'queue_paused',
      'queue_closed',
    ]);
    expect(ticketOf(closed.state, 'a').status).toBe('waiting');
  });
});

describe('resolve_closing errors', () => {
  it('closing_not_reached before the last closing; invalid_transition on a closed ticket; manager only', () => {
    const state = makeState({
      members: team(),
      tickets: [
        makeTicket('a'),
        makeTicket('b', {
          status: 'cancelled',
          cancelled_at: at('19:15'),
          cancel_reason: 'end_of_day',
        }),
      ],
    });
    expect(fails(state, resolveClosing(['a'], 'serve'), at('18:59'))).toBe(
      'closing_not_reached',
    );
    expect(fails(state, resolveClosing(['b'], 'cancel'), at('19:20'))).toBe(
      'invalid_transition',
    );
    expect(fails(state, resolveClosing(['zz'], 'cancel'), at('19:20'))).toBe(
      'invalid_payload',
    );
    expect(
      fails(state, resolveClosing(['a'], 'serve', 'ines'), at('19:20')),
    ).toBe('forbidden');
  });

  it('serve keeps the ticket and records the decision', () => {
    const state = makeState({ members: team(), tickets: [makeTicket('a')] });
    const out = ok(state, resolveClosing(['a'], 'serve'), at('19:01'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'waiting',
      closing_decision: 'serve',
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({ type: 'closing_resolved', scope: 'salon' }),
    );
  });
});

describe('unknown command', () => {
  it('is rejected as invalid_payload', () => {
    const bogus = {
      command: 'teleport',
      actor: { type: 'system' },
      payload: {},
    } as unknown as Command;
    const result = applyCommand(makeState(), bogus, at('10:00'));
    expect(result).toEqual({ ok: false, error: { code: 'invalid_payload' } });
  });
});
