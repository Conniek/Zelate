/** H10 — appointments in the wait simulation (PRD §5.2, rules 6-8). */
import { describe, expect, it } from 'vitest';
import { callableTickets, computeSchedule, pickNextTicket } from './index.ts';
import {
  at,
  callTicket,
  makeMember,
  makeState,
  makeTicket,
  ok,
  presence,
  ticketOf,
} from './testing/fixtures.ts';
import type { TicketState } from './types.ts';

function appointment(
  id: string,
  memberId: string,
  time: string,
  overrides: Partial<TicketState> = {},
): TicketState {
  return makeTicket(id, {
    kind: 'appointment',
    scheduled_at: at(time),
    appointment_source: 'salon_entry',
    assigned_member_id: memberId,
    ...overrides,
  });
}

describe('H10 — appointments', () => {
  it('rule 6: an appointment keeps its stylist and never starts before its time', () => {
    const state = makeState({
      members: [makeMember('ines'), makeMember('karim')],
      tickets: [appointment('rv', 'karim', '14:00')],
    });
    const estimate = computeSchedule(state, at('13:00')).tickets.rv;
    expect(estimate?.estimated_member_id).toBe('karim');
    expect(estimate?.estimated_start_at).toBe(at('14:00'));
    expect(estimate?.wait_minutes).toBe(60);
  });

  it('rule 6: a walk-in goes before the appointment only if his service ends before it', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [
        appointment('rv', 'ines', '14:00'),
        makeTicket('a', { service_id: 'cut' }),
      ],
    });
    const fitting = computeSchedule(state, at('13:30')).tickets;
    expect(fitting.a?.estimated_start_at).toBe(at('13:30'));
    expect(fitting.rv?.estimated_start_at).toBe(at('14:00'));
    const tooLate = computeSchedule(state, at('13:45')).tickets;
    expect(tooLate.rv?.estimated_start_at).toBe(at('14:00'));
    expect(tooLate.a?.estimated_start_at).toBe(at('14:30'));
  });

  it('rule 6: a walk-in never delays an appointment (margin 0)', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [appointment('rv', 'ines', '14:00'), makeTicket('a')],
    });
    const rv = computeSchedule(state, at('13:31')).tickets.rv;
    expect(rv?.estimated_start_at).toBe(at('14:00'));
  });

  it('rule 8: an early client on site is taken before his time if the stylist is free', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [
        appointment('rv', 'ines', '14:00', {
          appointment_source: 'client_check_in',
        }),
      ],
    });
    const rv = computeSchedule(state, at('13:40')).tickets.rv;
    expect(rv?.estimated_start_at).toBe(at('13:40'));
  });

  it('rule 8: a salon-entered appointment not on site is not brought forward', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [appointment('rv', 'ines', '14:00')],
    });
    expect(
      computeSchedule(state, at('13:40')).tickets.rv?.estimated_start_at,
    ).toBe(at('14:00'));
  });

  it('rule 7: a late appointment keeps priority over the walk-ins', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [appointment('rv', 'ines', '14:00'), makeTicket('a')],
    });
    const tickets = computeSchedule(state, at('14:05')).tickets;
    expect(tickets.rv?.estimated_start_at).toBe(at('14:05'));
    expect(tickets.a?.estimated_start_at).toBe(at('14:35'));
  });

  it('rule 7: beyond 10 minutes, a late appointment yields to the next one it would overrun', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [
        appointment('late', 'ines', '14:00'),
        appointment('next', 'ines', '14:30'),
      ],
    });
    const tickets = computeSchedule(state, at('14:15')).tickets;
    expect(tickets.next?.estimated_start_at).toBe(at('14:30'));
    expect(tickets.late?.estimated_start_at).toBe(at('15:00'));
    const withinGrace = computeSchedule(state, at('14:10')).tickets;
    expect(withinGrace.late?.estimated_start_at).toBe(at('14:10'));
    expect(withinGrace.next?.estimated_start_at).toBe(at('14:40'));
  });

  it('a stylist who is out of the day gives no estimate to his appointment', () => {
    const state = makeState({
      members: [makeMember('ines', { status: 'deactivated' })],
      tickets: [appointment('rv', 'ines', '14:00')],
    });
    expect(
      computeSchedule(state, at('13:00')).tickets.rv?.estimated_start_at,
    ).toBeNull();
  });

  it('pending_confirmation never enters the estimate (invariant 8)', () => {
    const state = makeState({
      members: [makeMember('ines')],
      tickets: [
        makeTicket('pc', {
          kind: 'appointment',
          scheduled_at: at('14:00'),
          appointment_source: 'client_check_in',
          status: 'pending_confirmation',
        }),
        makeTicket('a'),
      ],
    });
    const schedule = computeSchedule(state, at('13:00'));
    expect(schedule.tickets.pc).toBeUndefined();
    expect(schedule.tickets.a?.estimated_start_at).toBe(at('13:00'));
  });
});

