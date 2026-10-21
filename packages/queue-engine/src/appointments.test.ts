/** H10 — appointment commands (TRD §6.2, transitions 1 and 1b). */
import { describe, expect, it } from 'vitest';
import {
  at,
  client,
  fails,
  makeManager,
  makeMember,
  makeSalon,
  makeState,
  makeTicket,
  member,
  ok,
  presence,
  ticketOf,
} from './testing/fixtures.ts';
import type { Actor, Command, TicketState } from './types.ts';

type Payload<N extends Command['command']> = Extract<
  Command,
  { command: N }
>['payload'];

const create = (
  payload: Partial<Payload<'create_appointment'>> = {},
  actor: Actor = member('gerant'),
): Command => ({
  command: 'create_appointment',
  actor,
  payload: {
    ticket_id: 'rv',
    short_code: 'RV2K9',
    scheduled_at: at('14:00'),
    member_id: 'ines',
    service_id: 'cut',
    phone_has_active_ticket: false,
    ...payload,
  },
});

const update = (
  ticket_id: string,
  payload: Partial<Payload<'update_appointment'>> = {},
  actor: Actor = member('gerant'),
): Command => ({
  command: 'update_appointment',
  actor,
  payload: { ticket_id, ...payload },
});

const cancelRv = (
  ticket_id: string,
  reason_code = 'emergency',
  actor: Actor = member('gerant'),
): Command => ({
  command: 'cancel_appointment',
  actor,
  payload: { ticket_id, reason_code },
});

const checkIn = (
  payload: Partial<Payload<'check_in_appointment'>> = {},
  actor: Actor = client('c1'),
): Command => ({
  command: 'check_in_appointment',
  actor,
  payload: {
    ticket_id: 'pc',
    short_code: 'PC2K9',
    scheduled_at: at('14:00'),
    member_id: 'ines',
    service_id: 'cut',
    notifications_consent: true,
    has_active_ticket_elsewhere: false,
    ...payload,
  },
});

const confirm = (
  ticket_id: string,
  payload: Partial<Payload<'confirm_appointment'>> = {},
  actor: Actor = member('gerant'),
): Command => ({
  command: 'confirm_appointment',
  actor,
  payload: { ticket_id, decision: 'confirm', ...payload },
});

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

const pending = (
  id: string,
  time: string,
  overrides: Partial<TicketState> = {},
): TicketState =>
  makeTicket(id, {
    kind: 'appointment',
    scheduled_at: at(time),
    appointment_source: 'client_check_in',
    status: 'pending_confirmation',
    channel: 'qr',
    requested_member_id: 'ines',
    ...overrides,
  });

const base = () =>
  makeState({
    members: [makeManager(), makeMember('ines'), makeMember('karim')],
  });

