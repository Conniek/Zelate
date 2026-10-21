import {
  checkSiret,
  isValidSiretFormat,
  normalizeSiret,
} from '../../../packages/salon-signup/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { callerId, rechercheEntreprises } from '../_shared/siret.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });
  if (!(await callerId(request))) return json(401, { ok: false });

  const body = await request.json().catch(() => null);
  const siret = normalizeSiret(
    typeof body?.siret === 'string' ? body.siret : '',
  );
  if (!isValidSiretFormat(siret)) {
    return json(400, {
      ok: false,
      error: {
        code: 'validation.siret_format',
        messageKey: 'errors.validation.siret_format',
      },
    });
  }
  const { result, establishment } = await checkSiret(
    rechercheEntreprises(),
    siret,
  );
  return json(200, { ok: true, data: { result, establishment } });
});
