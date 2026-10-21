export type PhoneResult =
  | { ok: true; e164: string }
  | { ok: false; code: 'auth.invalid_phone' | 'auth.phone_not_supported' };

// French mobile numbers only (PRD §6): +33 then 6 or 7, then 8 digits.
const FRENCH_MOBILE = /^\+33[67]\d{8}$/;

/**
 * Normalises user input to E.164. Accepts "06 12 34 56 78", "+33 6 12…",
 * "0033 6 12…", "33612345678" (Auth's own format) and "612345678".
 */
export function normalizeFrenchMobile(input: string): PhoneResult {
  const compact = input.replace(/[\s.\-()]/g, '');
  if (!/^\+?\d+$/.test(compact)) return invalid();

  let national: string;
  if (compact.startsWith('+')) {
    if (!compact.startsWith('+33')) return notSupported();
    national = compact.slice(3);
  } else if (compact.startsWith('00')) {
    if (!compact.startsWith('0033')) return notSupported();
    national = compact.slice(4);
  } else if (compact.startsWith('33') && compact.length === 11) {
    national = compact.slice(2);
  } else if (compact.startsWith('0')) {
    national = compact.slice(1);
  } else {
    national = compact;
  }

  const e164 = `+33${national}`;
  return FRENCH_MOBILE.test(e164) ? { ok: true, e164 } : invalid();
}

function invalid(): PhoneResult {
  return { ok: false, code: 'auth.invalid_phone' };
}

function notSupported(): PhoneResult {
  return { ok: false, code: 'auth.phone_not_supported' };
}
