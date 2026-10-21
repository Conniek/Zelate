import { beforeEach, describe, expect, it } from 'vitest';
import errors from '../../i18n/src/fr/errors.json' with { type: 'json' };
import { code, data, harness, type Harness } from './harness.ts';
import {
  APPOINTMENTS_PER_HOUR,
  errorResponse,
  type ServiceErrorCode,
} from './service.ts';
import {
  ANNA,
  ANNA_PROFILE,
  BEN,
  BEN_PROFILE,
  CLIENT,
  CLIENT_2,
  CUT,
  DATE,
  MANAGER,
  MANAGER_PROFILE,
  OTHER_PROFILE,
  OTHER_SALON,
  QR,
  SALON,
} from './testing.ts';

let h: Harness;
beforeEach(() => {
  h = harness();
});

const join = (profile = CLIENT, extra: Record<string, unknown> = {}) =>
  h.send(profile, 'join_queue', {
    salon_id: SALON,
    service_id: CUT,
    channel: 'app',
    ...extra,
  });

const walkIn = (
  phone = '06 11 22 33 44',
  extra: Record<string, unknown> = {},
) =>
  h.send(MANAGER_PROFILE, 'register_walk_in', {
    first_name: 'Sam',
    phone,
    ...extra,
  });

/** 14:30 Paris on the test day. */
const AT_14H30 = '2026-10-19T14:30:00+02:00';

describe('concurrency and idempotence (ADR-003, ADR-004)', () => {
  it('two stylists calling at once: one gets the client, the other no_eligible_ticket', async () => {
    data(await join());
    const [a, b] = await Promise.all([
      h.send(ANNA_PROFILE, 'call_ticket'),
      h.send(BEN_PROFILE, 'call_ticket'),
    ]);
    const outcomes = [a, b].map((r) => (r.status === 200 ? 'ok' : code(r)));
    expect(outcomes.sort()).toEqual(['no_eligible_ticket', 'ok']);
    const called = [...h.db.tickets.values()].filter(
      (t) => t.columns.status === 'called',
    );
    expect(called).toHaveLength(1);
  });

  it('a double tap of the same stylist: one call, then call_already_in_progress', async () => {
    data(await join());
    data(await join(CLIENT_2, { first_name: 'Tom' }));
    const responses = await Promise.all([
      h.send(ANNA_PROFILE, 'call_ticket'),
      h.send(ANNA_PROFILE, 'call_ticket'),
    ]);
    expect(
      responses.map((r) => (r.status === 200 ? 'ok' : code(r))).sort(),
    ).toEqual(['call_already_in_progress', 'ok']);
  });

  it('replaying a command_id returns the same response without writing again', async () => {
    const commandId = crypto.randomUUID();
    const [first, second] = await Promise.all([
      h.send(
        CLIENT,
        'join_queue',
        { salon_id: SALON, channel: 'app' },
        { commandId },
      ),
      h.send(
        CLIENT,
        'join_queue',
        { salon_id: SALON, channel: 'app' },
        { commandId },
      ),
    ]);
    expect(second).toEqual(first);
    expect(h.db.tickets.size).toBe(1);
    const later = await h.send(
      CLIENT,
      'join_queue',
      { salon_id: SALON, channel: 'app' },
      { commandId },
    );
    expect(later).toEqual(first);
    expect(h.db.salons.get(SALON)!.queue_version).toBe(1);
  });

  it('a refused command is replayed as refused', async () => {
    const commandId = crypto.randomUUID();
    const first = await h.send(ANNA_PROFILE, 'call_ticket', {}, { commandId });
    expect(code(first)).toBe('no_eligible_ticket');
    data(await join());
    expect(
      await h.send(ANNA_PROFILE, 'call_ticket', {}, { commandId }),
    ).toEqual(first);
  });

  it('a database failure writes nothing and records no response', async () => {
    h.db.failNextApply = true;
    const commandId = crypto.randomUUID();
    await expect(
      h.send(
        CLIENT,
        'join_queue',
        { salon_id: SALON, channel: 'app' },
        { commandId },
      ),
    ).rejects.toThrow(/simulated/);
    expect(h.db.tickets.size).toBe(0);
    expect(h.db.processed.size).toBe(0);
    data(
      await h.send(
        CLIENT,
        'join_queue',
        { salon_id: SALON, channel: 'app' },
        { commandId },
      ),
    );
  });

  it('a malformed body is refused before any lock', async () => {
    const response = await h.send(CLIENT, 'join_queue', { salon_id: 'x' });
    expect(response.status).toBe(400);
    expect(code(response)).toBe('invalid_payload');
    expect(h.db.processed.size).toBe(0);
  });
});

