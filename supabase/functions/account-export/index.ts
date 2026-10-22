// « Télécharger mes données » (U-13, K17): the caller's own data as JSON.
import { json, preflight, serviceClient } from '../_shared/http.ts';
import { callerId } from '../_shared/siret.ts';

const UNEXPECTED = {
  ok: false,
  error: {
    code: 'generic.unexpected',
    messageKey: 'errors.generic.unexpected',
  },
};

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'GET') return json(405, { ok: false });
  const profileId = await callerId(request);
  if (!profileId) {
    return json(401, {
      ok: false,
      error: { code: 'queue.forbidden', messageKey: 'errors.queue.forbidden' },
    });
  }
  const { data, error } = await serviceClient().rpc('account_export', {
    p_profile_id: profileId,
  });
  // Never log the data: it holds the phone number.
  if (error || !data) return json(500, UNEXPECTED);
  return json(200, { ok: true, data });
});