describe('H10 — create_appointment', () => {
  it('creates a waiting appointment fixed on its stylist (rule 6, K39)', () => {
    const out = ok(base(), create(), at('10:00'));
    const ticket = ticketOf(out.state, 'rv');
    expect(ticket).toMatchObject({
      kind: 'appointment',
      status: 'waiting',
      scheduled_at: at('14:00'),
      appointment_source: 'salon_entry',
      assigned_member_id: 'ines',
      channel: 'front_desk',
      estimated_start_at: at('14:00'),
      estimated_member_id: 'ines',
    });
    expect(out.events.map((e) => e.type)).toContain('created');
    expect(out.notifications.map((n) => n.template)).toEqual([
      'ticket_created',
    ]);
    expect(out.warnings).toBeUndefined();
  });

  it('a stylist may book for himself only', () => {
    expect(
      ok(base(), create({}, member('ines')), at('10:00')).state.tickets,
    ).toHaveLength(1);
    expect(fails(base(), create({}, member('karim')), at('10:00'))).toBe(
      'forbidden',
    );
    expect(fails(base(), create({}, client('c1')), at('10:00'))).toBe(
      'forbidden',
    );
  });

  it('accepts a stylist on break and warns when he is absent (E26)', () => {
    const state = makeState({
      members: [
        makeManager(),
        makeMember('ines', { presence: presence('on_break') }),
        makeMember('karim', { presence: presence('absent') }),
      ],
    });
    expect(ok(state, create(), at('10:00')).warnings).toBeUndefined();
    expect(
      ok(state, create({ member_id: 'karim' }), at('10:00')).warnings,
    ).toEqual(['stylist_absent']);
  });

  it('refuses a past, out-of-hours or other-day slot', () => {
    expect(
      fails(base(), create({ scheduled_at: at('09:44') }), at('10:00')),
    ).toBe('appointment_in_past');
    expect(
      ok(base(), create({ scheduled_at: at('09:45') }), at('10:00')).state
        .tickets,
    ).toHaveLength(1);
    expect(
      fails(base(), create({ scheduled_at: at('08:00') }), at('07:00')),
    ).toBe('outside_opening_hours');
    expect(
      fails(base(), create({ scheduled_at: at('18:45') }), at('10:00')),
    ).toBe('outside_opening_hours');
    expect(
      fails(
        base(),
        create({ scheduled_at: at('23:30') + 86_400_000 }),
        at('10:00'),
      ),
    ).toBe('appointment_not_today');
    expect(
      fails(base(), create({ scheduled_at: Number.NaN }), at('10:00')),
    ).toBe('invalid_payload');
  });

  it('measures overlap on the service duration; back to back is accepted', () => {
    const state = makeState({
      members: [makeManager(), makeMember('ines'), makeMember('karim')],
      tickets: [rv('r1', '14:00')],
    });
    expect(
      fails(state, create({ scheduled_at: at('14:20') }), at('10:00')),
    ).toBe('appointment_overlap');
    expect(
      fails(state, create({ scheduled_at: at('13:40') }), at('10:00')),
    ).toBe('appointment_overlap');
    ok(state, create({ scheduled_at: at('14:30') }), at('10:00'));
    ok(state, create({ scheduled_at: at('13:30') }), at('10:00'));
    ok(
      state,
      create({ scheduled_at: at('14:00'), member_id: 'karim' }),
      at('10:00'),
    );
    expect(
      fails(
        state,
        create({ scheduled_at: at('14:10'), service_id: null }),
        at('10:00'),
      ),
    ).toBe('appointment_overlap');
  });

  it('refuses an unknown stylist, a service he does not master and an inactive service', () => {
    const state = makeState({
      members: [
        makeManager(),
        makeMember('ines', { specialties: ['men_cut'] }),
      ],
    });
    expect(fails(state, create({ member_id: 'gerant' }), at('10:00'))).toBe(
      'stylist_unavailable',
    );
    expect(
      fails(
        state,
        create({ member_id: 'nobody' }, member('gerant')),
        at('10:00'),
      ),
    ).toBe('stylist_unavailable');
    expect(fails(state, create({ service_id: 'cut' }), at('10:00'))).toBe(
      'service_unavailable',
    );
    expect(fails(state, create({ service_id: 'retired' }), at('10:00'))).toBe(
      'service_unavailable',
    );
  });

  it('refuses a reused ticket id and a phone that already has an active ticket', () => {
    const state = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [rv('rv', '16:00')],
    });
    expect(fails(state, create(), at('10:00'))).toBe('invalid_payload');
    expect(
      fails(base(), create({ phone_has_active_ticket: true }), at('10:00')),
    ).toBe('already_has_active_ticket');
  });

  it('works while the queue is closed (the salon books ahead)', () => {
    const state = makeState({
      salon: makeSalon({ queue_status: 'closed' }),
      members: [makeManager(), makeMember('ines')],
    });
    ok(state, create(), at('08:30'));
  });
});

