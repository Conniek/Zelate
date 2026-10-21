// Every queue command (TRD §6.2). Rules live in packages/queue-engine, the
// orchestration in packages/queue-service; this file only speaks HTTP.
import { handleQueueCommand } from '../../../packages/queue-service/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { queueServiceDeps } from '../_shared/queue-transaction/index.ts';
import { callerId } from '../_shared/siret.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const body = await request.json().catch(() => null);
  try {
    // No session is fine: commands sent with the tracking link (ADR-006).
    const profileId = await callerId(request);
    const response = await handleQueueCommand(
      queueServiceDeps(),
      { profileId },
      body,
    );
    return json(response.status, response.body);
  } catch {
    // Never log the body: it may hold a phone number or a tracking token.
    return json(500, {
      ok: false,
      error: {
        code: 'generic.unexpected',
        messageKey: 'errors.generic.unexpected',
      },
    });
  }
});
