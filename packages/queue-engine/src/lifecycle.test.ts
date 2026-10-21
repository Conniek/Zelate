/** Ticket lifecycle transitions of PRD §5.2 (1, 2 to 8; 1b is step 2). */
import { describe, expect, it } from 'vitest';
import { detectTimeTriggers } from './index.ts';
import {
  at,
  callTicket,
  calledTicket,
  cancelTicket,
  completeService,
  confirmArrival,
  inServiceTicket,
  joinQueue,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  memberOf,
  ok,
  removeTicket,
  resolveClosing,
  resolveStylistChange,
  setPresence,
  startService,
  takeNext,
  ticketOf,
  walkIn,
} from './testing/fixtures.ts';

describe('Transition 1 — creation → waiting', () => {
  it('join_queue creates a waiting ticket with rank, estimated stylist, estimate and ticket_created', () => {
    const state = makeState({
      tickets: [makeTicket('old', { queue_rank: 7 })],
    });
    const out = ok(state, joinQueue('a'), at('10:00'));
    const ticket = ticketOf(out.state, 'a');
    expect(ticket).toMatchObject({
      status: 'waiting',
      kind: 'queue',
      channel: 'app',
      queue_rank: 8,
      client_id: 'client-a',
      service_id: 'cut',
      planned_duration_minutes: 30,
      estimated_member_id: 'ines',
      estimated_start_at: at('10:30'),
      initial_estimated_start_at: at('10:30'),
      last_notified_start_at: at('10:30'),
      notifications_consent_at: at('10:00'),
      created_at: at('10:00'),
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'created',
        ticket_id: 'a',
        actor_type: 'client',
        actor_profile_id: 'client-a',
      }),
    );
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        ticket_id: 'a',
        template: 'ticket_created',
        dedupe_key: 'ticket_created',
        requires_consent: false,
      }),
    );
    expect(out.state.salon).toMatchObject({
      waiting_count: 2,
      queue_version: 1,
    });
  });

  it('without « Me prévenir » the consent column stays empty (K11, K18)', () => {
    const out = ok(
      makeState(),
      joinQueue('a', { notifications_consent: false }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a').notifications_consent_at).toBeNull();
  });

  it('register_walk_in creates a front-desk ticket of 30 min without service (E12)', () => {
    const state = makeState({ members: [makeMember('ines'), makeManager()] });
    const out = ok(state, walkIn('w'), at('10:00'));
    expect(ticketOf(out.state, 'w')).toMatchObject({
      status: 'waiting',
      channel: 'front_desk',
      client_id: null,
      service_id: null,
      planned_duration_minutes: 30,
      created_by_member_id: 'gerant',
      notifications_consent_at: null,
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({ type: 'created', actor_type: 'manager' }),
    );
  });
});

describe('Transition 2 — waiting → called', () => {
  it('fixes the stylist, counts the call, starts the countdown and sends « votre tour »', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const out = ok(state, callTicket('ines'), at('10:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'called',
      assigned_member_id: 'ines',
      call_count: 1,
      called_at: at('10:00'),
      release_due_at: at('10:10'),
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({ type: 'called', actor_type: 'stylist' }),
    );
    expect(out.notifications.map((n) => n.dedupe_key)).toEqual(['your_turn:1']);
  });

  it('works while the queue is paused (E4)', () => {
    const state = makeState({
      salon: { queue_status: 'paused' },
      tickets: [makeTicket('a')],
    });
    expect(
      ticketOf(ok(state, callTicket('ines'), at('10:00')).state, 'a').status,
    ).toBe('called');
  });

  it('the manager who does not cut hair can still « take the next one » (rule 5)', () => {
    const state = makeState({
      members: [makeManager('gerant')],
      tickets: [
        makeTicket('a', { service_id: null, planned_duration_minutes: 30 }),
      ],
    });
    const out = ok(state, callTicket('gerant'), at('10:00'));
    expect(ticketOf(out.state, 'a').assigned_member_id).toBe('gerant');
  });
});

describe('Transition 3 — called → waiting (« Prendre le suivant »)', () => {
  it('only after a declared delay, with notification and audit event', () => {
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
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'waiting',
      postpone_count: 1,
    });
    expect(out.notifications.map((n) => n.template)).toEqual(
      expect.arrayContaining(['postponed', 'your_turn']),
    );
  });
});