describe('client or tracking token (ADR-006)', () => {
  it('a walk-in uses the link of his SMS; another link or ticket is refused', async () => {
    const { ticket_id } = data(await walkIn());
    const token = h.db.rawTicket(ticket_id as string).tracking_token as string;
    const other = data(await walkIn('06 99 88 77 66')).ticket_id;

    expect(
      code(
        await h.send(null, 'cancel_ticket', { ticket_id: other }, { token }),
      ),
    ).toBe('forbidden');
    expect(
      code(
        await h.send(
          null,
          'cancel_ticket',
          { ticket_id },
          { token: 'x'.repeat(43) },
        ),
      ),
    ).toBe('forbidden');
    data(await h.send(null, 'cancel_ticket', { ticket_id }, { token }));
    expect(h.db.ticket(ticket_id as string)).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'client_cancelled',
    });
    expect(h.db.contacts.get(ticket_id as string)?.is_active).toBe(false);
    expect(
      code(await h.send(null, 'cancel_ticket', { ticket_id }, { token })),
    ).toBe('already_resolved');
  });

  it('a client acts on his own ticket only', async () => {
    const { ticket_id } = data(await join());
    expect(code(await h.send(CLIENT_2, 'cancel_ticket', { ticket_id }))).toBe(
      'forbidden',
    );
    expect(code(await h.send(null, 'cancel_ticket', { ticket_id }))).toBe(
      'forbidden',
    );
    expect(
      code(
        await h.send(CLIENT, 'cancel_ticket', {
          ticket_id: '00000000-0000-4000-8000-0000000000ff',
        }),
      ),
    ).toBe('forbidden');
  });

  it('set_notifications_consent writes the ticket and, for a client, the profile (K34)', async () => {
    const { ticket_id } = data(await join());
    data(
      await h.send(CLIENT, 'set_notifications_consent', {
        ticket_id,
        consent: true,
      }),
    );
    expect(h.db.ticket(ticket_id as string).notifications_consent_at).toBe(
      h.now,
    );
    expect(h.db.profiles.get(CLIENT)?.tracking_consent_at).toBe(
      new Date(h.now).toISOString(),
    );
    // Same value again: nothing new for the queue.
    const version = h.db.salons.get(SALON)!.queue_version;
    data(
      await h.send(CLIENT, 'set_notifications_consent', {
        ticket_id,
        consent: true,
      }),
    );
    expect(h.db.salons.get(SALON)!.queue_version).toBe(version);

    const walk = data(await walkIn()).ticket_id as string;
    const token = h.db.rawTicket(walk).tracking_token as string;
    data(
      await h.send(
        null,
        'set_notifications_consent',
        { ticket_id: walk, consent: true },
        { token },
      ),
    );
    expect(h.db.ticket(walk).notifications_consent_at).toBe(h.now);
    data(
      await h.send(
        null,
        'set_notifications_consent',
        { ticket_id: walk, consent: false },
        { token },
      ),
    );
    expect(h.db.ticket(walk).notifications_consent_at).toBeNull();

    data(await h.send(CLIENT, 'cancel_ticket', { ticket_id }));
    expect(
      code(
        await h.send(CLIENT, 'set_notifications_consent', {
          ticket_id,
          consent: false,
        }),
      ),
    ).toBe('invalid_transition');
  });

  it('routes the other client answers to the engine', async () => {
    const { ticket_id } = data(await join());
    expect(
      code(
        await h.send(CLIENT, 'resolve_stylist_change', {
          ticket_id,
          choice: 'wait',
        }),
      ),
    ).toMatch(/already_resolved|invalid_transition/);
    expect(
      code(
        await h.send(CLIENT, 'respond_end_of_day', {
          ticket_id,
          choice: 'stay',
        }),
      ),
    ).toMatch(/already_resolved|invalid_transition/);
    expect(
      code(
        await h.send(CLIENT, 'respond_reassignment', {
          ticket_id,
          choice: 'accept',
        }),
      ),
    ).toMatch(/already_resolved|invalid_transition/);
    expect(
      code(
        await h.send(CLIENT, 'respond_eta', {
          ticket_id,
          response: 'late',
          delay_minutes: 45,
        }),
      ),
    ).toBe('invalid_delay');
    data(
      await h.send(CLIENT, 'respond_eta', { ticket_id, response: 'cancel' }),
    );
    expect(h.db.ticket(ticket_id as string).status).toBe('cancelled');
  });
});

