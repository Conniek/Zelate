import { describe, expect, it } from 'vitest';
import {
  activateInvitation,
  generateToken,
  hashToken,
  invitationExpiry,
  inviteMember,
  toByteaHex,
} from './index.ts';
import { fakeAuth, fakeMailer, fakeTeamStore } from './testing.ts';

const input = {
  firstName: ' Léa ',
  lastName: 'Durand',
  email: ' Lea@Exemple.fr ',
  specialties: ['women_cut', 'women_cut', 'color'],
};

function setup(users?: Record<string, string>, mailError?: Error) {
  const store = fakeTeamStore(users ? { users } : {});
  const mailer = fakeMailer(mailError);
  const auth = fakeAuth();
  return {
    store,
    mailer,
    auth,
    invite: (i = input) =>
      inviteMember(
        { store, mailer, appUrl: 'https://pro.test' },
        'manager-1',
        i,
      ),
    activate: (token: string) =>
      activateInvitation(
        { store, auth, mailer, signedInUrl: 'https://pro.test/stylist/queue' },
        token,
      ),
  };
}

function tokenOf(link: string) {
  return link.split('/invite/')[1] ?? '';
}

describe('tokens', () => {
  it('generates distinct URL-safe 32-byte tokens', () => {
    const a = generateToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateToken()).not.toBe(a);
  });
  it('hashes to 32 bytes and formats bytea', async () => {
    const hash = await hashToken('abc');
    expect(hash).toHaveLength(32);
    expect(toByteaHex(new Uint8Array([1, 255]))).toBe('\\x01ff');
  });
  it('expires after 72 hours', () => {
    expect(
      invitationExpiry(new Date('2026-01-01T00:00:00Z')).toISOString(),
    ).toBe('2026-01-04T00:00:00.000Z');
  });
});

describe('inviteMember', () => {
  it('stores a hashed token, cleans the input and emails the link once', async () => {
    const t = setup();
    const response = await t.invite();
    expect(response.status).toBe(200);
    const [saved] = t.store.invitations;
    expect(saved).toMatchObject({
      managerId: 'manager-1',
      firstName: 'Léa',
      email: 'lea@exemple.fr',
      specialties: ['women_cut', 'color'],
    });
    expect(t.mailer.invitations).toHaveLength(1);
    const token = tokenOf(t.mailer.invitations[0]?.link ?? '');
    expect(token).not.toBe('');
    expect(saved?.tokenHash).toEqual(await hashToken(token));
  });
  it('refuses a missing field or a malformed e-mail without sending', async () => {
    const t = setup();
    for (const bad of [
      { ...input, firstName: ' ' },
      { ...input, lastName: '' },
      { ...input, email: 'nope' },
    ]) {
      const response = await t.invite(bad);
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: { code: 'queue.invalid_payload' },
      });
    }
    expect(t.mailer.invitations).toHaveLength(0);
  });
  it('requires a specialty', async () => {
    const t = setup();
    const response = await t.invite({ ...input, specialties: [] });
    expect(response.body).toMatchObject({
      error: { code: 'team.specialty_required' },
    });
    expect(t.mailer.invitations).toHaveLength(0);
  });
  it('sends no e-mail when the database refuses', async () => {
    const t = setup();
    await t.invite();
    const second = await t.invite();
    expect(second.status).toBe(409);
    expect(t.mailer.invitations).toHaveLength(1);
  });
  it('answers generic.unexpected when the mailer fails', async () => {
    const t = setup(undefined, new Error('smtp down'));
    const response = await t.invite();
    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: { code: 'generic.unexpected' },
    });
  });
});

describe('activateInvitation', () => {
  async function invited(t: ReturnType<typeof setup>) {
    await t.invite();
    return tokenOf(t.mailer.invitations[0]?.link ?? '');
  }

  it('creates the account, activates the member and sends the magic link', async () => {
    const t = setup();
    const token = await invited(t);
    const response = await t.activate(token);
    expect(response.status).toBe(200);
    expect(t.auth.created).toEqual(['lea@exemple.fr']);
    expect(t.store.activated).toHaveLength(1);
    expect(t.mailer.magicLinks[0]?.to).toBe('lea@exemple.fr');
    expect(t.auth.links[0]).toContain('/stylist/queue');
  });
  it('reuses an existing account', async () => {
    const t = setup({ 'lea@exemple.fr': 'existing-user' });
    const token = await invited(t);
    await t.activate(token);
    expect(t.auth.created).toEqual([]);
    expect(t.store.activated[0]?.userId).toBe('existing-user');
  });
  it('refuses a link already used, without a second e-mail', async () => {
    const t = setup();
    const token = await invited(t);
    await t.activate(token);
    const again = await t.activate(token);
    expect(again.status).toBe(410);
    expect(again.body).toMatchObject({
      error: { messageKey: 'pro-stylist.invite.link_invalid' },
    });
    expect(t.mailer.magicLinks).toHaveLength(1);
  });
  it('refuses an unknown link and creates no account', async () => {
    const t = setup();
    const response = await t.activate('unknown');
    expect(response.status).toBe(410);
    expect(t.auth.created).toEqual([]);
    expect(t.mailer.magicLinks).toEqual([]);
  });
  it('refuses an expired link', async () => {
    const t = setup();
    const store = t.store;
    const early = new Date(Date.now() - 80 * 3600 * 1000);
    const response = await inviteMember(
      { store, mailer: t.mailer, appUrl: 'https://pro.test', now: () => early },
      'manager-1',
      input,
    );
    expect(response.status).toBe(200);
    const token = tokenOf(t.mailer.invitations[0]?.link ?? '');
    expect((await t.activate(token)).status).toBe(410);
    expect(t.mailer.magicLinks).toEqual([]);
  });
  it('answers generic.unexpected on an unknown failure', async () => {
    const t = setup();
    const token = await invited(t);
    t.auth.magicLink = () => Promise.reject(new Error('boom'));
    expect((await t.activate(token)).status).toBe(500);
  });
});