describe('H10 — call order with appointments', () => {
  const ines = () => makeMember('ines');

  it('rule 6: a walk-in is called only if he ends before the next appointment', () => {
    const state = makeState({
      members: [ines()],
      tickets: [appointment('rv', 'ines', '14:00'), makeTicket('a')],
    });
    expect(pickNextTicket(state, 'ines', at('13:30'))?.id).toBe('a');
    expect(pickNextTicket(state, 'ines', at('13:45'))).toBeNull();
  });

  it('rule 7: a due appointment is called before the walk-ins', () => {
    const state = makeState({
      members: [ines()],
      tickets: [makeTicket('a'), appointment('rv', 'ines', '14:00')],
    });
    expect(pickNextTicket(state, 'ines', at('14:05'))?.id).toBe('rv');
    expect(
      callableTickets(state, 'ines', at('14:05')).map((t) => t.id),
    ).toEqual(['rv', 'a']);
  });

  it('rule 7: after 10 minutes, the next appointment is called first if the late one would overrun it', () => {
    const state = makeState({
      members: [ines()],
      tickets: [
        appointment('late', 'ines', '14:00'),
        appointment('next', 'ines', '14:30'),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('14:10'))?.id).toBe('late');
    expect(pickNextTicket(state, 'ines', at('14:15'))?.id).toBe('next');
  });

  it('rule 8: an early client on site is called when no walk-in fits before him', () => {
    const early = appointment('rv', 'ines', '14:00', {
      appointment_source: 'client_check_in',
    });
    const state = makeState({ members: [ines()], tickets: [early] });
    expect(pickNextTicket(state, 'ines', at('13:40'))?.id).toBe('rv');
    const walkInFirst = makeState({
      members: [ines()],
      tickets: [early, makeTicket('a')],
    });
    expect(pickNextTicket(walkInFirst, 'ines', at('13:20'))?.id).toBe('a');
    expect(pickNextTicket(walkInFirst, 'ines', at('13:45'))?.id).toBe('rv');
  });

  it('rule 8: an early client not on site is not called before his time', () => {
    const state = makeState({
      members: [ines()],
      tickets: [appointment('rv', 'ines', '14:00')],
    });
    expect(pickNextTicket(state, 'ines', at('13:40'))).toBeNull();
  });

  it('an appointment of another stylist is never called', () => {
    const state = makeState({
      members: [ines(), makeMember('karim')],
      tickets: [appointment('rv', 'ines', '14:00')],
    });
    expect(pickNextTicket(state, 'karim', at('14:05'))).toBeNull();
  });

  it('call_ticket calls the due appointment', () => {
    const state = makeState({
      members: [ines()],
      tickets: [makeTicket('a'), appointment('rv', 'ines', '14:00')],
    });
    const out = ok(state, callTicket('ines'), at('14:02'));
    expect(ticketOf(out.state, 'rv').status).toBe('called');
    expect(ticketOf(out.state, 'a').status).toBe('waiting');
  });

  it('a stylist leaving early does not take an appointment that overruns his end of day', () => {
    const state = makeState({
      members: [
        makeMember('ines', {
          presence: presence('off_duty', { shift_end_at: at('14:00') }),
        }),
      ],
      tickets: [
        appointment('rv', 'ines', '14:00', {
          appointment_source: 'client_check_in',
        }),
      ],
    });
    expect(pickNextTicket(state, 'ines', at('13:40'))).toBeNull();
  });
});
