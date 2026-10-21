/** H10 — time triggers of appointments: E19 (check-in reminder) and E23 (delay alerts). */
import { describe, expect, it } from 'vitest';
import { applyCommand, detectTimeTriggers } from './index.ts';
import {
  at,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  ticketOf,
} from './testing/fixtures.ts';
import type { QueueState, TicketState } from './types.ts';

const rv = (
  id: string,
  time: string,
  overrides: Partial<TicketState> = {},
): TicketState =>
  makeTicket(id, {
    kind: 'appointment',
    scheduled_at: at(time),
    appointment_source: 'salon_entry',
    assigned_member_id: 'ines',
    channel: 'front_desk',
    client_id: null,
    ...overrides,
  });

const pending = (created: string): TicketState =>
  makeTicket('pc', {
    kind: 'appointment',
    scheduled_at: at('14:00'),
    appointment_source: 'client_check_in',
    status: 'pending_confirmation',
    channel: 'qr',
    requested_member_id: 'ines',
    created_at: at(created),
  });

const state = (tickets: TicketState[]): QueueState =>
  makeState({ members: [makeManager(), makeMember('ines')], tickets });

describe('H10 — E19 unconfirmed check-in', () => {
  it('reminds the salon once, 10 min after the check-in', () => {
    const initial = state([pending('13:50')]);
    expect(
      ticketOf(detectTimeTriggers(initial, at('13:59')).state, 'pc')
        .confirmation_reminder_sent_at,
    ).toBeNull();
    const first = detectTimeTriggers(initial, at('14:00'));
    expect(ticketOf(first.state, 'pc').confirmation_reminder_sent_at).toBe(
      at('14:00'),
    );
    const second = detectTimeTriggers(first.state, at('14:05'));
    expect(ticketOf(second.state, 'pc').confirmation_reminder_sent_at).toBe(
      at('14:00'),
    );
  });

  it('cancels it with apologies at closing', () => {
    const out = detectTimeTriggers(state([pending('18:00')]), at('19:00'));
    expect(ticketOf(out.state, 'pc')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'end_of_day',
    });
    expect(out.notifications).toMatchObject([
      { template: 'cancelled_by_salon', variant: 'end_of_day' },
    ]);
    const before = detectTimeTriggers(state([pending('18:00')]), at('18:59'));
    expect(ticketOf(before.state, 'pc').status).toBe('pending_confirmation');
  });
});

describe('H10 — E23 delay alerts', () => {
  const late = (extra: Partial<TicketState> = {}) =>
    state([
      makeTicket('w', {
        status: 'in_service',
        assigned_member_id: 'ines',
        started_at: at('13:30'),
        planned_duration_minutes: 30,
      }),
      rv('rv', '14:00', {
        client_id: 'client-rv',
        notifications_consent_at: null,
        ...extra,
      }),
    ]);

  const extend = (s: QueueState, delta_minutes: number, now: string) => {
    const out = applyCommand(
      s,
      {
        command: 'adjust_duration',
        actor: { type: 'member', member_id: 'ines' },
        payload: { ticket_id: 'w', delta_minutes },
      },
      at(now),
    );
    if (!out.ok) throw new Error(out.error.code);
    return out;
  };

  const delays = (notifications: readonly { template: string }[]) =>
    notifications.filter((n) => n.template === 'appointment_delay');

  it('stays silent below 10 min of delay', () => {
    const out = extend(late(), 5, '13:40');
    expect(
      delays(detectTimeTriggers(out.state, at('13:40')).notifications),
    ).toEqual([]);
  });

  it('warns at 10 min, without consent, once per step, with the step as key', () => {
    const out = extend(late(), 15, '13:40');
    expect(delays(out.notifications)).toEqual([]);
    const tick = detectTimeTriggers(out.state, at('13:40'));
    expect(tick.notifications).toMatchObject([
      {
        template: 'appointment_delay',
        dedupe_key: 'appointment_delay:1',
        requires_consent: false,
        params: { estimated_start_at: at('14:15') },
      },
    ]);
    expect(tick.events.map((e) => e.type)).toContain(
      'appointment_delay_warned',
    );
    expect(ticketOf(tick.state, 'rv').appointment_delay_warned_steps).toBe(1);
    const again = detectTimeTriggers(tick.state, at('13:45'));
    expect(delays(again.notifications)).toEqual([]);
  });

  it('sends one alert for a jump of several steps (5 bis)', () => {
    const out = extend(late(), 30, '13:40');
    const tick = detectTimeTriggers(out.state, at('13:40'));
    expect(delays(tick.notifications)).toMatchObject([
      { dedupe_key: 'appointment_delay:3' },
    ]);
    expect(tick.notifications.map((n) => n.template)).not.toContain(
      'estimate_changed',
    );
  });

  it('does not warn again for a step already warned, nor when the salon catches up', () => {
    const warned = extend(
      late({ appointment_delay_warned_steps: 2 }),
      15,
      '13:40',
    );
    expect(
      delays(detectTimeTriggers(warned.state, at('13:40')).notifications),
    ).toEqual([]);
    const caught = late({ appointment_delay_warned_steps: 2 });
    expect(
      delays(detectTimeTriggers(caught, at('13:40')).notifications),
    ).toEqual([]);
  });

  it('does not warn a client who is on site or called (5 quater)', () => {
    for (const extra of [
      { arrived_at: at('13:50') },
      { confirmed_at: at('13:50') },
      { status: 'called' as const },
    ]) {
      const out = extend(late(extra), 15, '13:40');
      expect(
        delays(detectTimeTriggers(out.state, at('13:40')).notifications),
      ).toEqual([]);
    }
  });
});
