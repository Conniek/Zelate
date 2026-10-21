/** detectTimeTriggers: idempotence and the triggers not covered by the rule files. */
import { describe, expect, it } from 'vitest';
import { detectTimeTriggers } from './index.ts';
import {
  at,
  calledTicket,
  inServiceTicket,
  makeMember,
  makeState,
  makeTicket,
  presence,
  ticketOf,
} from './testing/fixtures.ts';

describe('detectTimeTriggers', () => {
  it('is idempotent: a second tick at the same instant changes nothing', () => {
    const state = makeState({
      tickets: [calledTicket('a', 'ines', at('14:00')), makeTicket('b')],
    });
    const first = detectTimeTriggers(state, at('14:05'));
    const second = detectTimeTriggers(first.state, at('14:05'));
    expect(second.notifications).toEqual([]);
    expect(second.events).toEqual([]);
    expect(second.state).toEqual(first.state);
  });

  it('bumps queue_version only when something changed', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const first = detectTimeTriggers(state, at('10:00'));
    expect(first.state.salon.queue_version).toBe(1);
    const second = detectTimeTriggers(first.state, at('10:00'));
    expect(second.state.salon.queue_version).toBe(1);
  });

  it('T-30 and T-10 both fire when a ticket enters directly under 10 minutes', () => {
    const state = makeState({ tickets: [makeTicket('a')] });
    const out = detectTimeTriggers(state, at('10:00'));
    expect(out.notifications.map((n) => n.template).sort()).toEqual([
      'get_ready',
      'turn_approaching',
    ]);
    expect(ticketOf(out.state, 'a').t30_estimated_start_at).toBe(at('10:00'));
  });

  it('no anticipation trigger for a ticket without estimate', () => {
    const state = makeState({
      members: [makeMember('ines', { presence: presence('offline') })],
      tickets: [makeTicket('a')],
    });
    const out = detectTimeTriggers(state, at('10:00'));
    expect(out.notifications).toEqual([]);
    expect(ticketOf(out.state, 'a').turn_approaching_sent_at).toBeNull();
  });

  it('the release of one client lets the next estimates move forward in the same tick', () => {
    const state = makeState({
      tickets: [
        calledTicket('a', 'ines', at('14:00'), {
          reminder_sent_at: at('14:05'),
        }),
        makeTicket('b', {
          estimated_start_at: at('14:30'),
          last_notified_start_at: at('14:30'),
          estimate_version: 1,
          turn_approaching_sent_at: at('14:00'),
        }),
      ],
    });
    const out = detectTimeTriggers(state, at('14:10'));
    expect(ticketOf(out.state, 'b').estimated_start_at).toBe(at('14:10'));
    expect(out.notifications).toContainEqual(
      expect.objectContaining({
        ticket_id: 'b',
        template: 'estimate_changed',
        params: expect.objectContaining({ reason: 'client_ahead_left' }),
      }),
    );
  });

  it('a pending choice older than 10 minutes is resolved by the system with an audit event', () => {
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
    const out = detectTimeTriggers(state, at('10:10'));
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'stylist_change_resolved',
        ticket_id: 'a',
        actor_type: 'system',
        reason_code: 'wait',
      }),
    );
  });

  it('end-of-day warning ignores tickets already answered, decided, or without estimate', () => {
    const state = makeState({
      tickets: [
        inServiceTicket('x', 'ines', at('16:45'), {
          planned_duration_minutes: 120,
        }),
        makeTicket('a', { requested_member_id: 'nobody' }),
        makeTicket('b'),
      ],
    });
    const out = detectTimeTriggers(state, at('17:30'));
    expect(ticketOf(out.state, 'a').end_of_day_warned_at).toBeNull();
    expect(ticketOf(out.state, 'b').end_of_day_warned_at).toBe(at('17:30'));
    expect(out.events).toContainEqual(
      expect.objectContaining({
        type: 'end_of_day_warned',
        ticket_id: 'b',
        actor_type: 'system',
      }),
    );
  });

  it('tickets of other statuses are left alone at closing + 15 min', () => {
    const state = makeState({
      tickets: [
        makeTicket('a', { status: 'completed', completed_at: at('18:00') }),
        makeTicket('b', { status: 'no_show', no_show_at: at('18:00') }),
      ],
    });
    const out = detectTimeTriggers(state, at('19:20'));
    expect(out.events).toEqual([]);
  });
});
