import { describe, expect, it } from 'vitest';

// Needs `supabase start` and `supabase functions serve --env-file supabase/functions/.env`.
// Run with: E2E_SUPABASE_URL=... E2E_SUPABASE_ANON_KEY=... pnpm test:e2e
const url = process.env['E2E_SUPABASE_URL'];
const anonKey = process.env['E2E_SUPABASE_ANON_KEY'];
const TEST_PHONE = '+33639980078'; // config.toml [auth.sms.test_otp] → 123456
const TEST_CODE = '123456';

async function call(name: string, payload: object) {
  const response = await fetch(`${url}/functions/v1/${name}`, {
    body: JSON.stringify(payload),
    headers: { apikey: anonKey ?? '', 'Content-Type': 'application/json' },
    method: 'POST',
  });
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: (await response.json()) as any,
    status: response.status,
  };
}

describe.skipIf(!url || !anonKey)('U-03 / P-03 end to end', () => {
  it('a client receives a code and signs in (scenarios 1, 2)', async () => {
    const sent = await call('auth-send-sms', { phone: TEST_PHONE });
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ ok: true, data: { sent: true } });

    const verified = await call('auth-verify-otp', {
      code: TEST_CODE,
      phone: TEST_PHONE,
    });
    expect(verified.status).toBe(200);
    expect(verified.body.data.session.access_token).toEqual(expect.any(String));
  });

  it('refuses a malformed or non-mobile number (scenario 5)', async () => {
    const bad = await call('auth-send-sms', { phone: '+3361234' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('auth.invalid_phone');

    const landline = await call('auth-send-sms', { phone: '+33142000000' });
    expect(landline.status).toBe(400);
    expect(landline.body.error.code).toBe('auth.phone_not_supported');
  });

  it('blocks a phone after 3 wrong codes (P-03)', async () => {
    // Fixed 5-minute window: rerunning within 5 minutes starts already blocked.
    const phone = '+33639980079';
    const codes: string[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const wrong = await call('auth-verify-otp', { code: '000000', phone });
      codes.push(wrong.body.error.code);
    }
    expect(codes.slice(0, 2)).toEqual([
      'auth.invalid_code',
      'auth.invalid_code',
    ]);
    expect(codes[2]).toBe('auth.too_many_attempts');

    const next = await call('auth-verify-otp', { code: '000000', phone });
    expect(next.status).toBe(429);
  });
});
