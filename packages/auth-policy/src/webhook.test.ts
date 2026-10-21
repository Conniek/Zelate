import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyWebhook } from './webhook.ts';

const keyBytes = Buffer.from('super-secret-key-for-tests');
const secret = `v1,whsec_${keyBytes.toString('base64')}`;
const NOW = 1_800_000_000_000;
const body = '{"user":{"phone":"33612345678"},"sms":{"otp":"123456"}}';

function sign(id: string, timestamp: string, payload: string): string {
  const digest = createHmac('sha256', keyBytes)
    .update(`${id}.${timestamp}.${payload}`)
    .digest('base64');
  return `v1,${digest}`;
}

const timestamp = String(NOW / 1000);

describe('verifyWebhook', () => {
  it('accepts a valid signature, also among several', async () => {
    const good = sign('msg_1', timestamp, body);
    expect(
      await verifyWebhook(
        secret,
        { id: 'msg_1', timestamp, signature: good },
        body,
        NOW,
      ),
    ).toBe(true);
    expect(
      await verifyWebhook(
        secret,
        { id: 'msg_1', timestamp, signature: `v1,AAAA ${good}` },
        body,
        NOW,
      ),
    ).toBe(true);
  });

  it('rejects a tampered body, a wrong secret and malformed headers', async () => {
    const good = sign('msg_1', timestamp, body);
    const headers = { id: 'msg_1', timestamp, signature: good };
    expect(await verifyWebhook(secret, headers, `${body} `, NOW)).toBe(false);
    expect(
      await verifyWebhook(
        `v1,whsec_${Buffer.from('other').toString('base64')}`,
        headers,
        body,
        NOW,
      ),
    ).toBe(false);
    expect(
      await verifyWebhook(secret, { ...headers, signature: null }, body, NOW),
    ).toBe(false);
    expect(
      await verifyWebhook(
        secret,
        { ...headers, signature: 'v2,AAAA' },
        body,
        NOW,
      ),
    ).toBe(false);
    expect(
      await verifyWebhook(
        secret,
        { ...headers, signature: 'v1,%%%' },
        body,
        NOW,
      ),
    ).toBe(false);
    expect(
      await verifyWebhook(
        secret,
        { ...headers, signature: 'v1,AAAA' },
        body,
        NOW,
      ),
    ).toBe(false);
    expect(
      await verifyWebhook(secret, { ...headers, id: null }, body, NOW),
    ).toBe(false);
    expect(
      await verifyWebhook(secret, { ...headers, timestamp: 'x' }, body, NOW),
    ).toBe(false);
  });

  it('rejects a timestamp outside the 5 minute tolerance', async () => {
    const old = String(NOW / 1000 - 301);
    expect(
      await verifyWebhook(
        secret,
        { id: 'msg_1', timestamp: old, signature: sign('msg_1', old, body) },
        body,
        NOW,
      ),
    ).toBe(false);
  });
});
