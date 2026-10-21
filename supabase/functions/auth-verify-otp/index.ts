import { verifyCode } from '../../../packages/auth-policy/src/index.ts';
import { authGateway, json, preflight, rateLimiter } from '../_shared/http.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  const code = typeof body?.code === 'string' ? body.code : '';

  try {
    const response = await verifyCode(
      { limits: rateLimiter(), auth: authGateway() },
      { phone, code },
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
