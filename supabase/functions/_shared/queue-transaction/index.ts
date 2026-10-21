// Shared transaction module of every queue write (ADR-003, K38): per-salon
// lock, engine, writes and outbox in one Postgres transaction. Used by
// queue-command now, and by queue-tick, deactivate-member and account-delete.
import postgres from 'npm:postgres@3.4.7';
import {
  cryptoRandom,
  hmacPhoneHasher,
  sqlQueueDb,
  sqlTicketLinkReader,
  type QueueServiceDeps,
  type TicketLinkReader,
} from '../../../../packages/queue-service/src/index.ts';

let sql: ReturnType<typeof postgres> | null = null;

function connection() {
  // `prepare: false` keeps it working behind a transaction pooler.
  sql ??= postgres(Deno.env.get('SUPABASE_DB_URL')!, {
    max: 3,
    prepare: false,
  });
  return sql;
}

export function queueServiceDeps(): QueueServiceDeps {
  const db = connection();
  return {
    db: sqlQueueDb(
      (fn) =>
        db.begin((tx) =>
          fn({
            query: (text, params = []) =>
              tx.unsafe(text, params as never[]) as unknown as Promise<never[]>,
          }),
        ) as Promise<never>,
    ),
    clock: () => Date.now(),
    random: cryptoRandom,
    phones: hmacPhoneHasher(Deno.env.get('PHONE_HASH_SECRET') ?? ''),
  };
}

/** Read-only: the tracking link of `ticket-public`, outside the queue lock. */
export function ticketLinkReader(): TicketLinkReader {
  const db = connection();
  return sqlTicketLinkReader({
    query: (text, params = []) =>
      db.unsafe(text, params as never[]) as unknown as Promise<never[]>,
  });
}
