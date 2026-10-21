import { beforeEach, describe, expect, it } from 'vitest';
import { code, data, harness, type Harness } from './harness.ts';
import {
  ANNA,
  ANNA_PROFILE,
  BEN_PROFILE,
  CLIENT,
  CLIENT_2,
  CUT,
  MANAGER_PROFILE,
  SALON,
} from './testing.ts';

let h: Harness;
beforeEach(() => {
  h = harness();
});

async function join(profile = CLIENT, extra: Record<string, unknown> = {}) {
  return h.send(profile, 'join_queue', {
    salon_id: SALON,
    service_id: CUT,
    channel: 'app',
    ...extra,
  });
}

describe('join_queue', () => {
  it('creates the ticket, its private contact and the outbox rows', async () => {
    const response = await join(CLIENT, { notifications_consent: true });
    expect(response.status).toBe(200);
    const { ticket_id, short_code, queue_version } = data(response);
    expect(short_code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(queue_version).toBe(1);

    const ticket = h.db.ticket(ticket_id as string);
    expect(ticket).toMatchObject({
      status: 'waiting',
      client_id: CLIENT,
      display_name: 'Léa',
      channel: 'app',
      service_date: '2026-10-19',
    });
    expect(ticket.notifications_consent_at).toBe(h.now);
    expect(ticket.estimated_start_at).not.toBeNull();
    const raw = h.db.rawTicket(ticket_id as string);
    expect(raw.tracking_token).toMatch(/^token-/);
    expect(raw.salon_id).toBe(SALON);

    expect(h.db.contacts.get(ticket_id as string)).toMatchObject({
      phone_e164: '+33612345678',
      is_active: true,
      is_pending_confirmation: false,
    });
    const created = h.db.notifications.filter(
      (n) => n.template === 'ticket_created',
    );
    expect(created.map((n) => n.channel).sort()).toEqual(['push', 'sms']);
    expect(created[0]).toMatchObject({
      recipient_profile_id: CLIENT,
      recipient_member_id: null,
    });
    expect(h.db.salons.get(SALON)!.queue_version).toBe(1);
    expect(h.db.salons.get(SALON)!.waiting_count).toBe(1);
    expect(JSON.parse(h.db.salons.get(SALON)!.next_free_slots)).toEqual(
      expect.arrayContaining([expect.objectContaining({ service_id: CUT })]),
    );
  });

  it('never writes the phone or the token into events, params or broadcasts (H6)', async () => {
    const { ticket_id } = data(await join());
    const raw = h.db.rawTicket(ticket_id as string);
    const leaked = JSON.stringify({
      events: h.db.events,
      notifications: h.db.notifications,
      broadcasts: h.db.broadcasts,
    });
    expect(leaked).not.toContain('+33612345678');
    expect(leaked).not.toContain(raw.tracking_token as string);
    expect(leaked).not.toContain('Léa');
  });

  it('creates the profile at the first ticket, with the first name (K30)', async () => {
    expect(code(await join(CLIENT_2))).toBe('invalid_payload');
    expect(h.db.tickets.size).toBe(0);
    const response = await join(CLIENT_2, { first_name: 'Tom' });
    expect(h.db.profiles.get(CLIENT_2)?.first_name).toBe('Tom');
    expect(h.db.ticket(data(response).ticket_id as string).display_name).toBe(
      'Tom',
    );
  });

  it('needs a session', async () => {
    const response = await join(null as unknown as string);
    expect(response.status).toBe(401);
    expect(code(response)).toBe('forbidden');
  });

  it('refuses a second active ticket, here or with the same number elsewhere', async () => {
    data(await join());
    expect(code(await join())).toBe('already_has_active_ticket');
    // Same number on another account: the contact index decides (ADR-011).
    h.db.authPhones.set(CLIENT_2, '+33612345678');
    expect(code(await join(CLIENT_2, { first_name: 'Tom' }))).toBe(
      'already_has_active_ticket',
    );
  });

  it('passes the engine refusal through', async () => {
    h.db.salons.get(SALON)!.queue_status = 'paused';
    const response = await join();
    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      ok: false,
      error: { code: 'queue_paused', messageKey: 'errors.queue.queue_paused' },
    });
  });

  it('refuses an unknown salon and an Auth account without phone', async () => {
    expect(
      code(
        await h.send(CLIENT, 'join_queue', {
          salon_id: '10000000-0000-4000-8000-0000000000ff',
          channel: 'app',
        }),
      ),
    ).toBe('forbidden');
    h.db.authPhones.delete(CLIENT);
    expect(code(await join())).toBe('forbidden');
  });
});

