/** E9, E27 — reassignment never moves a client back without his consent. */
import { describe, expect, it } from 'vitest';
import { applyCommand, detectTimeTriggers } from './index.ts';
import {
  at,
  client,
  fails,
  inServiceTicket,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  member,
  ok,
  presence,
  token,
  ticketOf,
} from './testing/fixtures.ts';
import type { Actor, Command, QueueState, TicketState } from './types.ts';

const reassign = (
  ticket_id: string,
  member_id: string,
  actor: Actor = member('gerant'),
): Command => ({
  command: 'reassign_ticket',
  actor,
  payload: { ticket_id, member_id },
});

const respond = (
  ticket_id: string,
  choice: 'accept' | 'refuse',
  actor: Actor = client('x'),
): Command => ({
  command: 'respond_reassignment',
  actor,
  payload: { ticket_id, choice },
});

const owned = (id: string, extra: Partial<TicketState> = {}): TicketState =>
  makeTicket(id, {
    client_id: 'client-x',
    notifications_consent_at: at('08:00'),
    ...extra,
  });

/** Karim is busy for a long time, Inès is free. */
const salon = (tickets: TicketState[]): QueueState =>
  makeState({
    members: [makeManager(), makeMember('ines'), makeMember('karim')],
    tickets: [
      inServiceTicket('busy', 'karim', at('09:50'), {
        planned_duration_minutes: 60,
      }),
      ...tickets,
    ],
  });

describe('reassign_ticket', () => {
  it('reassigns at once when the time does not move back', () => {
    const state = salon([owned('a', { requested_member_id: 'karim' })]);
    const out = ok(state, reassign('a', 'ines'), at('10:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      reassignment_member_id: null,
    });
    expect(out.events.map((e) => e.type)).toContain('reassigned');
    expect(out.notifications.map((n) => n.template)).not.toContain(
      'reassignment_request',
    );
  });

  it('asks the client when the time would move back, and changes nothing yet (E9)', () => {
    const state = salon([owned('a', { requested_member_id: 'ines' })]);
    const out = ok(state, reassign('a', 'karim'), at('10:00'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      reassignment_member_id: 'karim',
      reassignment_requested_at: at('10:00'),
      reassignment_proposed_start_at: at('10:50'),
    });
    expect(out.events.map((e) => e.type)).toEqual(['reassignment_requested']);
    expect(out.notifications).toMatchObject([
      {
        template: 'reassignment_request',
        requires_consent: false,
        params: { member_id: 'karim', proposed_start_at: at('10:50') },
      },
    ]);
  });

  it('refuses a second request while one is pending', () => {
    const state = salon([owned('a', { requested_member_id: 'ines' })]);
    const asked = ok(state, reassign('a', 'karim'), at('10:00')).state;
    expect(fails(asked, reassign('a', 'karim'), at('10:01'))).toBe(
      'reassignment_pending',
    );
  });

  it('reassigns a waiting appointment by its stylist field (K39)', () => {
    const appointment = owned('rv', {
      kind: 'appointment',
      scheduled_at: at('14:00'),
      appointment_source: 'salon_entry',
      assigned_member_id: 'karim',
    });
    const out = ok(salon([appointment]), reassign('rv', 'ines'), at('10:00'));
    expect(ticketOf(out.state, 'rv')).toMatchObject({
      assigned_member_id: 'ines',
      scheduled_at: at('14:00'),
    });
    expect(out.notifications).toEqual([]);
  });

  it('refuses an appointment slot already taken by the new stylist', () => {
    const rv = (id: string, member_id: string, time: string) =>
      owned(id, {
        kind: 'appointment',
        scheduled_at: at(time),
        assigned_member_id: member_id,
      });
    const state = salon([
      rv('rv', 'karim', '14:00'),
      rv('taken', 'ines', '14:10'),
    ]);
    expect(fails(state, reassign('rv', 'ines'), at('10:00'))).toBe(
      'appointment_overlap',
    );
  });

  it('validates actor, ticket and stylist', () => {
    const state = makeState({
      members: [
        makeManager(),
        makeMember('ines', { specialties: ['men_cut'] }),
        makeMember('karim', { presence: presence('absent') }),
      ],
      tickets: [owned('a'), owned('done', { status: 'completed' })],
    });
    expect(
      fails(state, reassign('a', 'ines', member('ines')), at('10:00')),
    ).toBe('forbidden');
    expect(fails(state, reassign('nope', 'ines'), at('10:00'))).toBe(
      'ticket_other_salon',
    );
    expect(fails(state, reassign('done', 'ines'), at('10:00'))).toBe(
      'invalid_transition',
    );
    expect(fails(state, reassign('a', 'karim'), at('10:00'))).toBe(
      'stylist_unavailable',
    );
    expect(fails(state, reassign('a', 'ines'), at('10:00'))).toBe(
      'stylist_unavailable',
    );
    expect(fails(state, reassign('a', 'gerant'), at('10:00'))).toBe(
      'stylist_unavailable',
    );
  });
});