describe('salon commands', () => {
  it('register_walk_in checks the number (ADR-011)', async () => {
    expect(code(await walkIn('01 23 45 67 89'))).toBe('invalid_phone');
    const { ticket_id } = data(await walkIn());
    expect(h.db.ticket(ticket_id as string)).toMatchObject({
      channel: 'front_desk',
      display_name: 'Sam',
      client_id: null,
    });
    expect(h.db.contacts.get(ticket_id as string)?.phone_e164).toBe(
      '+33611223344',
    );
    expect(code(await walkIn('+33611223344'))).toBe(
      'already_has_active_ticket',
    );
    expect(
      code(
        await h.send(ANNA_PROFILE, 'register_walk_in', {
          first_name: 'Sam',
          phone: '0612121212',
        }),
      ),
    ).toBe('forbidden');
  });

  it('remove_ticket keeps the note on the ticket, never in the log (K10)', async () => {
    const { ticket_id } = data(await join());
    data(
      await h.send(MANAGER_PROFILE, 'remove_ticket', {
        ticket_id,
        reason_code: 'other',
        note: 'Parti sans prévenir',
      }),
    );
    expect(h.db.rawTicket(ticket_id as string)).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'removed_by_salon',
      removal_reason: 'other',
      removal_note: 'Parti sans prévenir',
    });
    expect(JSON.stringify(h.db.events)).not.toContain('Parti');
    expect(
      h.db.notifications.some((n) => n.template === 'cancelled_by_salon'),
    ).toBe(true);
  });

  it('set_presence, set_hairdressing and reassign_ticket', async () => {
    const { ticket_id } = data(
      await join(CLIENT, { requested_member_id: ANNA }),
    );
    data(
      await h.send(ANNA_PROFILE, 'set_presence', {
        member_id: ANNA,
        status: 'on_break',
        break_type: 'short',
        until: '2026-10-19T10:15:00+02:00',
      }),
    );
    expect(h.db.presences.get(`${ANNA}:${DATE}`)).toMatchObject({
      status: 'on_break',
      break_type: 'short',
      expected_back_at: Date.UTC(2026, 9, 19, 8, 15),
      updated_by: ANNA,
    });
    expect(
      h.db.broadcasts.some(
        (b) => b.kind === 'salon' && b.event === 'presence_changed',
      ),
    ).toBe(true);

    data(
      await h.send(MANAGER_PROFILE, 'set_hairdressing', {
        is_hairdressing: false,
      }),
    );
    expect(h.db.members.find((m) => m.id === MANAGER)?.is_hairdressing).toBe(
      false,
    );

    const response = await h.send(MANAGER_PROFILE, 'reassign_ticket', {
      ticket_id,
      member_id: BEN,
    });
    data(response);
    const ticket = h.db.ticket(ticket_id as string);
    // Either applied at once (time not later) or asked to the client (E9).
    expect(
      ticket.requested_member_id === BEN ||
        ticket.reassignment_member_id === BEN,
    ).toBe(true);
  });

  it('set_queue_status is for a manager of that salon', async () => {
    data(
      await h.send(MANAGER_PROFILE, 'set_queue_status', {
        salon_id: SALON,
        status: 'paused',
      }),
    );
    expect(h.db.salons.get(SALON)!.queue_status).toBe('paused');
    expect(h.db.events.at(-1)).toMatchObject({
      scope: 'salon',
      type: 'queue_paused',
    });
    expect(
      h.db.broadcasts.some(
        (b) => b.kind === 'salon' && b.event === 'queue_status_changed',
      ),
    ).toBe(true);
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'set_queue_status', {
          salon_id: OTHER_SALON,
          status: 'open',
        }),
      ),
    ).toBe('forbidden');
    expect(
      code(
        await h.send(ANNA_PROFILE, 'set_queue_status', {
          salon_id: SALON,
          status: 'open',
        }),
      ),
    ).toBe('forbidden');
  });

  it('resolve_closing waits for the closing time', async () => {
    const { ticket_id } = data(await join());
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'resolve_closing', {
          ticket_ids: [ticket_id],
          decision: 'serve',
        }),
      ),
    ).toBe('closing_not_reached');
  });

  it('a member of several salons acts in the salon of the ticket', async () => {
    h.db.members.push({
      ...h.db.members.find((m) => m.id === ANNA)!,
      id: '20000000-0000-4000-8000-0000000000a2',
      salon_id: OTHER_SALON,
    });
    h.db.members.find((m) => m.id === ANNA)!.salon_id = SALON;
    // Anna's first membership is now the other salon's.
    h.db.members.sort((a) => (a.salon_id === OTHER_SALON ? -1 : 1));
    const { ticket_id } = data(await join());
    data(await h.send(MANAGER_PROFILE, 'call_ticket'));
    expect(h.db.ticket(ticket_id as string).assigned_member_id).toBe(MANAGER);
    data(
      await h.send(MANAGER_PROFILE, 'confirm_arrival', {
        short_code: h.db.ticket(ticket_id as string).short_code,
      }),
    );
    expect(code(await h.send(ANNA_PROFILE, 'take_next', { ticket_id }))).toBe(
      'not_assigned_to_you',
    );
  });
});

