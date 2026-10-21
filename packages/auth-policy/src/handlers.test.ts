import { describe, expect, it } from 'vitest';
import { sendCode, sendSmsHook, verifyCode } from './handlers.ts';
import { fakeAuth, memoryLimiter, recordingSms } from './testing.ts';

function setup(smsError?: Error) {
  const limits = memoryLimiter();
  const sms = recordingSms(smsError);
  const auth = fakeAuth({
    // Auth builds the hook payload (phone without "+") and relays its answer.
    onSignIn: async (phone) => {
      const answer = await sendSmsHook(
        { limits, sms },
        { user: { phone: phone.slice(1) }, sms: { otp: '123456' } },
      );
      if (answer.status === 200) return 'ok';
      return answer.status === 429 ? 'rate_limited' : 'failed';
    },
    validCode: '123456',
  });
  return { limits, sms, auth, deps: { limits, auth } };
}

const request = (phone: string, ip = '1.1.1.1') => ({ phone, ip });

describe('sendCode', () => {
  it('sends a code to a valid French mobile (scenario 1)', async () => {
    const { deps, sms } = setup();
    const result = await sendCode(deps, request('06 12 34 56 78'));
    expect(result).toEqual({
      status: 200,
      body: { ok: true, data: { sent: true } },
    });
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]?.to).toBe('+33612345678');
    expect(sms.sent[0]?.text).toContain('123456');
  });

  it('refuses an invalid number without sending (scenario 5)', async () => {
    const { deps, sms, limits } = setup();
    const result = await sendCode(deps, request('0612'));
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      ok: false,
      error: {
        code: 'auth.invalid_phone',
        messageKey: 'errors.auth.invalid_phone',
      },
    });
    expect(sms.sent).toHaveLength(0);
    expect(limits.counts.size).toBe(0);
  });

  it('refuses a non +33 number without sending (scenario 6)', async () => {
    const { deps, sms } = setup();
    const result = await sendCode(deps, request('+44 7911 123456'));
    expect(result.body).toMatchObject({
      ok: false,
      error: { code: 'auth.phone_not_supported' },
    });
    expect(sms.sent).toHaveLength(0);
  });

  it('sends the 5th code and refuses the 6th for a number (scenario 11)', async () => {
    const { deps, sms } = setup();
    for (let i = 0; i < 5; i += 1) {
      // A different IP each time, so only the phone cap can trigger.
      const ok = await sendCode(deps, request('0612345678', `10.0.0.${i}`));
      expect(ok.status).toBe(200);
    }
    expect(sms.sent).toHaveLength(5);

    const sixth = await sendCode(deps, request('0612345678', '10.0.0.9'));
    expect(sixth.status).toBe(429);
    expect(sixth.body).toMatchObject({
      ok: false,
      error: {
        code: 'auth.otp_rate_limited',
        messageKey: 'errors.auth.otp_rate_limited',
      },
    });
    expect(sms.sent).toHaveLength(5);
  });

  it('counts 4 codes then lets the 5th through (scenario 11, boundary)', async () => {
    const { deps, sms } = setup();
    for (let i = 0; i < 4; i += 1)
      await sendCode(deps, request('0612345678', `10.0.0.${i}`));
    const fifth = await sendCode(deps, request('0612345678', '10.0.0.8'));
    expect(fifth.status).toBe(200);
    expect(sms.sent).toHaveLength(5);
  });

  it('sends the 20th code and refuses the 21st per IP (scenario 11 bis)', async () => {
    const { deps, sms } = setup();
    for (let i = 0; i < 20; i += 1) {
      const phone = `06${String(10_000_000 + i)}`;
      expect((await sendCode(deps, request(phone))).status).toBe(200);
    }
    expect(sms.sent).toHaveLength(20);

    const result = await sendCode(deps, request('0699999999'));
    expect(result.status).toBe(429);
    expect(result.body).toMatchObject({
      error: { code: 'auth.otp_rate_limited' },
    });
    expect(sms.sent).toHaveLength(20);
  });

  it('keeps counters per IP', async () => {
    const { deps } = setup();
    for (let i = 0; i < 20; i += 1) {
      await sendCode(deps, request(`06${String(10_000_000 + i)}`, '2.2.2.2'));
    }
    const other = await sendCode(deps, request('0699999999', '3.3.3.3'));
    expect(other.status).toBe(200);
  });

  it('maps a provider failure to a generic error', async () => {
    const { deps } = setup(new Error('provider down'));
    const result = await sendCode(deps, request('0612345678'));
    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({
      error: { code: 'generic.unexpected' },
    });
  });
});

