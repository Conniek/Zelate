import { activateInvitation } from '../../../packages/team-invite/src/index.ts';
import { json, preflight } from '../_shared/http.ts';
import { authAdmin, mailer, proAppUrl, teamStore } from '../_shared/team.ts';

// Public on purpose: the single-use token in the body is the credential.
Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const body = await request.json().catch(() => null);
  const token = typeof body?.token === 'string' ? body.token : '';
  if (token.length < 20 || token.length > 100) {
    return json(410, {
      ok: false,
      error: {
        code: 'invite.link_invalid',
        messageKey: 'pro-stylist.invite.link_invalid',
      },
    });
  }
  try {
    const response = await activateInvitation(
      {
        store: teamStore(),
        auth: authAdmin(),
        mailer: mailer(),
        signedInUrl: `${proAppUrl()}/stylist/queue`,
      },
      token,
    );
    return json(response.status, response.body);
  } catch (error) {
    console.error(
      'activate-invitation failed:',
      error instanceof Error ? error.message : 'unknown',
    );
    return json(500, {
      ok: false,
      error: {
        code: 'generic.unexpected',
        messageKey: 'errors.generic.unexpected',
      },
    });
  }
});