describe('H10 — update_appointment', () => {
  const state = () =>
    makeState({
      members: [
        makeManager(),
        makeMember('ines'),
        makeMember('karim', { specialties: ['women_cut', 'color'] }),
      ],
      tickets: [
        rv('rv', '14:00', {
          client_id: 'client-rv',
          notifications_consent_at: at('08:00'),
          last_notified_start_at: at('14:00'),
        }),
        rv('other', '16:00'),
      ],
    });

  it('moves an appointment and tells the client when the time changes by 10 min or more', () => {
    const out = ok(
      state(),
      update('rv', { scheduled_at: at('14:30') }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'rv')).toMatchObject({
      scheduled_at: at('14:30'),
      estimated_start_at: at('14:30'),
    });
    expect(out.events.map((e) => e.type)).toContain('appointment_updated');
    expect(out.notifications).toMatchObject([
      {
        template: 'estimate_changed',
        requires_consent: false,
        params: { reason: 'your_appointment_changed' },
      },
    ]);
  });

  it('stays silent for a move of less than 10 min', () => {
    const out = ok(
      state(),
      update('rv', { scheduled_at: at('14:05') }),
      at('10:00'),
    );
    expect(out.notifications).toEqual([]);
  });

  it('changes stylist and service, with the duration of the new service', () => {
    const out = ok(
      state(),
      update('rv', { member_id: 'karim', service_id: 'color' }),
      at('10:00'),
    );
    expect(ticketOf(out.state, 'rv')).toMatchObject({
      assigned_member_id: 'karim',
      service_id: 'color',
      planned_duration_minutes: 60,
    });
  });

  it('does nothing when nothing changes', () => {
    const initial = state();
    const out = ok(
      initial,
      update('rv', { scheduled_at: at('14:00') }),
      at('10:00'),
    );
    expect(out.state).toEqual(initial);
    expect(out.events).toEqual([]);
  });

  it('is limited to the manager and the stylist concerned', () => {
    ok(
      state(),
      update('rv', { scheduled_at: at('15:00') }, member('ines')),
      at('10:00'),
    );
    expect(fails(state(), update('rv', {}, member('karim')), at('10:00'))).toBe(
      'forbidden',
    );
    expect(
      fails(
        state(),
        update('rv', { member_id: 'karim' }, member('ines')),
        at('10:00'),
      ),
    ).toBe('forbidden');
  });

  it('refuses an overlap, a past time, another day and unknown or non-editable tickets', () => {
    expect(
      fails(state(), update('rv', { scheduled_at: at('15:50') }), at('10:00')),
    ).toBe('appointment_overlap');
    expect(
      fails(state(), update('rv', { scheduled_at: at('09:00') }), at('10:00')),
    ).toBe('appointment_in_past');
    expect(fails(state(), update('nope'), at('10:00'))).toBe(
      'ticket_other_salon',
    );
    const walkIn = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [makeTicket('a'), rv('called', '11:00', { status: 'called' })],
    });
    expect(fails(walkIn, update('a', {}, member('gerant')), at('10:00'))).toBe(
      'appointment_not_editable',
    );
    expect(
      fails(
        walkIn,
        update('called', { scheduled_at: at('11:30') }),
        at('10:00'),
      ),
    ).toBe('appointment_not_editable');
  });
});

describe('H10 — cancel_appointment', () => {
  it('cancels with a reason and tells the client (E29)', () => {
    const state = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [rv('rv', '14:00')],
    });
    const out = ok(state, cancelRv('rv', 'emergency'), at('10:00'));
    expect(ticketOf(out.state, 'rv')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'removed_by_salon',
      removal_reason: 'emergency',
    });
    expect(out.notifications).toMatchObject([
      { template: 'cancelled_by_salon', params: { reason: 'emergency' } },
    ]);
    ok(state, cancelRv('rv', 'other', member('ines')), at('10:00'));
  });

  it('requires a valid reason, a concerned actor and an editable appointment', () => {
    const state = makeState({
      members: [makeManager(), makeMember('ines'), makeMember('karim')],
      tickets: [rv('rv', '14:00'), rv('c', '11:00', { status: 'called' })],
    });
    expect(fails(state, cancelRv('rv', 'bogus'), at('10:00'))).toBe(
      'invalid_payload',
    );
    expect(
      fails(state, cancelRv('rv', 'emergency', member('karim')), at('10:00')),
    ).toBe('forbidden');
    expect(fails(state, cancelRv('c'), at('10:00'))).toBe(
      'appointment_not_editable',
    );
    expect(fails(state, cancelRv('nope'), at('10:00'))).toBe(
      'ticket_other_salon',
    );
  });
});

