/** Shared setup of the service tests (not shipped: excluded from coverage via testing). */
import type { Instant } from '../../queue-engine/src/index.ts';
import {
  handleQueueCommand,
  runQueueTick,
  type CommandResponse,
  type TickReport,
} from './service.ts';
import {
  FakeDb,
  MONDAY_10H,
  fakePhones,
  seedSalon,
  sequenceRandom,
} from './testing.ts';

export interface Harness {
  readonly db: FakeDb;
  now: Instant;
  send(
    profileId: string | null,
    command: string,
    payload?: unknown,
    options?: { commandId?: string; token?: string; salonId?: string },
  ): Promise<CommandResponse>;
  tick(): Promise<TickReport>;
}

export function harness(): Harness {
  const db = new FakeDb();
  seedSalon(db);
  const random = sequenceRandom();
  const h: Harness = {
    db,
    now: MONDAY_10H,
    send: (profileId, command, payload = {}, options = {}) =>
      handleQueueCommand(
        { db, clock: () => h.now, random, phones: fakePhones },
        { profileId },
        {
          command,
          command_id: options.commandId ?? crypto.randomUUID(),
          payload,
          ...(options.token ? { tracking_token: options.token } : {}),
          ...(options.salonId ? { salon_id: options.salonId } : {}),
        },
      ),
    tick: () =>
      runQueueTick({ db, clock: () => h.now, random, phones: fakePhones }),
  };
  return h;
}

export function data(response: CommandResponse): Record<string, unknown> {
  const body = response.body as {
    ok: boolean;
    data?: Record<string, unknown>;
    error?: unknown;
  };
  if (!body.ok) {
    throw new Error(`expected ok, got ${JSON.stringify(body.error)}`);
  }
  return body.data!;
}

export function code(response: CommandResponse): string {
  const body = response.body as { ok: boolean; error?: { code: string } };
  if (body.ok) throw new Error('expected an error');
  return body.error!.code;
}