describe('appointments (H10)', () => {
  const create = (extra: Record<string, unknown> = {}) =>
    h.send(MANAGER_PROFILE, 'create_appointment', {
      first_name: 'Inès',
      scheduled_at: AT_14H30,
      member_id: ANNA,
      ...extra,
    });

  it('create, rename, move, change the phone, cancel', async () => {
    const { ticket_id } = data(await create({ phone: '0655443322' }));
    const id = ticket_id as string;
    expect(h.db.ticket(id)).toMatchObject({
      kind: 'appointment',
      appointment_source: 'salon_entry',
      assigned_member_id: ANNA,
      scheduled_at: Date.UTC(2026, 9, 19, 12, 30),
      display_name: 'Inès',
    });
    expect(h.db.contacts.get(id)?.phone_e164).toBe('+33655443322');

    const version = h.db.salons.get(SALON)!.queue_version;
    data(
      await h.send(MANAGER_PROFILE, 'update_appointment', {
        ticket_id,
        first_name: 'Inés',
      }),
    );
    expect(h.db.ticket(id).display_name).toBe('Inés');
    expect(h.db.salons.get(SALON)!.queue_version).toBe(version + 1);

    data(
      await h.send(MANAGER_PROFILE, 'update_appointment', {
        ticket_id,
        scheduled_at: '2026-10-19T15:00:00+02:00',
        phone: '0655443300',
      }),
    );
    expect(h.db.ticket(id).scheduled_at).toBe(Date.UTC(2026, 9, 19, 13, 0));
    expect(h.db.contacts.get(id)?.phone_e164).toBe('+33655443300');

    data(await walkIn('0611111111'));
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'update_appointment', {
          ticket_id,
          phone: '0611111111',
        }),
      ),
    ).toBe('already_has_active_ticket');
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'update_appointment', {
          ticket_id,
          phone: '01 23 45 67 89',
        }),
      ),
    ).toBe('invalid_phone');

    data(
      await h.send(MANAGER_PROFILE, 'cancel_appointment', {
        ticket_id,
        reason_code: 'emergency',
      }),
    );
    expect(h.db.ticket(id)).toMatchObject({
      status: 'cancelled',
      removal_reason: 'emergency',
    });
  });

  it('never answers about a phone number before the caller and ticket are checked (H6)', async () => {
    data(await walkIn('0611111111'));
    const benAppointment = data(await create({ member_id: BEN })).ticket_id;
    // Anna is neither manager nor the stylist of this appointment.
    expect(
      code(
        await h.send(ANNA_PROFILE, 'update_appointment', {
          ticket_id: benAppointment,
          phone: '0611111111',
        }),
      ),
    ).not.toBe('already_has_active_ticket');
    // A ticket that does not exist in the caller's salon.
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'update_appointment', {
          ticket_id: '00000000-0000-4000-8000-0000000000ee',
          phone: '0611111111',
        }),
      ),
    ).not.toBe('already_has_active_ticket');
    expect(
      code(
        await h.send(OTHER_PROFILE, 'confirm_appointment', {
          ticket_id: benAppointment,
          decision: 'confirm',
        }),
      ),
    ).not.toBe('already_has_active_ticket');
  });

  it('a stylist enters appointments for himself only', async () => {
    data(
      await h.send(ANNA_PROFILE, 'create_appointment', {
        first_name: 'Inès',
        scheduled_at: AT_14H30,
        member_id: ANNA,
      }),
    );
    expect(
      code(
        await h.send(ANNA_PROFILE, 'create_appointment', {
          first_name: 'Inès',
          scheduled_at: '2026-10-19T16:30:00+02:00',
          member_id: BEN,
        }),
      ),
    ).toBe('forbidden');
  });

  it(`stops at ${APPOINTMENTS_PER_HOUR} entries per hour (K15)`, async () => {
    for (let i = 0; i < APPOINTMENTS_PER_HOUR; i += 1) {
      h.db.tickets.set(`fake-${i}`, {
        salon_id: SALON,
        columns: {
          appointment_source: 'salon_entry',
          created_at: new Date(h.now - 30 * 60_000).toISOString(),
          service_date: '2026-10-18',
          status: 'cancelled',
        },
      });
    }
    const response = await create();
    expect(response.status).toBe(429);
    expect(code(response)).toBe('rate_limited');
  });

  it('check-in by QR, push to the salon, confirmation', async () => {
    const checkIn = (extra: Record<string, unknown> = {}) =>
      h.send(CLIENT, 'check_in_appointment', {
        salon_id: SALON,
        qr_token: QR,
        scheduled_time: '14:30',
        member_id: ANNA,
        ...extra,
      });
    expect(code(await checkIn({ qr_token: 'old-qr' }))).toBe(
      'invalid_qr_token',
    );

    const { ticket_id } = data(await checkIn());
    const id = ticket_id as string;
    expect(h.db.ticket(id)).toMatchObject({
      status: 'pending_confirmation',
      appointment_source: 'client_check_in',
      scheduled_at: Date.UTC(2026, 9, 19, 12, 30),
    });
    expect(h.db.contacts.get(id)?.is_pending_confirmation).toBe(true);
    const staff = h.db.notifications.filter(
      (n) => n.recipient_member_id !== null,
    );
    expect(staff.map((n) => n.dedupe_key).sort()).toEqual([
      `appointment_checked_in:${MANAGER}`,
      `appointment_checked_in:${ANNA}`,
    ]);
    expect(staff[0]).toMatchObject({
      channel: 'push',
      requires_consent: false,
      params: { scheduled_at: '2026-10-19T12:30:00.000Z' },
    });
    expect(
      h.db.broadcasts.some(
        (b) => b.kind === 'salon' && b.event === 'appointment_pending',
      ),
    ).toBe(true);

    data(
      await h.send(MANAGER_PROFILE, 'confirm_appointment', {
        ticket_id,
        decision: 'confirm',
      }),
    );
    expect(h.db.ticket(id).status).toBe('waiting');
    expect(h.db.contacts.get(id)?.is_pending_confirmation).toBe(false);
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'confirm_appointment', {
          ticket_id,
          decision: 'confirm',
        }),
      ),
    ).toBe('already_resolved');
  });

  it('merges a check-in into the appointment the salon entered (K14)', async () => {
    const entered = data(await create({ phone: '0612345678' }))
      .ticket_id as string;
    const signalled = data(
      await h.send(CLIENT, 'check_in_appointment', {
        salon_id: SALON,
        qr_token: QR,
        scheduled_time: '14:30',
        member_id: ANNA,
        notifications_consent: true,
      }),
    ).ticket_id as string;

    // Same stylist, same slot: the engine refuses first.
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'confirm_appointment', {
          ticket_id: signalled,
          decision: 'confirm',
        }),
      ),
    ).toBe('appointment_overlap');

    data(
      await h.send(MANAGER_PROFILE, 'confirm_appointment', {
        ticket_id: signalled,
        decision: 'confirm',
        merge_into_ticket_id: entered,
      }),
    );
    expect(h.db.ticket(signalled)).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'merged',
    });
    expect(h.db.ticket(entered)).toMatchObject({
      status: 'waiting',
      client_id: CLIENT,
    });
    expect(h.db.contacts.get(signalled)?.is_active).toBe(false);
    expect(h.db.contacts.get(entered)).toMatchObject({
      is_active: true,
      phone_e164: '+33612345678',
    });
  });

  it('confirming without merge a number that already has a ticket is refused', async () => {
    data(
      await create({
        phone: '0612345678',
        scheduled_at: '2026-10-19T16:30:00+02:00',
      }),
    );
    const signalled = data(
      await h.send(CLIENT, 'check_in_appointment', {
        salon_id: SALON,
        qr_token: QR,
        scheduled_time: '14:30',
        member_id: ANNA,
      }),
    ).ticket_id;
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'confirm_appointment', {
          ticket_id: signalled,
          decision: 'confirm',
        }),
      ),
    ).toBe('already_has_active_ticket');
    expect(h.db.ticket(signalled as string).status).toBe(
      'pending_confirmation',
    );
  });

  it('a check-in elsewhere while a ticket is active is refused', async () => {
    h.db.salons.get(OTHER_SALON)!.qr_token = 'other-qr';
    data(await join());
    expect(
      code(
        await h.send(CLIENT, 'check_in_appointment', {
          salon_id: OTHER_SALON,
          qr_token: 'other-qr',
          scheduled_time: '14:30',
        }),
      ),
    ).toBe('already_has_active_ticket');
  });

  it('a refusal carries its reason (E29)', async () => {
    const { ticket_id } = data(
      await h.send(CLIENT, 'check_in_appointment', {
        salon_id: SALON,
        qr_token: QR,
        scheduled_time: '14:30',
        first_name: 'Léa',
      }),
    );
    data(
      await h.send(MANAGER_PROFILE, 'confirm_appointment', {
        ticket_id,
        decision: 'reject',
        reason_code: 'duplicate',
      }),
    );
    expect(h.db.ticket(ticket_id as string)).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'appointment_rejected',
      removal_reason: 'duplicate',
    });
    expect(h.db.contacts.get(ticket_id as string)?.is_active).toBe(false);
  });
});

