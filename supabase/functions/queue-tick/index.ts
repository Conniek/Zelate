// Time triggers, every minute, called by pg_cron through
// private.invoke_edge_function with the shared secret (BACKEND_SCHEMA §10).
import { runQueueTick } from '../../../packages/queue-service/src/index.ts';
import { json } from '../_shared/http.ts';
import { queueServiceDeps } from '../_shared/queue-transaction/index.ts';

function sameSecret(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json(405, { ok: false });
  const secret = Deno.env.get('CRON_SECRET');
  const given = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  // The example value of .env.example is never accepted.
  if (
    !secret ||
    secret.startsWith('REPLACE_ME') ||
    !given ||
    !sameSecret(given, secret)
  ) {
    return json(401, { ok: false });
  }
  try {
    const report = await runQueueTick(queueServiceDeps());
    return json(200, { ok: true, data: report });
  } catch {
    return json(500, { ok: false });
  }
});
