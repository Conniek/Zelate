export interface RateLimiter {
  /** Counts one use; false when the limit is already reached (nothing counted). */
  consume(
    bucket: string,
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean>;
  isLimited(
    bucket: string,
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean>;
}

export interface SmsProvider {
  send(to: string, text: string): Promise<void>;
}

export type SignInResult =
  { ok: true } | { ok: false; reason: 'rate_limited' | 'failed' };

export type VerifyResult =
  | { ok: true; session: unknown }
  | { ok: false; reason: 'invalid_code' | 'failed' };

export interface AuthGateway {
  /** Asks Supabase Auth to create and send a code (which calls the send hook). */
  signInWithOtp(phone: string): Promise<SignInResult>;
  verifyOtp(phone: string, token: string): Promise<VerifyResult>;
}
