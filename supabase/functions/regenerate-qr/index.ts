import { regenerateQr } from '../../../packages/qr-poster/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { posterRenderer } from '../_shared/poster.ts';
import { clientAppUrl, posterStorage, qrStore } from '../_shared/qr.ts';
import { callerId } from '../_shared/siret.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const userId = await callerId(request);
  if (!userId) {
    return json(401, {
      ok: false,
      error: { code: 'queue.forbidden', messageKey: 'errors.queue.forbidden' },
    });
  }
  const body = await request.json().catch(() => null);
  // Without a body the call only (re)builds the poster for the current token.
  const rotate = body?.rotate === true;
  const response = await regenerateQr(
    {
      store: qrStore(),
      renderer: posterRenderer(),
      storage: posterStorage(),
      clientAppUrl: clientAppUrl(),
    },
    userId,
    rotate,
  );
  return json(response.status, response.body);
});
