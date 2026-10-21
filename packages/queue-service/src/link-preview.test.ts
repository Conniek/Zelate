import { describe, expect, it } from 'vitest';
import { code, data, harness } from './harness.ts';
import {
  LINK_VALIDITY_MS,
  readTicketLink,
  type TicketLinkReader,
} from './link.ts';
import { previewPresenceChange, previewReassignment } from './service.ts';
import {
  ANNA,
  ANNA_PROFILE,
  BEN,
  BEN_PROFILE,
  CLIENT,
  CLIENT_2,
  CUT,
  MANAGER_PROFILE,
  MONDAY_10H,
  SALON,
  fakePhones,
  sequenceRandom,
} from './testing.ts';

describe('ticket-public (ADR-006)', () => {
  const view = {
    tracking_token: 't'.repeat(43),
    ticket: { id: 'x', status: 'waiting' },
    salon: { name: 'Salon' },
    assigned_stylist_first_name: null,
    created_at: MONDAY_10H,
  };
  const reader: TicketLinkReader = {
    byLinkCode: async (c) => (c === 'Abc12345' ? view : null),
  };

  it('returns the ticket view and its token, without the creation time', async () => {
    const response = await readTicketLink(
      reader,
      'Abc12345',
      MONDAY_10H + 3600_000,
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        tracking_token: view.tracking_token,
        ticket: view.ticket,
        salon: view.salon,
        assigned_stylist_first_name: null,
      },
    });
  });

  it('answers the same for an unknown, malformed or expired link', async () => {
    const expired = await readTicketLink(
      reader,
      'Abc12345',
      MONDAY_10H + LINK_VALIDITY_MS + 1,
    );
    const unknown = await readTicketLink(reader, 'Zzz99999', MONDAY_10H);
    const malformed = await readTicketLink(reader, '../etc', MONDAY_10H);
    expect(expired).toEqual(unknown);
    expect(malformed).toEqual(unknown);
    expect(unknown).toEqual({
      status: 410,
      body: {
        ok: false,
        error: { code: 'link_expired', messageKey: 'client.tracking.expired' },
      },
    });
  });
});

describe('preview_presence_change (K2)', () => {
  it('shows who moves and who must choose, without writing', async () => {
    const h = harness();
    const { ticket_id } = data(
      await h.send(CLIENT, 'join_queue', {
        salon_id: SALON,
        service_id: CUT,
        channel: 'app',
        requested_member_id: ANNA,
      }),
    );
    const deps = {
      db: h.db,
      clock: () => h.now,
      random: sequenceRandom(),
      phones: fakePhones,
    };
    const before = JSON.stringify([...h.db.tickets.values()]);
    const versions = h.db.salons.get(SALON)!.queue_version;
    const response = await previewPresenceChange(
      deps,
      { profileId: MANAGER_PROFILE },
      { member_id: ANNA, status: 'absent' },
    );
    const { tickets } = data(response) as {
      tickets: Record<string, unknown>[];
    };
    expect(tickets).toEqual([
      expect.objectContaining({ ticket_id, choice_required: true }),
    ]);
    expect(JSON.stringify([...h.db.tickets.values()])).toBe(before);
    expect(h.db.salons.get(SALON)!.queue_version).toBe(versions);
    expect(h.db.processed.size).toBe(1); // only the join

    expect(
      code(
        await previewPresenceChange(
          deps,
          { profileId: ANNA_PROFILE },
          { member_id: ANNA, status: 'absent' },
        ),
      ),
    ).toBe('forbidden');
    expect(
      code(
        await previewPresenceChange(
          deps,
          { profileId: MANAGER_PROFILE },
          { status: 'x' },
        ),
      ),
    ).toBe('invalid_payload');
    expect(
      code(
        await previewPresenceChange(
          deps,
          { profileId: MANAGER_PROFILE },
          {
            member_id: '20000000-0000-4000-8000-0000000000ff',
            status: 'absent',
          },
        ),
      ),
    ).toMatch(/forbidden|invalid_payload/);
  });
});

