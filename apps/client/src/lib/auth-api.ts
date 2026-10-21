import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type AuthErrorKey =
  | 'auth.invalid_phone'
  | 'auth.phone_not_supported'
  | 'auth.invalid_code'
  | 'auth.otp_rate_limited'
  | 'auth.too_many_attempts'
  | 'generic.unexpected';

export type AuthResult = { ok: true } | { ok: false; errorKey: AuthErrorKey };

const KNOWN: readonly AuthErrorKey[] = [
  'auth.invalid_phone',
  'auth.phone_not_supported',
  'auth.invalid_code',
  'auth.otp_rate_limited',
  'auth.too_many_attempts',
  'generic.unexpected',
];

async function call(name: string, payload: object): Promise<unknown> {
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    body: JSON.stringify(payload),
    headers: {
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  return response.json().catch(() => null);
}

function errorKey(body: unknown): AuthErrorKey {
  const code = (body as { error?: { code?: string } } | null)?.error?.code;
  return KNOWN.find((known) => known === code) ?? 'generic.unexpected';
}

function e164(nationalDigits: string): string {
  return `+33${nationalDigits}`;
}

export async function requestCode(nationalDigits: string): Promise<AuthResult> {
  try {
    const body = await call('auth-send-sms', { phone: e164(nationalDigits) });
    if ((body as { ok?: boolean } | null)?.ok === true) return { ok: true };
    return { ok: false, errorKey: errorKey(body) };
  } catch {
    return { ok: false, errorKey: 'generic.unexpected' };
  }
}

export async function confirmCode(
  nationalDigits: string,
  code: string,
): Promise<AuthResult> {
  try {
    const body = await call('auth-verify-otp', {
      code,
      phone: e164(nationalDigits),
    });
    const session = (
      body as {
        data?: { session?: { access_token?: string; refresh_token?: string } };
        ok?: boolean;
      } | null
    )?.data?.session;
    if (!session?.access_token || !session.refresh_token) {
      return { ok: false, errorKey: errorKey(body) };
    }
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
    return error ? { ok: false, errorKey: 'generic.unexpected' } : { ok: true };
  } catch {
    return { ok: false, errorKey: 'generic.unexpected' };
  }
}

/** True when the signed-in user already has a profile (first name known). */
export async function hasProfile(): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function saveFirstName(firstName: string): Promise<boolean> {
  const { error } = await supabase.rpc('ensure_profile', {
    p_first_name: firstName.trim(),
  });
  return !error;
}
