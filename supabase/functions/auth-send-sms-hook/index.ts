import {
  sendSmsHook,
  verifyWebhook,
} from '../../../packages/auth-policy/src/index.ts';
import { json, rateLimiter, smsProvider } from '../_shared/http.ts';

// Send SMS Hook called by Supabase Auth (TRD ADR-005). Not a public endpoint:
// every call must carry a valid Standard Webhooks signature.
Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, {});

  const raw = await request.text();
  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '';
  const valid =
    secret !== '' &&
    (await verifyWebhook(
      secret,
      {
        id: request.headers.get('webhook-id'),
        timestamp: request.headers.get('webhook-timestamp'),
        signature: request.headers.get('webhook-signature'),
      },
      raw,
      Date.now(),
    ));
  if (!valid) return json(401, {});

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, {});
  }

  try {
    const answer = await sendSmsHook(
      { limits: rateLimiter(), sms: smsProvider() },
      payload as Parameters<typeof sendSmsHook>[1],
    );
    return json(answer.status, answer.body);
  } catch {
    return json(500, {
      error: { http_code: 500, message: 'generic.unexpected' },
    });
  }
});
