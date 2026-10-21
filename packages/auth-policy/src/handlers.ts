import {
  BUCKET_SMS_IP,
  BUCKET_SMS_PHONE,
  BUCKET_VERIFY_FAILURES,
  OTP_CODES_PER_IP,
  OTP_CODES_PER_PHONE,
  OTP_VERIFY_FAILURES,
  OTP_VERIFY_WINDOW_SECONDS,
  OTP_WINDOW_SECONDS,
} from './limits.ts';
import { normalizeFrenchMobile } from './phone.ts';
import type { AuthGateway, RateLimiter, SmsProvider } from './ports.ts';
import { otpSmsText } from './sms-text.ts';

export type AuthErrorCode =
  | 'auth.invalid_phone'
  | 'auth.phone_not_supported'
  | 'auth.otp_rate_limited'
  | 'auth.invalid_code'
  | 'auth.too_many_attempts'
  | 'generic.unexpected';

export type AuthResponse<T> =
  | { status: 200; body: { ok: true; data: T } }
  | {
      status: 400 | 429 | 500;
      body: { ok: false; error: { code: AuthErrorCode; messageKey: string } };
    };

const STATUS: Record<AuthErrorCode, 400 | 429 | 500> = {
  'auth.invalid_phone': 400,
  'auth.phone_not_supported': 400,
  'auth.invalid_code': 400,
  'auth.otp_rate_limited': 429,
  'auth.too_many_attempts': 429,
  'generic.unexpected': 500,
};

function failure(code: AuthErrorCode): AuthResponse<never> {
  return {
    status: STATUS[code],
    body: { ok: false, error: { code, messageKey: `errors.${code}` } },
  };
}

function success<T>(data: T): AuthResponse<T> {
  return { status: 200, body: { ok: true, data } };
}

export interface SendCodeDeps {
  limits: RateLimiter;
  auth: AuthGateway;
}

/** `auth-send-sms` (public): validates, applies the IP and phone caps, asks Auth for a code. */
export async function sendCode(
  deps: SendCodeDeps,
  input: { phone: string; ip: string },
): Promise<AuthResponse<{ sent: true }>> {
  const phone = normalizeFrenchMobile(input.phone);
  if (!phone.ok) return failure(phone.code);

  const ipAllowed = await deps.limits.consume(
    BUCKET_SMS_IP,
    input.ip,
    OTP_CODES_PER_IP,
    OTP_WINDOW_SECONDS,
  );
  if (!ipAllowed) return failure('auth.otp_rate_limited');

  // Read-only here: the hook counts the codes actually sent.
  const phoneLimited = await deps.limits.isLimited(
    BUCKET_SMS_PHONE,
    phone.e164,
    OTP_CODES_PER_PHONE,
    OTP_WINDOW_SECONDS,
  );
  if (phoneLimited) return failure('auth.otp_rate_limited');

  const result = await deps.auth.signInWithOtp(phone.e164);
  if (result.ok) return success({ sent: true });
  return failure(
    result.reason === 'rate_limited'
      ? 'auth.otp_rate_limited'
      : 'generic.unexpected',
  );
}

export interface SendHookDeps {
  limits: RateLimiter;
  sms: SmsProvider;
}

export type HookResponse =
  | { status: 200; body: Record<string, never> }
  | {
      status: 429 | 500;
      body: { error: { http_code: 429 | 500; message: string } };
    };

/** Send SMS Hook: the authoritative per-phone cap, then the provider call. */
export async function sendSmsHook(
  deps: SendHookDeps,
  payload: { user?: { phone?: string }; sms?: { otp?: string } },
): Promise<HookResponse> {
  const rawPhone = payload.user?.phone;
  const otp = payload.sms?.otp;
  // Auth sends the number without "+".
  const phone = normalizeFrenchMobile(rawPhone ?? '');
  if (!phone.ok || !otp || !/^\d{6}$/.test(otp)) {
    return hookError(500, 'generic.unexpected');
  }

  const allowed = await deps.limits.consume(
    BUCKET_SMS_PHONE,
    phone.e164,
    OTP_CODES_PER_PHONE,
    OTP_WINDOW_SECONDS,
  );
  if (!allowed) return hookError(429, 'auth.otp_rate_limited');

  try {
    await deps.sms.send(phone.e164, otpSmsText(otp));
  } catch {
    return hookError(500, 'generic.unexpected');
  }
  return { status: 200, body: {} };
}

function hookError(status: 429 | 500, message: string): HookResponse {
  return { status, body: { error: { http_code: status, message } } };
}

export interface VerifyDeps {
  limits: RateLimiter;
  auth: AuthGateway;
}

/** `auth-verify-otp` (public): 3 wrong codes block the number for 5 min (U-03 scenario 8). */
export async function verifyCode(
  deps: VerifyDeps,
  input: { phone: string; code: string },
): Promise<AuthResponse<{ session: unknown }>> {
  const phone = normalizeFrenchMobile(input.phone);
  if (!phone.ok) return failure(phone.code);
  if (!/^\d{6}$/.test(input.code)) return failure('auth.invalid_code');

  const blocked = await deps.limits.isLimited(
    BUCKET_VERIFY_FAILURES,
    phone.e164,
    OTP_VERIFY_FAILURES,
    OTP_VERIFY_WINDOW_SECONDS,
  );
  if (blocked) return failure('auth.too_many_attempts');

  const result = await deps.auth.verifyOtp(phone.e164, input.code);
  if (result.ok) return success({ session: result.session });
  if (result.reason === 'failed') return failure('generic.unexpected');

  await deps.limits.consume(
    BUCKET_VERIFY_FAILURES,
    phone.e164,
    OTP_VERIFY_FAILURES,
    OTP_VERIFY_WINDOW_SECONDS,
  );
  const nowBlocked = await deps.limits.isLimited(
    BUCKET_VERIFY_FAILURES,
    phone.e164,
    OTP_VERIFY_FAILURES,
    OTP_VERIFY_WINDOW_SECONDS,
  );
  return failure(nowBlocked ? 'auth.too_many_attempts' : 'auth.invalid_code');
}
