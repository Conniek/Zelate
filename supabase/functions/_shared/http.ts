import { createClient } from 'npm:@supabase/supabase-js@2';
import type {
  AuthGateway,
  RateLimiter,
  SmsProvider,
} from '../../../packages/auth-policy/src/index.ts';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });
}

export function preflight(request: Request): Response | null {
  return request.method === 'OPTIONS'
    ? new Response(null, { status: 204, headers: CORS })
    : null;
}

// The address set by the platform's edge comes first: the first entry of
// x-forwarded-for can be chosen by the caller, which would defeat per-IP caps.
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (
    request.headers.get('cf-connecting-ip') ||
    forwarded?.split(',').at(-1)?.trim() ||
    'unknown'
  );
}

export function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

export function rateLimiter(): RateLimiter {
  const db = serviceClient();
  const args = (
    bucket: string,
    key: string,
    limit: number,
    windowSeconds: number,
  ) => ({
    p_bucket: bucket,
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  return {
    async consume(bucket, key, limit, windowSeconds) {
      const { data, error } = await db.rpc(
        'consume_rate_limit',
        args(bucket, key, limit, windowSeconds),
      );
      if (error) throw new Error('rate limiter unavailable');
      return data === true;
    },
    async isLimited(bucket, key, limit, windowSeconds) {
      const { data, error } = await db.rpc(
        'is_rate_limited',
        args(bucket, key, limit, windowSeconds),
      );
      if (error) throw new Error('rate limiter unavailable');
      return data === true;
    },
  };
}

export function authGateway(): AuthGateway {
  const anon = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { persistSession: false } },
  );
  return {
    async signInWithOtp(phone) {
      const { error } = await anon.auth.signInWithOtp({ phone });
      if (!error) return { ok: true };
      return {
        ok: false,
        reason: error.status === 429 ? 'rate_limited' : 'failed',
      };
    },
    async verifyOtp(phone, token) {
      const { data, error } = await anon.auth.verifyOtp({
        phone,
        token,
        type: 'sms',
      });
      if (!error && data.session) return { ok: true, session: data.session };
      const clientError = error?.status !== undefined && error.status < 500;
      return { ok: false, reason: clientError ? 'invalid_code' : 'failed' };
    },
  };
}

// The provider is still undecided (TRD §3: Brevo, OVHcloud or Twilio): until
// one is chosen, sending fails loudly instead of silently dropping the code.
export function smsProvider(): SmsProvider {
  return {
    send() {
      return Promise.reject(new Error('SMS provider not configured'));
    },
  };
}
