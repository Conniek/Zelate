import type { SignupStore, SiretLookup, SubmitSalon } from './ports.ts';
import { checkSiret, isValidSiretFormat, normalizeSiret } from './siret.ts';

export interface SignupInput {
  firstName: string;
  lastName?: string;
  salonName: string;
  phone: string;
  addressLine: string;
  postalCode: string;
  city: string;
  cityCode?: string;
  longitude: number;
  latitude: number;
  siret: string;
  isHairdressing: boolean;
}

export type SignupErrorCode =
  | 'validation.required'
  | 'validation.siret_format'
  | 'validation.phone_format'
  | 'validation.postal_code_format'
  | 'validation.address_not_selected'
  | 'generic.unexpected';

export type SignupResponse =
  | {
      status: 200;
      body: { ok: true; data: { salonId: string; siretCheck: string } };
    }
  | {
      status: 400 | 500;
      body: {
        ok: false;
        error: { code: SignupErrorCode; field?: string; messageKey: string };
      };
    };

function failure(
  code: SignupErrorCode,
  field?: string,
  status: 400 | 500 = 400,
): SignupResponse {
  return {
    status,
    body: {
      ok: false,
      error: {
        code,
        ...(field ? { field } : {}),
        messageKey: `errors.${code}`,
      },
    },
  };
}

const PHONE = /^\+33[1-9]\d{8}$/;
const POSTAL = /^\d{5}$/;

export interface SignupDeps {
  lookup: SiretLookup;
  store: SignupStore;
}

/**
 * `salon-signup` (authenticated): validates the form, checks the SIRET and creates
 * the salon "pending_review". A SIRET that is unknown, closed, not in hairdressing
 * or unverifiable does not block the file (PRD E14; the `error` case is an open question).
 */
export async function salonSignup(
  deps: SignupDeps,
  userId: string,
  input: SignupInput,
): Promise<SignupResponse> {
  const firstName = input.firstName.trim();
  const salonName = input.salonName.trim();
  const addressLine = input.addressLine.trim();
  const city = input.city.trim();
  if (firstName.length < 1 || firstName.length > 30) {
    return failure('validation.required', 'firstName');
  }
  if (salonName.length < 2 || salonName.length > 80) {
    return failure('validation.required', 'salonName');
  }
  if (!PHONE.test(input.phone)) {
    return failure('validation.phone_format', 'phone');
  }
  if (!addressLine || !city) return failure('validation.required', 'address');
  if (!POSTAL.test(input.postalCode)) {
    return failure('validation.postal_code_format', 'postalCode');
  }
  if (
    !Number.isFinite(input.longitude) ||
    !Number.isFinite(input.latitude) ||
    Math.abs(input.longitude) > 180 ||
    Math.abs(input.latitude) > 90
  ) {
    return failure('validation.address_not_selected', 'address');
  }
  const siret = normalizeSiret(input.siret);
  if (!isValidSiretFormat(siret)) {
    return failure('validation.siret_format', 'siret');
  }

  const check = await checkSiret(deps.lookup, siret);
  const salon: SubmitSalon = {
    userId,
    firstName,
    lastName: (input.lastName ?? '').trim(),
    salonName,
    phone: input.phone,
    addressLine,
    postalCode: input.postalCode,
    city,
    cityCode: input.cityCode ?? check.establishment?.cityCode ?? '',
    longitude: input.longitude,
    latitude: input.latitude,
    siret,
    nafCode: check.establishment?.naf ?? '',
    siretCheckResult: check.result,
    siretCheckPayload: check.establishment ? { ...check.establishment } : {},
    isHairdressing: input.isHairdressing,
  };

  try {
    const salonId = await deps.store.submit(salon);
    return {
      status: 200,
      body: { ok: true, data: { salonId, siretCheck: check.result } },
    };
  } catch {
    return failure('generic.unexpected', undefined, 500);
  }
}