describe('Transition 4 — called → in_service', () => {
  it('needs the validated arrival, records the planned duration and puts the stylist in service', () => {
    const state = makeState({
      tickets: [
        calledTicket('a', 'ines', at('10:00'), { short_code: 'AF2K9' }),
      ],
    });
    const arrived = ok(state, confirmArrival('ines', 'AF2K9'), at('10:04'));
    const out = ok(
      arrived.state,
      startService('ines', 'a', 45, 'cut'),
      at('10:05'),
    );
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'in_service',
      started_at: at('10:05'),
      planned_duration_minutes: 45,
      called_at: null,
      release_due_at: null,
      reminder_sent_at: null,
      call_count: 1,
    });
    expect(memberOf(out.state, 'ines').presence.status).toBe('in_service');
  });
});

describe('Transition 5 — in_service → completed', () => {
  it('records the real duration, frees the stylist and counts the client served', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: { ...makeMember('x').presence, status: 'in_service' },
        }),
      ],
      tickets: [inServiceTicket('a', 'ines', at('10:00'))],
    });
    const out = ok(state, completeService('ines', 'a'), at('10:37'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      status: 'completed',
      completed_at: at('10:37'),
      actual_duration_minutes: 37,
    });
    expect(memberOf(out.state, 'ines')).toMatchObject({
      served_today_count: 1,
      presence: expect.objectContaining({ status: 'available' }),
    });
  });
});

describe('Transition 6 — waiting or called → cancelled', () => {
  it('by the client, by the manager with a reason, or by the end of day; the next ones move up', () => {
    const state = makeState({
      members: [makeMember('ines'), makeManager()],
      tickets: [makeTicket('a'), makeTicket('b'), makeTicket('c')],
    });
    const first = ok(state, cancelTicket('a'), at('10:00'));
    expect(ticketOf(first.state, 'b').estimated_start_at).toBe(at('10:00'));
    const second = ok(first.state, removeTicket('b', 'other'), at('10:01'));
    expect(ticketOf(second.state, 'b').cancel_reason).toBe('removed_by_salon');
    const third = ok(
      second.state,
      resolveClosing(['c'], 'cancel'),
      at('19:00'),
    );
    expect(ticketOf(third.state, 'c')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'end_of_day',
      closing_decision: 'cancel',
    });
  });
});

describe('Transition 7 — called → no_show', () => {
  it('at release_due_at without arrival, by the system', () => {
    const state = makeState({
      tickets: [calledTicket('a', 'ines', at('10:00'))],
    });
    const out = detectTimeTriggers(state, at('10:10'));
    expect(ticketOf(out.state, 'a').status).toBe('no_show');
  });
});

describe('Transition 8 — waiting → waiting with a stylist choice', () => {
  it('requested stylist declared late: choice with « attendre »; without answer in 10 min, he waits', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets: [makeTicket('a', { requested_member_id: 'ines' })],
    });
    const out = ok(
      state,
      setPresence('gerant', 'ines', 'late', { until: at('11:00') }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'a').stylist_change_pending_since).toBe(
      at('10:00'),
    );
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        template: 'stylist_change_required',
        variant: null,
        requires_consent: false,
      }),
    );
    const timeout = detectTimeTriggers(out.state, at('10:10'));
    expect(ticketOf(timeout.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      stylist_change_pending_since: null,
    });
  });

  it('requested stylist absent all day: no « attendre »; without answer in 10 min, first available (E7)', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets: [makeTicket('a', { requested_member_id: 'ines' })],
    });
    const out = ok(state, setPresence('gerant', 'ines', 'absent'), at('10:00'));
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        template: 'stylist_change_required',
        variant: 'no_wait',
      }),
    );
    expect(
      ticketOf(detectTimeTriggers(out.state, at('10:09')).state, 'a')
        .requested_member_id,
    ).toBe('ines');
    const timeout = detectTimeTriggers(out.state, at('10:10'));
    expect(ticketOf(timeout.state, 'a')).toMatchObject({
      requested_member_id: null,
      stylist_change_pending_since: null,
      estimated_member_id: 'karim',
    });
  });

  it('the client answers « premier disponible » without losing his rank', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim'), makeManager()],
      tickets: [
        makeTicket('a', { requested_member_id: 'ines', queue_rank: 4 }),
      ],
    });
    const pending = ok(
      state,
      setPresence('gerant', 'ines', 'absent'),
      at('10:00'),
    ).state;
    const out = ok(
      pending,
      resolveStylistChange('a', 'first_available'),
      at('10:03'),
    );
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: null,
      queue_rank: 4,
      stylist_change_pending_since: null,
    });
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'stylist_change_resolved',
        reason_code: 'first_available',
      }),
    );
  });
});
