import type { Establishment, SiretCheckResult, SiretLookup } from './ports.ts';

const SIRET_FORMAT = /^\d{14}$/;
const HAIRDRESSING_NAF = new Set(['96.02A', '96.02B']);

/** Strips the spaces people type or paste ("123 456 789 01234"). */
export function normalizeSiret(raw: string): string {
  return raw.replace(/[\s\u00a0]/g, '');
}

export function isValidSiretFormat(siret: string): boolean {
  return SIRET_FORMAT.test(siret);
}

export interface SiretCheck {
  result: SiretCheckResult;
  establishment: Establishment | null;
}

/** Scenarios 3 to 5 of S-01. Anything but "valid" sends the file "à vérifier". */
export async function checkSiret(
  lookup: SiretLookup,
  siret: string,
): Promise<SiretCheck> {
  let establishment: Establishment | null;
  try {
    establishment = await lookup.find(siret);
  } catch {
    return { result: 'error', establishment: null };
  }
  if (!establishment) return { result: 'not_found', establishment: null };
  if (establishment.administrativeState !== 'A') {
    return { result: 'inactive', establishment };
  }
  return {
    result: HAIRDRESSING_NAF.has(establishment.naf) ? 'valid' : 'naf_mismatch',
    establishment,
  };
}
