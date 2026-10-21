import { TeamError } from './ports.ts';
import type { AuthAdmin, Mailer, TeamErrorCode, TeamStore } from './ports.ts';
import { generateToken, hashToken, invitationExpiry } from './token.ts';

export interface InviteInput {
  firstName: string;
  lastName: string;
  email: string;
  specialties: string[];
}

export type TeamResponse<T> =
  | { status: 200; body: { ok: true; data: T } }
  | {
      status: 400 | 403 | 409 | 410 | 500;
      body: { ok: false; error: { code: string; messageKey: string } };
    };

const STATUS: Record<TeamErrorCode, 400 | 403 | 409 | 410> = {
  'queue.forbidden': 403,
  'queue.invalid_payload': 400,
  'team.specialty_required': 400,
  'team.email_already_used': 409,
  'team.limit_reached': 409,
  'invite.link_invalid': 410,
};

function failure(
  code: TeamErrorCode | 'generic.unexpected',
): TeamResponse<never> {
  return {
    status: code === 'generic.unexpected' ? 500 : STATUS[code],
    body: {
      ok: false,
      error: {
        code,
        messageKey:
          code === 'invite.link_invalid'
            ? 'pro-stylist.invite.link_invalid'
            : `errors.${code}`,
      },
    },
  };
}

function toFailure(error: unknown): TeamResponse<never> {
  return failure(
    error instanceof TeamError ? error.code : 'generic.unexpected',
  );
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface InviteDeps {
  store: TeamStore;
  mailer: Mailer;
  appUrl: string;
  now?: () => Date;
}

/** S-04. The database checks the caller is the salon's manager. */
export async function inviteMember(
  deps: InviteDeps,
  managerId: string,
  input: InviteInput,
): Promise<TeamResponse<{ memberId: string }>> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  if (!firstName || !lastName || !EMAIL.test(email)) {
    return failure('queue.invalid_payload');
  }
  const specialties = [...new Set(input.specialties)];
  if (specialties.length === 0) return failure('team.specialty_required');

  const token = generateToken();
  try {
    const created = await deps.store.invite({
      managerId,
      firstName,
      lastName,
      email,
      specialties,
      tokenHash: await hashToken(token),
      expiresAt: invitationExpiry((deps.now ?? (() => new Date()))()),
    });
    await deps.mailer.sendInvitation({
      to: email,
      firstName,
      salonName: created.salonName,
      link: `${deps.appUrl}/invite/${token}`,
    });
    return {
      status: 200,
      body: { ok: true, data: { memberId: created.memberId } },
    };
  } catch (error) {
    return toFailure(error);
  }
}

export interface ActivateDeps {
  store: TeamStore;
  auth: AuthAdmin;
  mailer: Mailer;
  /** Where the magic link lands, e.g. "https://pro.example/stylist/queue". */
  signedInUrl: string;
}

/** C-01 scenarios 1, 2, 5 and 6. */
export async function activateInvitation(
  deps: ActivateDeps,
  token: string,
): Promise<TeamResponse<Record<string, never>>> {
  try {
    const tokenHash = await hashToken(token);
    const invitation = await deps.store.peek(tokenHash);
    const userId =
      (await deps.store.findUserId(invitation.email)) ??
      (await deps.auth.createUser(invitation.email));
    const { email } = await deps.store.activate(tokenHash, userId);
    const link = await deps.auth.magicLink(email, deps.signedInUrl);
    await deps.mailer.sendMagicLink({ to: email, link });
    return { status: 200, body: { ok: true, data: {} } };
  } catch (error) {
    return toFailure(error);
  }
}