describe('respond_reassignment', () => {
  const asked = () =>
    ok(
      salon([owned('a', { requested_member_id: 'ines' })]),
      reassign('a', 'karim'),
      at('10:00'),
    ).state;

  it('accept applies the reassignment', () => {
    const out = ok(asked(), respond('a', 'accept'), at('10:02'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'karim',
      reassignment_member_id: null,
      reassignment_requested_at: null,
    });
    expect(
      out.events
        .filter((e) => e.type !== 'estimate_changed')
        .map((e) => [e.type, e.reason_code]),
    ).toEqual([
      ['reassigned', 'karim'],
      ['reassignment_resolved', 'accepted'],
    ]);
  });

  it('the ticket token may answer too', () => {
    ok(asked(), respond('a', 'accept', token('a')), at('10:02'));
  });

  it('refuse changes nothing and is logged', () => {
    const out = ok(asked(), respond('a', 'refuse'), at('10:02'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      reassignment_member_id: null,
    });
    expect(out.events).toMatchObject([
      { type: 'reassignment_resolved', reason_code: 'refused' },
    ]);
  });

  it('asks again when the time now moves back 10 min more than proposed (E27)', () => {
    const slower = {
      ...asked(),
    };
    const state = {
      ...slower,
      tickets: slower.tickets.map((t) =>
        t.id === 'busy' ? { ...t, planned_duration_minutes: 90 } : t,
      ),
    };
    const out = ok(state, respond('a', 'accept'), at('10:02'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      reassignment_member_id: 'karim',
      reassignment_requested_at: at('10:02'),
    });
    expect(out.notifications.map((n) => n.template)).toContain(
      'reassignment_request',
    );
  });

  it('refuses without a pending request, for another client, or for an unavailable stylist', () => {
    const plain = salon([owned('a')]);
    expect(fails(plain, respond('a', 'accept'), at('10:02'))).toBe(
      'already_resolved',
    );
    expect(
      fails(asked(), respond('a', 'accept', client('y')), at('10:02')),
    ).toBe('forbidden');
    expect(fails(asked(), respond('nope', 'accept'), at('10:02'))).toBe(
      'invalid_payload',
    );
    const gone = {
      ...asked(),
      members: asked().members.map((m) =>
        m.id === 'karim' ? { ...m, presence: presence('absent') } : m,
      ),
    };
    expect(fails(gone, respond('a', 'accept'), at('10:02'))).toBe(
      'stylist_unavailable',
    );
    expect(applyCommand(gone, respond('a', 'refuse'), at('10:02')).ok).toBe(
      true,
    );
  });

  it('lapses after 10 min without answer: nothing changes, « expired » is logged', () => {
    const early = detectTimeTriggers(asked(), at('10:09'));
    expect(ticketOf(early.state, 'a').reassignment_member_id).toBe('karim');
    const out = detectTimeTriggers(asked(), at('10:10'));
    expect(ticketOf(out.state, 'a')).toMatchObject({
      requested_member_id: 'ines',
      reassignment_member_id: null,
    });
    expect(
      out.events.filter((e) => e.type === 'reassignment_resolved'),
    ).toMatchObject([{ reason_code: 'expired' }]);
  });
});
