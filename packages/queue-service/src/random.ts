/**
 * Randomness and hashing kept outside the engine (the engine never draws
 * random values). Uses Web Crypto only, so it runs in Node and Deno.
 */

export interface Random {
  uuid(): string;
  /** Ticket code given to the stylist: 5 characters, no 0/O/1/I (H7). */
  shortCode(): string;
  /** `tracking_token`: 32 random bytes in base64url (ADR-006). */
  trackingToken(): string;
  /** `tracking_short_code`: 8 characters for the SMS link `/t/xxxxxxxx` (K5). */
  trackingShortCode(): string;
}

export interface PhoneHasher {
  /** `ticket_contacts.phone_hash`: HMAC-SHA256 of the E.164 number (BACKEND_SCHEMA §5). */
  hash(e164: string): Promise<Uint8Array>;
}

const TICKET_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LINK_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Uniform pick by rejection sampling, so no character is favoured. */
function pick(alphabet: string, length: number): string {
  const limit = 256 - (256 % alphabet.length);
  let out = '';
  while (out.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
    for (const byte of bytes) {
      if (byte < limit && out.length < length) {
        out += alphabet[byte % alphabet.length];
      }
    }
  }
  return out;
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export const cryptoRandom: Random = {
  uuid: () => crypto.randomUUID(),
  shortCode: () => pick(TICKET_CODE_ALPHABET, 5),
  trackingToken: () => base64url(crypto.getRandomValues(new Uint8Array(32))),
  trackingShortCode: () => pick(LINK_ALPHABET, 8),
};

export function hmacPhoneHasher(secret: string): PhoneHasher {
  // The example value of .env.example is long enough: refuse it explicitly.
  if (secret.length < 32 || secret.startsWith('REPLACE_ME')) {
    throw new Error(
      'PHONE_HASH_SECRET must be a real secret of 32 characters or more',
    );
  }
  const key = crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return {
    async hash(e164) {
      const signature = await crypto.subtle.sign(
        'HMAC',
        await key,
        new TextEncoder().encode(e164),
      );
      return new Uint8Array(signature);
    },
  };
}
