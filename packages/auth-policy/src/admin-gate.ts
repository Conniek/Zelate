export type AdminAccess = 'none' | 'mfa_required' | 'granted';

export type AdminGateInput = {
  signedIn: boolean;
  /** Answer of public.admin_access(); ignored when signed out. */
  access: AdminAccess;
  /** Whether the user already enrolled a verified second factor. */
  hasVerifiedFactor: boolean;
};

export type AdminGate =
  | { action: 'allow' }
  | { action: 'redirect_signin' }
  | { action: 'enroll_mfa' }
  | { action: 'verify_mfa' }
  | { action: 'forbidden' };

/**
 * Decides what the `/admin` route shows (APP_FLOW §2: e-mail, password and
 * MFA). The database enforces the same rule; this only picks the screen.
 */
export function adminGate(input: AdminGateInput): AdminGate {
  if (!input.signedIn) return { action: 'redirect_signin' };
  if (input.access === 'none') return { action: 'forbidden' };
  if (input.access === 'granted') return { action: 'allow' };
  return { action: input.hasVerifiedFactor ? 'verify_mfa' : 'enroll_mfa' };
}