describe('setup test and publication (K24, K35)', () => {
  beforeEach(() => {
    h.db.salons.get(SALON)!.status = 'approved';
    h.db.salons.get(SALON)!.queue_status = 'closed';
  });

  it('runs the test client through the queue and records the success', async () => {
    const created = data(
      await h.send(MANAGER_PROFILE, 'create_test_ticket', { salon_id: SALON }),
    );
    const id = created.ticket_id as string;
    expect(h.db.ticket(id)).toMatchObject({
      is_test: true,
      display_name: 'Test',
      status: 'waiting',
    });
    expect(h.db.contacts.has(id)).toBe(false);
    // A second tap returns the running test.
    expect(
      data(
        await h.send(MANAGER_PROFILE, 'create_test_ticket', {
          salon_id: SALON,
        }),
      ).ticket_id,
    ).toBe(id);

    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    data(
      await h.send(ANNA_PROFILE, 'confirm_arrival', {
        short_code: created.short_code,
      }),
    );
    data(
      await h.send(ANNA_PROFILE, 'start_service', {
        ticket_id: id,
        planned_duration_minutes: 30,
      }),
    );
    data(await h.send(ANNA_PROFILE, 'complete_service', { ticket_id: id }));
    expect(h.db.salons.get(SALON)!.setup_test_passed_at).toBe(h.now);
  });

  it('only a manager, only before publication', async () => {
    expect(
      code(
        await h.send(ANNA_PROFILE, 'create_test_ticket', { salon_id: SALON }),
      ),
    ).toBe('forbidden');
    h.db.salons.get(SALON)!.status = 'published';
    expect(
      code(
        await h.send(MANAGER_PROFILE, 'create_test_ticket', {
          salon_id: SALON,
        }),
      ),
    ).toBe('salon_already_published');
  });

  it('lists what is missing, then publishes', async () => {
    h.db.salons.get(SALON)!.status = 'pending_review';
    h.db.salons.get(SALON)!.opening_hours_count = 0;
    h.db.services.forEach((s) => (s.is_active = false));
    h.db.members.forEach(
      (m) => (m.status = m.role === 'manager' ? 'active' : 'invited'),
    );
    h.db.members.find((m) => m.id === MANAGER)!.is_hairdressing = false;
    const missing = await h.send(MANAGER_PROFILE, 'publish_salon', {
      salon_id: SALON,
    });
    expect(missing.body).toEqual({
      ok: false,
      error: {
        code: 'salon_not_ready',
        messageKey: 'errors.queue.salon_not_ready',
        details: {
          missing: [
            'verification',
            'setup_test',
            'opening_hours',
            'active_stylist',
            'active_service',
          ],
        },
      },
    });

    const salon = h.db.salons.get(SALON)!;
    Object.assign(salon, {
      status: 'approved',
      opening_hours_count: 5,
      setup_test_passed_at: h.now - 1000,
    });
    h.db.services[0]!.is_active = true;
    h.db.members.forEach((m) => (m.status = 'active'));
    expect(
      code(await h.send(ANNA_PROFILE, 'publish_salon', { salon_id: SALON })),
    ).toBe('forbidden');
    data(await h.send(MANAGER_PROFILE, 'publish_salon', { salon_id: SALON }));
    expect(salon).toMatchObject({
      status: 'published',
      published_at: new Date(h.now).toISOString(),
    });
    expect(h.db.events.at(-1)).toMatchObject({
      scope: 'salon',
      type: 'published',
    });
    expect(
      code(await h.send(MANAGER_PROFILE, 'publish_salon', { salon_id: SALON })),
    ).toBe('salon_already_published');
    expect(
      code(await h.send(OTHER_PROFILE, 'publish_salon', { salon_id: SALON })),
    ).toBe('forbidden');
  });
});

describe('error responses', () => {
  const codes: ServiceErrorCode[] = [
    'forbidden',
    'invalid_transition',
    'invalid_payload',
    'rate_limited',
    'invalid_phone',
    'invalid_qr_token',
    'salon_not_ready',
    'salon_already_published',
    'already_has_active_ticket',
    'no_eligible_ticket',
    'call_already_in_progress',
    'appointment_overlap',
    'closing_not_reached',
  ];

  it.each(codes)('%s has its dictionary key', (c) => {
    const body = errorResponse(c).body as { error: { messageKey: string } };
    const key = body.error.messageKey.split('.').slice(1);
    let node: unknown = errors;
    for (const part of key) node = (node as Record<string, unknown>)[part];
    expect(typeof node === 'string' || typeof node === 'object').toBe(true);
    expect(node).toBeDefined();
  });

  it('maps codes to HTTP statuses', () => {
    expect(errorResponse('invalid_payload').status).toBe(400);
    expect(errorResponse('forbidden').status).toBe(403);
    expect(errorResponse('rate_limited').status).toBe(429);
    expect(errorResponse('queue_full').status).toBe(409);
  });
});