describe('core loop (PRD §2 goal 1)', () => {
  it('call, arrival, start, longer service, completion', async () => {
    const { ticket_id, short_code } = data(await join());
    const id = ticket_id as string;

    const called = data(await h.send(ANNA_PROFILE, 'call_ticket'));
    expect(called.ticket_id).toBe(id);
    expect(h.db.ticket(id)).toMatchObject({
      status: 'called',
      assigned_member_id: ANNA,
      call_count: 1,
    });
    expect(
      h.db.notifications.filter((n) => n.dedupe_key === 'your_turn:1'),
    ).toHaveLength(2);

    data(
      await h.send(ANNA_PROFILE, 'confirm_arrival', {
        short_code: (short_code as string).toLowerCase(),
      }),
    );
    expect(h.db.ticket(id).arrived_at).toBe(h.now);

    h.now += 60_000;
    data(
      await h.send(ANNA_PROFILE, 'start_service', {
        ticket_id: id,
        service_id: CUT,
        planned_duration_minutes: 30,
      }),
    );
    expect(h.db.ticket(id)).toMatchObject({
      status: 'in_service',
      called_at: null,
    });
    expect(h.db.presences.get(`${ANNA}:2026-10-19`)?.status).toBe('in_service');

    data(
      await h.send(ANNA_PROFILE, 'adjust_duration', {
        ticket_id: id,
        delta_minutes: 15,
      }),
    );
    expect(h.db.ticket(id).planned_duration_minutes).toBe(45);

    h.now += 45 * 60_000;
    data(await h.send(ANNA_PROFILE, 'complete_service', { ticket_id: id }));
    expect(h.db.ticket(id).status).toBe('completed');
    expect(h.db.contacts.get(id)?.is_active).toBe(false);
    expect(h.db.members.find((m) => m.id === ANNA)?.served_today_count).toBe(1);
    expect(h.db.presences.get(`${ANNA}:2026-10-19`)).toMatchObject({
      status: 'available',
      updated_by: ANNA,
    });

    const types = h.db.events.map((e) => e.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'created',
        'called',
        'arrival_confirmed',
        'service_started',
        'duration_adjusted',
        'completed',
      ]),
    );
    expect(h.db.events.every((e) => e.command_id !== null)).toBe(true);
  });

  it('broadcasts the salon, the public page and the ticket, with the new version', async () => {
    const { ticket_id } = data(await join());
    expect(h.db.broadcasts).toEqual(
      expect.arrayContaining([
        { kind: 'salon', event: 'queue_updated', version: 1 },
        { kind: 'salon_public', version: 1 },
        { kind: 'ticket', ticket_id, status: 'waiting', version: 1 },
      ]),
    );
    h.db.broadcasts = [];
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    expect(h.db.broadcasts).toEqual(
      expect.arrayContaining([
        { kind: 'salon', event: 'queue_updated', version: 2 },
        { kind: 'ticket', ticket_id, status: 'called', version: 2 },
      ]),
    );
  });

  it('a stylist from another salon or without membership is refused', async () => {
    expect(code(await h.send(CLIENT, 'call_ticket'))).toBe('forbidden');
    expect(code(await h.send(null, 'call_ticket'))).toBe('forbidden');
    const { ticket_id } = data(await join());
    expect(
      code(
        await h.send(
          '30000000-0000-4000-8000-000000000009',
          'complete_service',
          {
            ticket_id,
          },
        ),
      ),
      // The engine only sees the caller's salon: another salon's ticket is unknown.
    ).toBe('invalid_payload');
  });

  it('a deactivated member is refused (ADR-019)', async () => {
    h.db.members.find((m) => m.id === ANNA)!.status = 'deactivated';
    expect(code(await h.send(ANNA_PROFILE, 'call_ticket'))).toBe('forbidden');
  });

  it('take_next postpones the late client and calls the next one', async () => {
    const first = data(await join()).ticket_id as string;
    const second = data(await join(CLIENT_2, { first_name: 'Tom' }))
      .ticket_id as string;
    // T-30 answer while waiting, then the call (E2: no automatic move back).
    data(
      await h.send(CLIENT, 'respond_eta', {
        ticket_id: first,
        response: 'late',
        delay_minutes: 15,
      }),
    );
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    const response = await h.send(ANNA_PROFILE, 'take_next', {
      ticket_id: first,
    });
    data(response);
    expect(h.db.ticket(first)).toMatchObject({
      status: 'waiting',
      postpone_count: 1,
      called_at: null,
    });
    expect(h.db.ticket(second).status).toBe('called');
    expect(h.db.notifications.some((n) => n.template === 'postponed')).toBe(
      true,
    );
  });

  it('a second call by a busy stylist is refused', async () => {
    data(await join());
    data(await join(CLIENT_2, { first_name: 'Tom' }));
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    expect(code(await h.send(ANNA_PROFILE, 'call_ticket'))).toBe(
      'call_already_in_progress',
    );
    expect(
      code(
        await h.send(BEN_PROFILE, 'complete_service', {
          ticket_id: '00000000-0000-4000-8000-0000000000aa',
        }),
      ),
    ).toBe('invalid_payload');
  });

  it('records the manager as actor when he completes a service (E15)', async () => {
    const { ticket_id } = data(await join());
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    const { short_code } = data(
      await h.send(ANNA_PROFILE, 'confirm_arrival', {
        short_code: h.db.ticket(ticket_id as string).short_code,
      }),
    );
    expect(short_code).toBeUndefined();
    data(
      await h.send(ANNA_PROFILE, 'start_service', {
        ticket_id,
        planned_duration_minutes: 30,
      }),
    );
    data(await h.send(MANAGER_PROFILE, 'complete_service', { ticket_id }));
    const completed = h.db.events.find((e) => e.type === 'completed')!;
    expect(completed.actor_type).toBe('manager');
  });
});