describe('H10 — check_in_appointment (transition 1b)', () => {
  it('creates a pending ticket, outside every estimate (invariant 8)', () => {
    const state = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [makeTicket('a')],
    });
    const out = ok(state, checkIn(), at('13:50'));
    expect(ticketOf(out.state, 'pc')).toMatchObject({
      kind: 'appointment',
      status: 'pending_confirmation',
      appointment_source: 'client_check_in',
      channel: 'qr',
      client_id: 'client-c1',
      requested_member_id: 'ines',
      assigned_member_id: null,
      estimated_start_at: null,
      notifications_consent_at: at('13:50'),
    });
    expect(ticketOf(out.state, 'a').estimated_start_at).toBe(at('13:50'));
    expect(out.events.map((e) => e.type)).toEqual(['appointment_checked_in']);
    expect(out.notifications).toEqual([]);
  });

  it('keeps no consent when not given, and accepts « je ne sais plus »', () => {
    const out = ok(
      base(),
      checkIn({ member_id: null, notifications_consent: false }),
      at('13:50'),
    );
    expect(ticketOf(out.state, 'pc')).toMatchObject({
      requested_member_id: null,
      notifications_consent_at: null,
    });
  });

  it('refuses a closed or paused queue, a second ticket and a non-client', () => {
    for (const [queue_status, code] of [
      ['closed', 'queue_closed'],
      ['paused', 'queue_paused'],
    ] as const) {
      const state = makeState({
        salon: makeSalon({ queue_status }),
        members: [makeManager(), makeMember('ines')],
      });
      expect(fails(state, checkIn(), at('13:50'))).toBe(code);
    }
    const busy = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [makeTicket('c1', { client_id: 'client-c1' })],
    });
    expect(fails(busy, checkIn(), at('13:50'))).toBe(
      'already_has_active_ticket',
    );
    expect(
      fails(
        base(),
        checkIn({ has_active_ticket_elsewhere: true }),
        at('13:50'),
      ),
    ).toBe('already_has_active_ticket');
    expect(fails(base(), checkIn({}, member('gerant')), at('13:50'))).toBe(
      'forbidden',
    );
  });

  it('validates the time, the service and the stylist', () => {
    expect(
      fails(base(), checkIn({ scheduled_at: at('20:00') }), at('13:50')),
    ).toBe('outside_opening_hours');
    expect(
      fails(base(), checkIn({ scheduled_at: Number.NaN }), at('13:50')),
    ).toBe('invalid_payload');
    expect(fails(base(), checkIn({ service_id: 'retired' }), at('13:50'))).toBe(
      'service_unavailable',
    );
    expect(fails(base(), checkIn({ member_id: 'gerant' }), at('13:50'))).toBe(
      'stylist_unavailable',
    );
    const reused = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [makeTicket('pc')],
    });
    expect(fails(reused, checkIn(), at('13:50'))).toBe('invalid_payload');
  });
});

