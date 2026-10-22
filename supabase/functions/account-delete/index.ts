// « Supprimer mon compte » (U-13, K17, K29): the active place is cancelled
// through the queue transaction (K38), then the account is deleted and the
// past tickets anonymised in one SQL transaction (`account_delete`).
import { handleQueueCommand } from '../../../packages/queue-service/src/index.ts';
import { json, preflight, serviceClient } from '../_shared/http.ts';
import { queueServiceDeps } from '../_shared/queue-transaction/index.ts';
import { callerId } from '../_shared/siret.ts';

const FAILED = {
  ok: false,
  error: {
    code: 'account.delete_failed',
    messageKey: 'errors.account.delete_failed',
  },
};
const ACTIVE = ['pending_confirmation', 'waiting', 'called', 'in_service'];

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });
  const profileId = await callerId(request);
  if (!profileId) {
    return json(401, {
      ok: false,
      error: { code: 'queue.forbidden', messageKey: 'errors.queue.forbidden' },
    });
  }
  try {
    const db = serviceClient();
    // Refused before anything changes: a Pro account keeps its place too.
    const { data: check, error: checkError } = await db.rpc('account_delete', {
      p_profile_id: profileId,
      p_check_only: true,
    });
    if (checkError || check === 'staff') return json(409, FAILED);
    const { data: active, error: readError } = await db
      .from('tickets')
      .select('id')
      .eq('client_id', profileId)
      .eq('is_test', false)
      .in('status', ACTIVE)
      .maybeSingle();
    if (readError) return json(500, FAILED);
    if (active) {
      // The salon sees the place cancelled by the client and the queue moves on.
      const cancelled = await handleQueueCommand(
        queueServiceDeps(),
        { profileId },
        {
          command: 'cancel_ticket',
          command_id: crypto.randomUUID(),
          payload: { ticket_id: active.id },
        },
      );
      if (cancelled.status !== 200) return json(409, FAILED);
    }
    const { data, error } = await db.rpc('account_delete', {
      p_profile_id: profileId,
    });
    if (error || data !== 'deleted') return json(409, FAILED);
    return json(200, { ok: true, data: {} });
  } catch {
    return json(500, FAILED);
  }
});