describe('sendSmsHook', () => {
  it('rejects a direct call above the phone cap, with no SMS (bypass of the public function)', async () => {
    const { limits, sms } = setup();
    const call = () =>
      sendSmsHook(
        { limits, sms },
        { user: { phone: '33612345678' }, sms: { otp: '123456' } },
      );
    for (let i = 0; i < 5; i += 1) expect((await call()).status).toBe(200);
    const sixth = await call();
    expect(sixth).toEqual({
      status: 429,
      body: { error: { http_code: 429, message: 'auth.otp_rate_limited' } },
    });
    expect(sms.sent).toHaveLength(5);
  });

  it('counts a code even when the provider fails', async () => {
    const { limits } = setup();
    const sms = recordingSms(new Error('down'));
    const answer = await sendSmsHook(
      { limits, sms },
      { user: { phone: '33612345678' }, sms: { otp: '123456' } },
    );
    expect(answer.status).toBe(500);
    expect(limits.counts.get('otp_sms_phone|+33612345678')).toBe(1);
  });

  it.each([
    [{}],
    [{ user: { phone: '33612345678' } }],
    [{ user: { phone: '447911123456' }, sms: { otp: '123456' } }],
    [{ user: { phone: '33612345678' }, sms: { otp: '12ab56' } }],
  ])('refuses a malformed payload %j', async (payload) => {
    const { limits, sms } = setup();
    const answer = await sendSmsHook({ limits, sms }, payload);
    expect(answer.status).toBe(500);
    expect(sms.sent).toHaveLength(0);
  });
});

describe('verifyCode', () => {
  const credentials = { phone: '0612345678' };

  it('signs in with the right code (scenario 2)', async () => {
    const { deps } = setup();
    const result = await verifyCode(deps, { ...credentials, code: '123456' });
    expect(result).toEqual({
      status: 200,
      body: { ok: true, data: { session: { access_token: 'jwt' } } },
    });
  });

  it('refuses a wrong code and stays signed out (scenario 7)', async () => {
    const { deps } = setup();
    const result = await verifyCode(deps, { ...credentials, code: '000000' });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: { code: 'auth.invalid_code' } });
  });

  it('refuses a malformed code without asking Auth', async () => {
    const { deps, auth } = setup();
    const result = await verifyCode(deps, { ...credentials, code: '12345' });
    expect(result.body).toMatchObject({ error: { code: 'auth.invalid_code' } });
    expect(auth.verifyCalls).toBe(0);
  });

  it('blocks after 3 wrong codes, even with the right one (scenario 8)', async () => {
    const { deps, auth } = setup();
    const first = await verifyCode(deps, { ...credentials, code: '000001' });
    const second = await verifyCode(deps, { ...credentials, code: '000002' });
    const third = await verifyCode(deps, { ...credentials, code: '000003' });
    expect(first.body).toMatchObject({ error: { code: 'auth.invalid_code' } });
    expect(second.body).toMatchObject({ error: { code: 'auth.invalid_code' } });
    expect(third.status).toBe(429);
    expect(third.body).toMatchObject({
      error: { code: 'auth.too_many_attempts' },
    });

    const good = await verifyCode(deps, { ...credentials, code: '123456' });
    expect(good.body).toMatchObject({
      error: { code: 'auth.too_many_attempts' },
    });
    expect(auth.verifyCalls).toBe(3);
  });

  it('tolerates 2 wrong codes then accepts the right one', async () => {
    const { deps } = setup();
    await verifyCode(deps, { ...credentials, code: '000001' });
    await verifyCode(deps, { ...credentials, code: '000002' });
    const good = await verifyCode(deps, { ...credentials, code: '123456' });
    expect(good.status).toBe(200);
  });

  it('refuses an invalid phone and maps Auth failures to a generic error', async () => {
    const { deps } = setup();
    const bad = await verifyCode(deps, {
      phone: '+44 7911 123456',
      code: '123456',
    });
    expect(bad.body).toMatchObject({
      error: { code: 'auth.phone_not_supported' },
    });

    const failing = {
      limits: memoryLimiter(),
      auth: fakeAuth({ verifyFails: true }),
    };
    const result = await verifyCode(failing, {
      ...credentials,
      code: '123456',
    });
    expect(result.status).toBe(500);
    expect(failing.limits.counts.size).toBe(0);
  });
});