describe('H10 — confirm_appointment', () => {
  const state = (extra: TicketState[] = []) =>
    makeState({
      members: [makeManager(), makeMember('ines'), makeMember('karim')],
      tickets: [pending('pc', '14:00'), ...extra],
    });

  it('confirms: pending_confirmation → waiting, assigned and estimated (transition 1b)', () => {
    const out = ok(state(), confirm('pc'), at('13:50'));
    expect(ticketOf(out.state, 'pc')).toMatchObject({
      status: 'waiting',
      assigned_member_id: 'ines',
      confirmed_at: at('13:50'),
      confirmed_by_member_id: 'gerant',
      estimated_start_at: at('13:50'),
    });
    expect(out.events.map((e) => e.type)).toEqual(['appointment_confirmed']);
    expect(out.notifications).toMatchObject([
      {
        template: 'appointment_confirmed',
        params: { scheduled_at: at('14:00') },
      },
    ]);
  });

  it('the stylist concerned may confirm; « je ne sais plus » needs a stylist (member_required)', () => {
    ok(state(), confirm('pc', {}, member('ines')), at('13:50'));
    expect(
      fails(state(), confirm('pc', {}, member('karim')), at('13:50')),
    ).toBe('forbidden');
    const unknown = makeState({
      members: [makeManager(), makeMember('ines'), makeMember('karim')],
      tickets: [pending('pc', '14:00', { requested_member_id: null })],
    });
    expect(fails(unknown, confirm('pc'), at('13:50'))).toBe('member_required');
    const out = ok(unknown, confirm('pc', { member_id: 'karim' }), at('13:50'));
    expect(ticketOf(out.state, 'pc').assigned_member_id).toBe('karim');
    ok(
      unknown,
      confirm('pc', { member_id: 'karim' }, member('karim')),
      at('13:50'),
    );
    expect(
      fails(
        unknown,
        confirm('pc', { member_id: 'ines' }, member('karim')),
        at('13:50'),
      ),
    ).toBe('forbidden');
  });

  it('refuses an overlap with the stylist agenda, a resolved ticket and a walk-in', () => {
    expect(fails(state([rv('r1', '14:10')]), confirm('pc'), at('13:50'))).toBe(
      'appointment_overlap',
    );
    const resolved = ok(state(), confirm('pc'), at('13:50')).state;
    expect(fails(resolved, confirm('pc'), at('13:51'))).toBe(
      'already_resolved',
    );
    expect(fails(state([makeTicket('a')]), confirm('a'), at('13:50'))).toBe(
      'invalid_payload',
    );
    expect(fails(state(), confirm('nope'), at('13:50'))).toBe(
      'ticket_other_salon',
    );
    expect(fails(state(), confirm('pc', {}, client('c1')), at('13:50'))).toBe(
      'forbidden',
    );
  });

  it('rejects with a reason and tells the client (E29)', () => {
    const out = ok(
      state(),
      confirm('pc', { decision: 'reject', reason_code: 'other' }),
      at('13:50'),
    );
    expect(ticketOf(out.state, 'pc')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'appointment_rejected',
      removal_reason: 'other',
    });
    expect(out.events).toMatchObject([
      { type: 'appointment_rejected', reason_code: 'other' },
    ]);
    expect(out.notifications).toMatchObject([
      { template: 'appointment_rejected', params: { reason: 'other' } },
    ]);
    expect(
      fails(state(), confirm('pc', { decision: 'reject' }), at('13:50')),
    ).toBe('invalid_payload');
    ok(
      state(),
      confirm(
        'pc',
        { decision: 'reject', reason_code: 'other' },
        member('ines'),
      ),
      at('13:50'),
    );
  });

  it('merges into the salon appointment: it survives and takes the client (K14)', () => {
    const entered = rv('rv', '14:00', {
      client_id: null,
      notifications_consent_at: null,
    });
    const out = ok(
      state([entered]),
      confirm('pc', { merge_into_ticket_id: 'rv' }),
      at('13:50'),
    );
    expect(ticketOf(out.state, 'rv')).toMatchObject({
      status: 'waiting',
      client_id: 'client-pc',
      notifications_consent_at: at('08:00'),
      confirmed_at: at('13:50'),
    });
    expect(ticketOf(out.state, 'pc')).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'merged',
    });
    expect(out.events.map((e) => e.type)).toEqual([
      'appointment_merged',
      'appointment_confirmed',
    ]);
    expect(out.notifications.map((n) => n.template)).toEqual([
      'appointment_confirmed',
    ]);
  });

  it('refuses a merge into a called, other-stylist, same or non-salon appointment', () => {
    const bad = (target: TicketState) =>
      fails(
        state([target]),
        confirm('pc', { merge_into_ticket_id: target.id }),
        at('13:50'),
      );
    expect(bad(rv('rv', '14:00', { status: 'called' }))).toBe(
      'invalid_merge_target',
    );
    expect(bad(rv('rv', '14:00', { assigned_member_id: 'karim' }))).toBe(
      'invalid_merge_target',
    );
    expect(bad(makeTicket('rv'))).toBe('invalid_merge_target');
    expect(
      fails(
        state(),
        confirm('pc', { merge_into_ticket_id: 'pc' }),
        at('13:50'),
      ),
    ).toBe('invalid_merge_target');
    expect(
      fails(
        state(),
        confirm('pc', { merge_into_ticket_id: 'zzz' }),
        at('13:50'),
      ),
    ).toBe('ticket_other_salon');
  });

  it('a confirmed client is on site: he is taken early when the stylist is free (rule 8)', () => {
    const out = ok(state(), confirm('pc'), at('13:30'));
    expect(ticketOf(out.state, 'pc').estimated_start_at).toBe(at('13:30'));
  });
});

describe('H10 — appointments in the estimate reasons', () => {
  it('a walk-in is told when a new appointment pushes him back', () => {
    const state = makeState({
      members: [
        makeManager(),
        makeMember('ines', { specialties: ['women_cut', 'color'] }),
      ],
      tickets: [makeTicket('a', { last_notified_start_at: at('14:00') })],
    });
    const out = ok(
      state,
      create({ scheduled_at: at('14:00'), service_id: 'color' }),
      at('13:45'),
    );
    expect(out.notifications.find((n) => n.ticket_id === 'a')).toMatchObject({
      template: 'estimate_changed',
      params: { reason: 'appointment_ahead' },
    });
  });

  it('a walk-in is told when an appointment ahead of him moves', () => {
    const state = makeState({
      members: [makeManager(), makeMember('ines')],
      tickets: [
        rv('r1', '14:00', {
          last_notified_start_at: at('14:00'),
          estimated_start_at: at('14:00'),
        }),
        makeTicket('a', {
          last_notified_start_at: at('14:30'),
          estimated_start_at: at('14:30'),
        }),
      ],
    });
    const out = ok(
      state,
      update('r1', { scheduled_at: at('14:40') }),
      at('13:45'),
    );
    expect(out.notifications.find((n) => n.ticket_id === 'a')).toMatchObject({
      params: { reason: 'appointment_changed' },
    });
  });
});
