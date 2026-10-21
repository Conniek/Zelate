import { describe, expect, it } from 'vitest';
import { code, data, harness } from './harness.ts';
import {
  LINK_VALIDITY_MS,
  readTicketLink,
  type TicketLinkReader,
} from './link.ts';
import { previewPresenceChange } from './service.ts';
import {
  ANNA,
  ANNA_PROFILE,
  CLIENT,
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
