export type TeamErrorCode =
  | 'queue.forbidden'
  | 'queue.invalid_payload'
  | 'team.specialty_required'
  | 'team.email_already_used'
  | 'team.limit_reached'
  | 'invite.link_invalid';

/** Thrown by a store when the database refuses with one of the known codes. */
export class TeamError extends Error {
  constructor(readonly code: TeamErrorCode) {
    super(code);
  }
}

export interface NewInvitation {
  managerId: string;
  firstName: string;
  lastName: string;
  email: string;
  specialties: string[];
  /** SHA-256 of the token; the token itself never reaches the database. */
  tokenHash: Uint8Array;
  expiresAt: Date;
}

export interface TeamStore {
  invite(
    invitation: NewInvitation,
  ): Promise<{ memberId: string; salonName: string }>;
  /** Rejects with TeamError('invite.link_invalid') for unknown, used or expired links. */
  peek(
    tokenHash: Uint8Array,
  ): Promise<{ email: string; firstName: string; salonName: string }>;
  findUserId(email: string): Promise<string | null>;
  activate(tokenHash: Uint8Array, userId: string): Promise<{ email: string }>;
}

export interface AuthAdmin {
  createUser(email: string): Promise<string>;
  /** Sign-in link that opens `redirectTo` once consumed. */
  magicLink(email: string, redirectTo: string): Promise<string>;
}

export interface Mailer {
  sendInvitation(mail: {
    to: string;
    firstName: string;
    salonName: string;
    link: string;
  }): Promise<void>;
  sendMagicLink(mail: { to: string; link: string }): Promise<void>;
}
