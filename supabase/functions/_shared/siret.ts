import type {
  Establishment,
  SiretLookup,
  SignupStore,
} from '../../../packages/salon-signup/src/index.ts';
import { serviceClient } from './http.ts';

/** Recherche d'entreprises (data.gouv.fr): free, no key. */
export function rechercheEntreprises(): SiretLookup {
  return {
    async find(siret) {
      const response = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${siret}&per_page=1`,
        { signal: AbortSignal.timeout(5000) },
      );
      if (!response.ok) throw new Error(`lookup failed: ${response.status}`);
      const body = await response.json();
      const company = body?.results?.[0];
      const match = [
        company?.siege,
        ...(company?.matching_etablissements ?? []),
      ].find((e) => e?.siret === siret);
      if (!match) return null;
      const establishment: Establishment = {
        siret,
        administrativeState: String(match.etat_administratif ?? ''),
        naf: String(match.activite_principale ?? ''),
        addressLine: String(match.adresse ?? ''),
        postalCode: String(match.code_postal ?? ''),
        city: String(match.libelle_commune ?? ''),
        cityCode: String(match.commune ?? ''),
        longitude: match.longitude ? Number(match.longitude) : null,
        latitude: match.latitude ? Number(match.latitude) : null,
      };
      return establishment;
    },
  };
}

export function signupStore(): SignupStore {
  const db = serviceClient();
  return {
    async submit(s) {
      const { data, error } = await db.rpc('submit_salon_signup', {
        p_user_id: s.userId,
        p_first_name: s.firstName,
        p_last_name: s.lastName,
        p_salon_name: s.salonName,
        p_phone: s.phone,
        p_address_line: s.addressLine,
        p_postal_code: s.postalCode,
        p_city: s.city,
        p_city_code: s.cityCode,
        p_longitude: s.longitude,
        p_latitude: s.latitude,
        p_siret: s.siret,
        p_naf_code: s.nafCode,
        p_siret_check_result: s.siretCheckResult,
        p_siret_check_payload: s.siretCheckPayload,
        p_is_hairdressing: s.isHairdressing,
      });
      if (error || typeof data !== 'string') throw new Error('submit failed');
      return data;
    },
  };
}

/** The user id of the caller, from the Authorization header, or null. */
export async function callerId(request: Request): Promise<string | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return null;
  const { data, error } = await serviceClient().auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}
