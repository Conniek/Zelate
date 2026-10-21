// `/t/:shortCode` (ADR-006): the SMS link exchanged for the ticket view and
// its token. Capped per IP; the code and the token are never logged.
import { readTicketLink } from '../../../packages/queue-service/src/index.ts';
import { clientIp, json, preflight, rateLimiter } from '../_shared/http.ts';
import { ticketLinkReader } from '../_shared/queue-transaction/index.ts';

const PER_MINUTE = 60;

Deno.serve(async (request) => {
  const early = preflight(request);
  if (early) return early;
  if (request.method !== 'GET') return json(405, { ok: false });
  try {
    const allowed = await rateLimiter().consume(
      'ticket_public',
      clientIp(request),
      PER_MINUTE,
      60,
    );
    if (!allowed) {
      return json(429, {
        ok: false,
        error: {
          code: 'rate_limited',
          messageKey: 'errors.queue.rate_limited',
        },
      });
    }
    const code = new URL(request.url).searchParams.get('code') ?? '';
    const response = await readTicketLink(ticketLinkReader(), code, Date.now());
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