describe('previews of the manager board (S-11, S-13)', () => {
  const depsOf = (h: ReturnType<typeof harness>) => ({
    db: h.db,
    clock: () => h.now,
    random: sequenceRandom(),
    phones: fakePhones,
  });

  it('S-11: an absence shows the called client sent back and who changes stylist', async () => {
    const h = harness();
    const first = data(
      await h.send(CLIENT, 'join_queue', {
        salon_id: SALON,
        service_id: CUT,
        channel: 'app',
      }),
    ).ticket_id;
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    const before = JSON.stringify([...h.db.tickets.values()]);
    const { tickets } = data(
      await previewPresenceChange(
        depsOf(h),
        { profileId: MANAGER_PROFILE },
        { member_id: ANNA, status: 'absent' },
      ),
    ) as { tickets: Record<string, unknown>[] };
    expect(tickets).toEqual([
      expect.objectContaining({
        ticket_id: first,
        kind: 'queue',
        status_before: 'called',
        status_after: 'waiting',
        member_before: ANNA,
      }),
    ]);
    expect(JSON.stringify([...h.db.tickets.values()])).toBe(before);
  });

  it('S-13: a reassignment gives the new time, without writing', async () => {
    const h = harness();
    const ticket_id = data(
      await h.send(CLIENT, 'join_queue', {
        salon_id: SALON,
        service_id: CUT,
        channel: 'app',
      }),
    ).ticket_id as string;
    const ticket = h.db.tickets.get(ticket_id)!;
    const other = ticket.estimated_member_id === ANNA ? BEN : ANNA;
    const before = JSON.stringify([...h.db.tickets.values()]);
    const response = await previewReassignment(
      depsOf(h),
      { profileId: MANAGER_PROFILE },
      { ticket_id, member_id: other },
    );
    const { reassignment } = data(response) as {
      reassignment: Record<string, unknown>;
    };
    expect(reassignment).toEqual(
      expect.objectContaining({ ticket_id, needs_client_answer: false }),
    );
    expect(reassignment.estimated_start_at_after).not.toBeNull();
    expect(JSON.stringify([...h.db.tickets.values()])).toBe(before);
    expect(h.db.processed.size).toBe(1);
  });

  it('S-13: a later time means the client is asked first', async () => {
    const h = harness();
    // Ben is busy with a first client; the second one waits for Anna, free now.
    data(
      await h.send(CLIENT, 'join_queue', {
        salon_id: SALON,
        service_id: CUT,
        channel: 'app',
        requested_member_id: BEN,
      }),
    );
    data(await h.send(BEN_PROFILE, 'call_ticket'));
    const ticket_id = data(
      await h.send(CLIENT_2, 'join_queue', {
        salon_id: SALON,
        service_id: CUT,
        channel: 'app',
        first_name: 'Tom',
      }),
    ).ticket_id as string;
    const { reassignment } = data(
      await previewReassignment(
        depsOf(h),
        { profileId: MANAGER_PROFILE },
        { ticket_id, member_id: BEN },
      ),
    ) as { reassignment: Record<string, string | boolean | null> };
    expect(reassignment.needs_client_answer).toBe(true);
    expect(
      Date.parse(reassignment.estimated_start_at_after as string),
    ).toBeGreaterThan(
      Date.parse(reassignment.estimated_start_at_before as string),
    );
  });

  it('S-13: only the manager may preview', async () => {
    const h = harness();
    const ticket_id = data(
      await h.send(CLIENT, 'join_queue', {
        salon_id: SALON,
        service_id: CUT,
        channel: 'app',
      }),
    ).ticket_id;
    expect(
      code(
        await previewReassignment(
          depsOf(h),
          { profileId: ANNA_PROFILE },
          { ticket_id, member_id: BEN },
        ),
      ),
    ).toBe('forbidden');
  });
});
