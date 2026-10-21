// Dashboard: the new time of a reassigned client, without writing (S-13, K2).
import { previewReassignment } from '../../../packages/queue-service/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { queueServiceDeps } from '../_shared/queue-transaction/index.ts';
import { callerId } from '../_shared/siret.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });
  const body = await request.json().catch(() => null);
  try {
    const response = await previewReassignment(
      queueServiceDeps(),
      { profileId: await callerId(request) },
      body,
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
