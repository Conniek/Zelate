import { inviteMember } from '../../../packages/team-invite/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { callerId } from '../_shared/siret.ts';
import { mailer, proAppUrl, teamStore } from '../_shared/team.ts';

const unexpected = {
  ok: false,
  error: {
    code: 'generic.unexpected',
    messageKey: 'errors.generic.unexpected',
  },
};

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const userId = await callerId(request);
  if (!userId) {
    return json(401, {
      ok: false,
      error: {
        code: 'queue.forbidden',
        messageKey: 'errors.queue.forbidden',
      },
    });
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return json(400, {
      ok: false,
      error: {
        code: 'queue.invalid_payload',
        messageKey: 'errors.queue.invalid_payload',
      },
    });
  }
  try {
    const response = await inviteMember(
      { store: teamStore(), mailer: mailer(), appUrl: proAppUrl() },
      userId,
      {
        firstName: String(body.firstName ?? ''),
        lastName: String(body.lastName ?? ''),
        email: String(body.email ?? ''),
        specialties: Array.isArray(body.specialties)
          ? body.specialties.map(String)
          : [],
      },
    );
    return json(response.status, response.body);
  } catch (error) {
    console.error(
      'invite-member failed:',
      error instanceof Error ? error.message : 'unknown',
    );
    return json(500, unexpected);
  }
});
