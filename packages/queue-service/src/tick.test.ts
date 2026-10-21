import { beforeEach, describe, expect, it } from 'vitest';
import { data, harness, type Harness } from './harness.ts';
import {
  ANNA,
  ANNA_PROFILE,
  CLIENT,
  CUT,
  MANAGER,
  MANAGER_PROFILE,
  QR,
  SALON,
} from './testing.ts';

const MINUTE = 60_000;
let h: Harness;
beforeEach(() => {
  h = harness();
});

const join = () =>
  h.send(CLIENT, 'join_queue', {
    salon_id: SALON,
    service_id: CUT,
    channel: 'app',
  });

describe('queue-tick', () => {
  it('writes nothing when nothing is due', async () => {
    await h.tick(); // first pass stores the next free slots
    h.db.broadcasts = [];
    const version = h.db.salons.get(SALON)!.queue_version;
    const report = await h.tick();
    expect(report).toEqual({ salons: 2, changed: 0, failed: 0 });
    expect(h.db.broadcasts).toEqual([]);
    expect(h.db.salons.get(SALON)!.queue_version).toBe(version);
  });

  it("a free stylist's slot follows the clock without a write every minute", async () => {
    await h.tick();
    const stored = h.db.salons.get(SALON)!.next_free_slots;
    for (let i = 0; i < 5; i += 1) {
      h.now += MINUTE;
      expect((await h.tick()).changed).toBe(0);
    }
    expect(h.db.salons.get(SALON)!.next_free_slots).toEqual(stored);
  });

  it('a slot that moves is a new version for the public page', async () => {
    await h.tick();
    // Every stylist on a long break: the slot moves to their return.
    for (const member of [
      '20000000-0000-4000-8000-000000000001',
      ANNA,
      '20000000-0000-4000-8000-000000000003',
    ]) {
      const p = h.db.presences.get(`${member}:2026-10-19`)!;
      Object.assign(p, {
        status: 'on_break',
        break_type: 'meal',
        expected_back_at: h.now + 60 * MINUTE,
      });
    }
    const version = h.db.salons.get(SALON)!.queue_version;
    h.db.broadcasts = [];
    await h.tick();
    expect(h.db.salons.get(SALON)!.queue_version).toBeGreaterThan(version);
    expect(h.db.broadcasts.some((b) => b.kind === 'salon_public')).toBe(true);
  });

  it('reminds at 5 min and releases at 10 min (H4)', async () => {
    const { ticket_id } = data(await join());
    const id = ticket_id as string;
    data(await h.send(ANNA_PROFILE, 'call_ticket'));

    h.now += 5 * MINUTE;
    await h.tick();
    expect(h.db.ticket(id).reminder_sent_at).toBe(h.now);
    expect(
      h.db.notifications.some((n) => n.dedupe_key === 'arrival_reminder:1'),
    ).toBe(true);

    h.now += 5 * MINUTE;
    const report = await h.tick();
    expect(report.changed).toBeGreaterThan(0);
    expect(h.db.ticket(id)).toMatchObject({
      status: 'no_show',
      no_show_at: h.now,
      called_at: null,
    });
    expect(h.db.contacts.get(id)?.is_active).toBe(false);
    expect(
      h.db.notifications.some((n) => n.template === 'released_no_show'),
    ).toBe(true);
    expect(
      h.db.events.some((e) => e.type === 'no_show' && e.command_id === null),
    ).toBe(true);
    expect(h.db.noShowRecords).toHaveLength(1);
    expect(
      h.db.notifications.some((n) => n.template === 'no_show_warning'),
    ).toBe(false);
  });

  it('warns at the 5th absence in 30 days, once (E10, E28)', async () => {
    const { ticket_id } = data(await join());
    const hash = h.db.contacts.get(ticket_id as string)!.phone_hash;
    for (let i = 0; i < 4; i += 1) {
      h.db.noShowRecords.push({
        hash,
        ticket_id: `old-${i}`,
        at: h.now - (i + 1) * 86_400_000,
      });
    }
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    h.now += 10 * MINUTE;
    await h.tick();
    const warnings = h.db.notifications.filter(
      (n) => n.template === 'no_show_warning',
    );
    expect(warnings.map((n) => n.channel).sort()).toEqual(['push', 'sms']);
    expect(warnings[0]).toMatchObject({
      recipient_profile_id: CLIENT,
      requires_consent: false,
      dedupe_key: 'no_show_warning',
    });
    expect(h.db.noShowWarnings.get(hash)).toBe(h.now);
  });

  it('closes yesterday at midnight in Paris (E24, invariant 9)', async () => {
    const { ticket_id } = data(await join());
    h.now = Date.UTC(2026, 9, 19, 22, 5); // 00:05 on Tuesday in Paris
    const report = await h.tick();
    expect(report.salons).toBe(3); // two salons today, one with yesterday's ticket
    expect(h.db.ticket(ticket_id as string)).toMatchObject({
      status: 'cancelled',
      cancel_reason: 'end_of_day',
    });
  });

  it('reminds the salon of an unconfirmed check-in after 10 min (E19)', async () => {
    data(
      await h.send(CLIENT, 'check_in_appointment', {
        salon_id: SALON,
        qr_token: QR,
        scheduled_time: '14:30',
        member_id: ANNA,
      }),
    );
    h.now += 10 * MINUTE;
    await h.tick();
    const reminders = h.db.notifications.filter((n) =>
      n.dedupe_key.endsWith(':reminder'),
    );
    expect(reminders.map((n) => n.recipient_member_id).sort()).toEqual([
      MANAGER,
      ANNA,
    ]);
    expect(reminders[0]!.params).toMatchObject({ variant: 'reminder' });
    // Next minute: nothing more.
    h.now += MINUTE;
    const before = h.db.notifications.length;
    await h.tick();
    expect(h.db.notifications.length).toBe(before);
  });

  it('one failing salon is rolled back and retried the next minute', async () => {
    const { ticket_id } = data(await join());
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    h.now += 10 * MINUTE;
    h.db.failNextApply = true;
    const report = await h.tick();
    expect(report).toMatchObject({ salons: 2, failed: 1 });
    expect(h.db.ticket(ticket_id as string).status).toBe('called');
    h.now += MINUTE;
    expect((await h.tick()).failed).toBe(0);
    expect(h.db.ticket(ticket_id as string).status).toBe('no_show');
  });

  it('a manager command still works after a tick', async () => {
    await h.tick();
    data(
      await h.send(MANAGER_PROFILE, 'set_queue_status', {
        salon_id: SALON,
        status: 'closed',
      }),
    );
    // Closed queue: no free slot is published (E22).
    expect(h.db.salons.get(SALON)!.next_free_slots).toEqual([]);
  });
});
