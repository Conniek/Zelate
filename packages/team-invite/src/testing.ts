import { TeamError } from './ports.ts';
import type { AuthAdmin, Mailer, NewInvitation, TeamStore } from './ports.ts';

/** In-memory double of the database functions. */
export function fakeTeamStore(
  options: { users?: Record<string, string> } = {},
) {
  const invitations: NewInvitation[] = [];
  const activated: { tokenHash: Uint8Array; userId: string }[] = [];
  const key = (hash: Uint8Array) => hash.join(',');
  const used = new Set<string>();
  const store: TeamStore = {
    invite(invitation) {
      if (invitations.some((i) => i.email === invitation.email)) {
        return Promise.reject(new TeamError('team.email_already_used'));
      }
      invitations.push(invitation);
      return Promise.resolve({
        memberId: `member-${invitations.length}`,
        salonName: 'Chez Léa',
      });
    },
    peek(hash) {
      const found = invitations.find((i) => key(i.tokenHash) === key(hash));
      if (
        !found ||
        used.has(key(hash)) ||
        found.expiresAt.getTime() <= Date.now()
      ) {
        return Promise.reject(new TeamError('invite.link_invalid'));
      }
      return Promise.resolve({
        email: found.email,
        firstName: found.firstName,
        salonName: 'Chez Léa',
      });
    },
    findUserId(email) {
      return Promise.resolve(options.users?.[email] ?? null);
    },
    activate(hash, userId) {
      const found = invitations.find((i) => key(i.tokenHash) === key(hash));
      if (!found || used.has(key(hash))) {
        return Promise.reject(new TeamError('invite.link_invalid'));
      }
      used.add(key(hash));
      activated.push({ tokenHash: hash, userId });
      return Promise.resolve({ email: found.email });
    },
  };
  return Object.assign(store, { invitations, activated });
}

export function fakeAuth() {
  const created: string[] = [];
  const links: string[] = [];
  const auth: AuthAdmin = {
    createUser(email) {
      created.push(email);
      return Promise.resolve(`user-${created.length}`);
    },
    magicLink(email, redirectTo) {
      const link = `https://auth.test/verify?email=${email}&to=${redirectTo}`;
      links.push(link);
      return Promise.resolve(link);
    },
  };
  return Object.assign(auth, { created, links });
}

export function fakeMailer(failWith?: Error) {
  const invitations: { to: string; link: string; salonName: string }[] = [];
  const magicLinks: { to: string; link: string }[] = [];
  const mailer: Mailer = {
    sendInvitation(mail) {
      if (failWith) return Promise.reject(failWith);
      invitations.push(mail);
      return Promise.resolve();
    },
    sendMagicLink(mail) {
      if (failWith) return Promise.reject(failWith);
      magicLinks.push(mail);
      return Promise.resolve();
    },
  };
  return Object.assign(mailer, { invitations, magicLinks });
}
