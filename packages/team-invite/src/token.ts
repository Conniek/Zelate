const INVITATION_TTL_MS = 72 * 60 * 60 * 1000;

export function invitationExpiry(now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_MS);
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** 32 random bytes, URL-safe. */
export function generateToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return new Uint8Array(digest);
}

/** PostgREST writes bytea as a "\x…" hex string. */
export function toByteaHex(bytes: Uint8Array): string {
  return `\\x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
}
