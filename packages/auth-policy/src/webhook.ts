// Standard Webhooks signature check for the Auth hook (HMAC-SHA256).
const TOLERANCE_SECONDS = 300;

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export async function verifyWebhook(
  secret: string,
  headers: WebhookHeaders,
  body: string,
  nowMs: number,
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(nowMs / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secret.replace(/^v1,whsec_/, '').replace(/^whsec_/, '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signed = new TextEncoder().encode(`${id}.${timestamp}.${body}`);
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, signed),
  );

  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const received = tryBase64ToBytes(value);
    return received !== null && timingSafeEqual(received, expected);
  });
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function tryBase64ToBytes(value: string): Uint8Array | null {
  try {
    return base64ToBytes(value);
  } catch {
    return null;
  }
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
