import { salonSignup } from '../../../packages/salon-signup/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import {
  callerId,
  rechercheEntreprises,
  signupStore,
} from '../_shared/siret.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const userId = await callerId(request);
  if (!userId) {
    return json(401, {
      ok: false,
      error: {
        code: 'auth.unauthenticated',
        messageKey: 'errors.generic.unexpected',
      },
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json(400, {
      ok: false,
      error: {
        code: 'validation.required',
        messageKey: 'errors.validation.required',
      },
    });
  }
  try {
    const response = await salonSignup(
      { lookup: rechercheEntreprises(), store: signupStore() },
      userId,
      {
        firstName: String(body.firstName ?? ''),
        lastName: String(body.lastName ?? ''),
        salonName: String(body.salonName ?? ''),
        phone: String(body.phone ?? ''),
        addressLine: String(body.addressLine ?? ''),
        postalCode: String(body.postalCode ?? ''),
        city: String(body.city ?? ''),
        cityCode: String(body.cityCode ?? ''),
        longitude: Number(body.longitude),
        latitude: Number(body.latitude),
        siret: String(body.siret ?? ''),
        isHairdressing: body.isHairdressing === true,
      },
    );
    return json(response.status, response.body);
  } catch {
    return json(500, {
      ok: false,
      error: {
        code: 'generic.unexpected',
        messageKey: 'errors.generic.unexpected',
      },
    });
  }
});
