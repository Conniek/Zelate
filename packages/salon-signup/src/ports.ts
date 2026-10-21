/** One établissement as returned by Recherche d'entreprises. */
export interface Establishment {
  siret: string;
  /** "A" active, "F" closed. */
  administrativeState: string;
  /** NAF code with the dot, e.g. "96.02A". */
  naf: string;
  addressLine: string;
  postalCode: string;
  city: string;
  cityCode: string;
  longitude: number | null;
  latitude: number | null;
}

export interface SiretLookup {
  /** null when the SIRET is unknown; rejects when the service is unavailable. */
  find(siret: string): Promise<Establishment | null>;
}

export type SiretCheckResult =
  'valid' | 'naf_mismatch' | 'inactive' | 'not_found' | 'error';

export interface SubmitSalon {
  userId: string;
  firstName: string;
  lastName: string;
  salonName: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  cityCode: string;
  longitude: number;
  latitude: number;
  siret: string;
  nafCode: string;
  siretCheckResult: SiretCheckResult;
  siretCheckPayload: Record<string, unknown>;
  isHairdressing: boolean;
}

export interface SignupStore {
  /** Calls submit_salon_signup; idempotent per manager. Returns the salon id. */
  submit(salon: SubmitSalon): Promise<string>;
}
