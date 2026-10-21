import { beforeEach, describe, expect, it } from 'vitest';
import { code, data, harness, type Harness } from './harness.ts';
import { deactivateMember, revokeMemberSessions } from './service.ts';
import {
  ANNA,
  ANNA_PROFILE,
  BEN,
  CLIENT,
  CLIENT_2,
  CUT,
  MANAGER,
  MANAGER_PROFILE,
  OTHER_PROFILE,
  SALON,
  fakePhones,
  sequenceRandom,
} from './testing.ts';

let h: Harness;
const deps = () => ({
  db: h.db,
  clock: () => h.now,
  random: sequenceRandom(),
  phones: fakePhones,
});
beforeEach(() => {
  h = harness();
});

const join = (profile: string, extra: Record<string, unknown> = {}) =>
  h.send(profile, 'join_queue', {
    salon_id: SALON,
    service_id: CUT,
    channel: 'app',
    ...extra,
  });

describe('revoke-member-sessions (S-16 scenario 1)', () => {
  it('cuts every session and push of the member, who stays active', async () => {
    expect(
      data(
        await revokeMemberSessions(
          deps(),
          { profileId: MANAGER_PROFILE },
          { member_id: ANNA },
        ),
      ),
    ).toEqual({ sessions_kept: false });
    expect(h.db.revokedSessions).toEqual([ANNA_PROFILE]);
    expect(h.db.deletedPush).toEqual([ANNA]);
    expect(h.db.members.find((m) => m.id === ANNA)?.status).toBe('active');
    expect(h.db.events.at(-1)).toMatchObject({
      scope: 'salon',
      type: 'member_sessions_revoked',
      subject_member_id: ANNA,
      actor_member_id: MANAGER,
    });
  });

  it('is for a manager of that salon only (scenarios 9, 10)', async () => {
    const response = await revokeMemberSessions(
      deps(),
      { profileId: ANNA_PROFILE },
      { member_id: BEN },
    );
    expect(code(response)).toBe('forbidden');
    const other = await revokeMemberSessions(
      deps(),
      { profileId: OTHER_PROFILE },
      { member_id: ANNA },
    );
    expect(other.status).toBe(404);
    expect(code(other)).toBe('team.member_not_found');
    expect(
      code(
        await revokeMemberSessions(
          deps(),
          { profileId: MANAGER_PROFILE },
          { member_id: 'x' },
        ),
      ),
    ).toBe('invalid_payload');
    expect(
      (
        await revokeMemberSessions(
          deps(),
          { profileId: null },
          { member_id: ANNA },
        )
      ).status,
    ).toBe(401);
    expect(h.db.revokedSessions).toEqual([]);
  });
});

describe('never across salons (security review DEV-6)', () => {
  it('an old, deactivated membership gives no power over the person', async () => {
    data(
      await deactivateMember(
        deps(),
        { profileId: MANAGER_PROFILE },
        { member_id: BEN },
      ),
    );
    h.db.revokedSessions = [];
    expect(
      code(
        await revokeMemberSessions(
          deps(),
          { profileId: MANAGER_PROFILE },
          { member_id: BEN },
        ),
      ),
    ).toBe('team.member_not_found');
    expect(h.db.revokedSessions).toEqual([]);
  });

  it('someone who also works in another salon keeps his sessions', async () => {
    h.db.members.push({
      ...h.db.members.find((m) => m.id === BEN)!,
      id: '20000000-0000-4000-8000-0000000000b2',
      salon_id: '10000000-0000-4000-8000-000000000002',
    });
    expect(
      data(
        await revokeMemberSessions(
          deps(),
          { profileId: MANAGER_PROFILE },
          { member_id: BEN },
        ),
      ),
    ).toEqual({ sessions_kept: true });
    data(
      await deactivateMember(
        deps(),
        { profileId: MANAGER_PROFILE },
        { member_id: BEN },
      ),
    );
    expect(h.db.revokedSessions).toEqual([]);
    expect(h.db.deletedPush).toEqual([BEN, BEN]);
    expect(h.db.members.find((m) => m.id === BEN)?.status).toBe('deactivated');
  });
});

describe('deactivate-member (S-16 scenarios 4 to 8)', () => {
  it('deactivates, revokes, and lets his clients choose without « attendre »', async () => {
    const waiting = data(await join(CLIENT, { requested_member_id: ANNA }))
      .ticket_id as string;
    data(
      await revokeMemberSessions(
        deps(),
        { profileId: MANAGER_PROFILE },
        { member_id: BEN },
      ),
    );
    h.db.revokedSessions = [];

    const response = await deactivateMember(
      deps(),
      { profileId: MANAGER_PROFILE },
      { member_id: ANNA },
    );
    data(response);
    expect(h.db.members.find((m) => m.id === ANNA)?.status).toBe('deactivated');
    expect(h.db.revokedSessions).toEqual([ANNA_PROFILE]);
    expect(h.db.ticket(waiting).stylist_change_pending_since).toBe(h.now);
    const choice = h.db.notifications.find(
      (n) => n.template === 'stylist_change_required',
    );
    expect(choice).toMatchObject({ requires_consent: false });
    expect(h.db.events.map((e) => e.type)).toEqual(
      expect.arrayContaining(['presence_changed', 'member_deactivated']),
    );
    expect(code(await h.send(ANNA_PROFILE, 'call_ticket'))).toBe('forbidden');
  });

  it('puts the client he had called back at the head (E6)', async () => {
    const called = data(await join(CLIENT)).ticket_id as string;
    data(await join(CLIENT_2, { first_name: 'Tom' }));
    data(await h.send(ANNA_PROFILE, 'call_ticket'));
    data(
      await deactivateMember(
        deps(),
        { profileId: MANAGER_PROFILE },
        { member_id: ANNA },
      ),
    );
    expect(h.db.ticket(called)).toMatchObject({
      status: 'waiting',
      called_at: null,
      priority_since: h.now,
    });
  });

  it('refuses twice, the last manager, and other salons (scenarios 8, 8 bis, 9)', async () => {
    data(
      await deactivateMember(
        deps(),
        { profileId: MANAGER_PROFILE },
        { member_id: BEN },
      ),
    );
    expect(
      code(
        await deactivateMember(
          deps(),
          { profileId: MANAGER_PROFILE },
          { member_id: BEN },
        ),
      ),
    ).toBe('team.already_deactivated');
    const last = await deactivateMember(
      deps(),
      { profileId: MANAGER_PROFILE },
      { member_id: MANAGER },
    );
    expect(last.status).toBe(409);
    expect(code(last)).toBe('team.last_manager');
    expect(
      code(
        await deactivateMember(
          deps(),
          { profileId: OTHER_PROFILE },
          { member_id: ANNA },
        ),
      ),
    ).toBe('team.member_not_found');
    expect(
      code(
        await deactivateMember(
          deps(),
          { profileId: ANNA_PROFILE },
          { member_id: BEN },
        ),
      ),
    ).toBe('forbidden');
  });

  it('an invited member is simply deactivated', async () => {
    h.db.members.find((m) => m.id === BEN)!.status = 'invited';
    data(
      await deactivateMember(
        deps(),
        { profileId: MANAGER_PROFILE },
        { member_id: BEN },
      ),
    );
    expect(h.db.members.find((m) => m.id === BEN)?.status).toBe('deactivated');
  });
});
