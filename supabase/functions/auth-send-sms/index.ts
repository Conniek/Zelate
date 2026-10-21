import {
  sendCode,
  type AuthResponse,
} from '../../../packages/auth-policy/src/index.ts';
import {
  authGateway,
  clientIp,
  json,
  preflight,
  rateLimiter,
} from '../_shared/http.ts';

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'POST') return json(405, { ok: false });

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === 'string' ? body.phone : '';

  let response: AuthResponse<{ sent: true }>;
  try {
    response = await sendCode(
      { limits: rateLimiter(), auth: authGateway() },
      { phone, ip: clientIp(request) },
    );
  } catch {
    // Never log the phone number or the code (TRD §6.1).
    return json(500, {
      ok: false,
      error: {
        code: 'generic.unexpected',
        messageKey: 'errors.generic.unexpected',
      },
    });
  }
  return json(response.status, response.body);
});
