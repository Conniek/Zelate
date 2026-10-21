/**
 * Property tests (fast-check) of the zelate-domain §7 invariants that apply
 * without appointments: 1, 2, 3, 4 (as far as stylist changes exist in step
 * 1), 6 and 9; plus notification deduplication and schedule sanity.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  computeSchedule,
  detectTimeTriggers,
  isActiveStatus,
} from './index.ts';
import type {
  Command,
  EngineOutput,
  QueueState,
  TicketState,
} from './index.ts';
import {
  END_OF_DAY,
  adjustDuration,
  at,
  callTicket,
  cancelTicket,
  client,
  completeService,
  confirmArrival,
  joinQueue,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  min,
  removeTicket,
  resolveClosing,
  resolveStylistChange,
  respondEndOfDay,
  respondEta,
  setHairdressing,
  setPresence,
  startService,
  takeNext,
  walkIn,
} from './testing/fixtures.ts';

const MEMBERS = ['ines', 'karim', 'gerant'] as const;
const CLIENTS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'] as const;
const SERVICES = ['cut', 'men', 'color', 'blowdry', null] as const;

type Step =
  | { kind: 'wait'; minutes: number }
  | {
      kind: 'join';
      client: number;
      service: number;
      requested: number | null;
      arrival: number | null;
      consent: boolean;
    }
  | { kind: 'walk_in'; service: number }
  | { kind: 'call'; member: number }
  | { kind: 'arrive'; ticket: number; member: number }
  | { kind: 'start'; ticket: number; member: number }
  | { kind: 'adjust'; ticket: number; member: number; delta: number }
  | { kind: 'complete'; ticket: number; member: number }
  | { kind: 'take_next'; ticket: number; member: number }
  | {
      kind: 'eta';
      ticket: number;
      response: 'on_time' | 'late' | 'cancel';
      delay: number;
    }
  | { kind: 'cancel'; ticket: number }
  | { kind: 'remove'; ticket: number }
  | {
      kind: 'presence';
      member: number;
      status: 'available' | 'on_break' | 'late' | 'absent' | 'off_duty';
      minutes: number;
    }
  | { kind: 'hairdressing'; on: boolean }
  | { kind: 'choice'; ticket: number; choice: 'wait' | 'first_available' }
  | { kind: 'end_of_day'; ticket: number; choice: 'stay' | 'cancel' }
  | { kind: 'closing'; ticket: number; decision: 'serve' | 'cancel' };

const idx = fc.nat({ max: 7 });

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('wait' as const),
      minutes: fc.integer({ min: 1, max: 90 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('join' as const),
      client: fc.nat({ max: CLIENTS.length - 1 }),
      service: fc.nat({ max: SERVICES.length - 1 }),
      requested: fc.option(fc.nat({ max: 2 }), { nil: null }),
      arrival: fc.option(fc.integer({ min: 5, max: 60 }), { nil: null }),
      consent: fc.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('walk_in' as const),
      service: fc.nat({ max: SERVICES.length - 1 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('call' as const),
      member: fc.nat({ max: 2 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('arrive' as const),
      ticket: idx,
      member: fc.nat({ max: 2 }),
    }),
  },
  {
    weight: 4,
    arbitrary: fc.record({
      kind: fc.constant('start' as const),
      ticket: idx,
      member: fc.nat({ max: 2 }),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('adjust' as const),
      ticket: idx,
      member: fc.nat({ max: 2 }),
      delta: fc.constantFrom(5, 15, 30, 45),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('complete' as const),
      ticket: idx,
      member: fc.nat({ max: 2 }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('take_next' as const),
      ticket: idx,
      member: fc.nat({ max: 2 }),
    }),
  },
  {
    weight: 3,
    arbitrary: fc.record({
      kind: fc.constant('eta' as const),
      ticket: idx,
      response: fc.constantFrom(
        'on_time' as const,
        'late' as const,
        'late' as const,
        'cancel' as const,
      ),
      delay: fc.integer({ min: 5, max: 30 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('cancel' as const), ticket: idx }),
  },
  {
    weight: 1,
    arbitrary: fc.record({ kind: fc.constant('remove' as const), ticket: idx }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('presence' as const),
      member: fc.nat({ max: 2 }),
      status: fc.constantFrom(
        'available' as const,
        'on_break' as const,
        'late' as const,
        'absent' as const,
        'off_duty' as const,
      ),
      minutes: fc.integer({ min: 0, max: 120 }),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('hairdressing' as const),
      on: fc.boolean(),
    }),
  },
  {
    weight: 1,
    arbitrary: fc.record({
      kind: fc.constant('choice' as const),
      ticket: idx,
      choice: fc.constantFrom('wait' as const, 'first_available' as const),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('end_of_day' as const),
      ticket: idx,
      choice: fc.constantFrom('stay' as const, 'cancel' as const),
    }),
  },
  {
    weight: 2,
    arbitrary: fc.record({
      kind: fc.constant('closing' as const),
      ticket: idx,
      decision: fc.constantFrom('serve' as const, 'cancel' as const),
    }),
  },
);

/** The day starts with `prefill` clients already waiting, in random services. */
const initialState = (prefill: readonly number[]): QueueState =>
  makeState({
    members: [
      makeMember('ines'),
      makeMember('karim', { specialties: ['men_cut', 'color'] }),
      makeManager('gerant', {
        is_hairdressing: true,
        specialties: ['women_cut'],
      }),
    ],
    tickets: prefill.map((service, i) => {
      const serviceId = SERVICES[service] ?? null;
      return makeTicket(`p${i}`, {
        service_id: serviceId,
        queue_rank: i + 1,
      });
    }),
  });

let ticketSeq = 0;

function toCommand(step: Step, state: QueueState, now: number): Command | null {
  const ticketAt = (i: number): TicketState | undefined =>
    state.tickets.length === 0
      ? undefined
      : state.tickets[i % state.tickets.length];
  /** Prefers a ticket for which the command makes sense, so every transition gets exercised. */
  const pick = (
    i: number,
    wanted: (t: TicketState) => boolean,
  ): TicketState | undefined => {
    const matches = state.tickets.filter(wanted);
    return matches.length > 0 && i % 4 !== 0
      ? matches[i % matches.length]
      : ticketAt(i);
  };
  const memberAt = (i: number) => MEMBERS[i % MEMBERS.length] as string;
  const actorFor = (t: TicketState, i: number) =>
    i % 5 !== 0 && t.assigned_member_id !== null
      ? t.assigned_member_id
      : memberAt(i);
  switch (step.kind) {
    case 'wait':
      return null;
    case 'join': {
      ticketSeq += 1;
      return joinQueue(
        `t${ticketSeq}`,
        {
          service_id: SERVICES[step.service] ?? null,
          requested_member_id:
            step.requested === null ? null : memberAt(step.requested),
          declared_arrival_at:
            step.arrival === null ? null : now + min(step.arrival),
          notifications_consent: step.consent,
        },
        client(CLIENTS[step.client] as string),
      );
    }
    case 'walk_in':
      ticketSeq += 1;
      return walkIn(`t${ticketSeq}`, {
        service_id: SERVICES[step.service] ?? null,
      });
    case 'call':
      return callTicket(memberAt(step.member));
    case 'arrive': {
      const t = pick(
        step.ticket,
        (x) => x.status === 'called' && x.arrived_at === null,
      );
      return t ? confirmArrival(memberAt(step.member), t.short_code) : null;
    }
    case 'start': {
      const t = pick(
        step.ticket,
        (x) => x.status === 'called' && x.arrived_at !== null,
      );
      return t
        ? startService(
            actorFor(t, step.member),
            t.id,
            t.planned_duration_minutes,
            t.service_id,
          )
        : null;
    }
    case 'adjust': {
      const t = pick(step.ticket, (x) => x.status === 'in_service');
      return t
        ? adjustDuration(actorFor(t, step.member), t.id, step.delta)
        : null;
    }
    case 'complete': {
      const t = pick(step.ticket, (x) => x.status === 'in_service');
      return t ? completeService(actorFor(t, step.member), t.id) : null;
    }
    case 'take_next': {
      const t = pick(
        step.ticket,
        (x) => x.status === 'called' && x.eta_response === 'late',
      );
      return t ? takeNext(actorFor(t, step.member), t.id) : null;
    }
    case 'eta': {
      const t = pick(step.ticket, (x) => x.status === 'waiting');
      return t
        ? respondEta(
            t.id,
            step.response,
            step.response === 'late' ? step.delay : null,
          )
        : null;
    }
    case 'cancel': {
      const t = ticketAt(step.ticket);
      return t ? cancelTicket(t.id) : null;
    }
    case 'remove': {
      const t = ticketAt(step.ticket);
      return t ? removeTicket(t.id, 'other') : null;
    }
    case 'presence': {
      const target = memberAt(step.member);
      const until = now + min(Math.max(step.minutes, 5));
      return setPresence('gerant', target, step.status, {
        break_type: step.status === 'on_break' ? 'short' : null,
        until:
          step.status === 'on_break' || step.status === 'late' ? until : null,
        shift_end_at:
          step.status === 'off_duty' ? now + min(step.minutes) : null,
      });
    }
    case 'hairdressing':
      return setHairdressing(step.on);
    case 'choice': {
      const t = pick(
        step.ticket,
        (x) => x.stylist_change_pending_since !== null,
      );
      return t ? resolveStylistChange(t.id, step.choice) : null;
    }
    case 'end_of_day': {
      const t = pick(
        step.ticket,
        (x) => x.end_of_day_warned_at !== null && x.end_of_day_choice === null,
      );
      return t ? respondEndOfDay(t.id, step.choice) : null;
    }
    case 'closing': {
      const t = pick(step.ticket, (x) => x.status === 'waiting');
      return t ? resolveClosing([t.id], step.decision) : null;
    }
  }
}

interface Trace {
  before: QueueState;
  after: QueueState;
  output: EngineOutput;
  command: Command | null;
  now: number;
}

/** Runs the steps from 09:00, ticking after each one, and returns every transition. */
function simulate(
  run: Run,
  finalTick = false,
  onFailure?: (command: Command, code: string) => void,
): Trace[] {
  const traces: Trace[] = [];
  let state = initialState(run.prefill);
  let now = at('09:00') + min(run.start);
  const { steps } = run;
  for (const step of steps) {
    // Distinct commands never share an instant in production.
    now += step.kind === 'wait' ? min(step.minutes) : 1000;
    const command = toCommand(step, state, now);
    if (command) {
      const result = applyCommand(state, command, now);
      if (result.ok) {
        traces.push({
          before: state,
          after: result.state,
          output: result,
          command,
          now,
        });
        state = result.state;
      } else {
        onFailure?.(command, result.error.code);
      }
    }
    const tick = detectTimeTriggers(state, now);
    traces.push({
      before: state,
      after: tick.state,
      output: tick,
      command: null,
      now,
    });
    state = tick.state;
  }
  if (finalTick) {
    const tick = detectTimeTriggers(state, Math.max(now, END_OF_DAY));
    traces.push({
      before: state,
      after: tick.state,
      output: tick,
      command: null,
      now: Math.max(now, END_OF_DAY),
    });
  }
  return traces;
}

interface Run {
  readonly start: number;
  readonly prefill: readonly number[];
  readonly steps: readonly Step[];
}

/** A run starts between 09:00 and 19:30 (minutes after 09:00) with a prefilled queue and plays up to 60 steps. */
const runs: fc.Arbitrary<Run> = fc.record({
  start: fc.oneof(
    fc.integer({ min: 0, max: 300 }),
    fc.integer({ min: 420, max: 630 }),
  ),
  prefill: fc.array(fc.nat({ max: SERVICES.length - 1 }), {
    maxLength: 12,
    size: 'max',
  }),
  steps: fc.array(stepArb, { minLength: 5, maxLength: 60, size: 'max' }),
});
const PARAMS = { numRuns: Number(process.env.FC_RUNS ?? 150) };

describe('Invariants (zelate-domain §7)', () => {
  it('the generated runs reach every core command and the main statuses', () => {
    const succeeded = new Set<string>();
    const statuses = new Set<string>();
    const failures = new Map<string, number>();
    const onFailure = (command: Command, code: string) => {
      const key = `${command.command}:${code}`;
      failures.set(key, (failures.get(key) ?? 0) + 1);
    };
    for (const run of fc.sample(runs, { numRuns: 300, seed: 42 })) {
      for (const { command, after } of simulate(run, true, onFailure)) {
        if (command) succeeded.add(command.command);
        for (const t of after.tickets) statuses.add(t.status);
      }
    }
    if (process.env.FC_DEBUG) console.log([...failures].sort());
    expect([...succeeded].sort()).toEqual(
      [
        'adjust_duration',
        'call_ticket',
        'cancel_ticket',
        'complete_service',
        'confirm_arrival',
        'join_queue',
        'register_walk_in',
        'remove_ticket',
        'resolve_closing',
        'resolve_stylist_change',
        'respond_end_of_day',
        'respond_eta',
        'set_hairdressing',
        'set_presence',
        'start_service',
        'take_next',
      ].sort(),
    );
    expect([...statuses].sort()).toEqual(
      [
        'called',
        'cancelled',
        'completed',
        'in_service',
        'no_show',
        'waiting',
      ].sort(),
    );
  });

  it('invariant 1 — at most one active ticket per client', () => {
    fc.assert(
      fc.property(runs, (run) => {
        for (const { after } of simulate(run)) {
          const active = after.tickets.filter(
            (t) => isActiveStatus(t.status) && t.client_id !== null,
          );
          const clients = active.map((t) => t.client_id);
          expect(new Set(clients).size).toBe(clients.length);
        }
      }),
      PARAMS,
    );
  });

  it('invariant 2 — at most one called or in-service ticket per stylist', () => {
    fc.assert(
      fc.property(runs, (run) => {
        for (const { after } of simulate(run)) {
          const busy = after.tickets
            .filter((t) => t.status === 'called' || t.status === 'in_service')
            .map((t) => t.assigned_member_id);
          expect(busy.every((m) => m !== null)).toBe(true);
          expect(new Set(busy).size).toBe(busy.length);
        }
      }),
      PARAMS,
    );
  });

  it('invariant 3 — postpone_count ≤ 2 and a ticket only moves back through take_next', () => {
    fc.assert(
      fc.property(runs, (run) => {
        for (const { before, after, command } of simulate(run)) {
          for (const t of after.tickets) {
            expect(t.postpone_count).toBeLessThanOrEqual(2);
            const previous = before.tickets.find((b) => b.id === t.id);
            if (!previous) continue;
            const movedBack = t.queue_rank > previous.queue_rank;
            const postponed = t.postpone_count > previous.postpone_count;
            if (
              command?.command === 'take_next' &&
              command.payload.ticket_id === t.id
            ) {
              expect(movedBack).toBe(postponed);
            } else {
              expect(movedBack).toBe(false);
              expect(postponed).toBe(false);
            }
          }
        }
      }),
      PARAMS,
    );
  });

  it('invariant 4 — a stylist change made without the client never gives him a later time', () => {
    fc.assert(
      fc.property(runs, (run) => {
        for (const { before, after, command } of simulate(run)) {
          const byClient =
            command !== null &&
            (command.actor.type === 'client' ||
              command.actor.type === 'ticket_token');
          if (byClient) continue;
          for (const t of after.tickets) {
            const previous = before.tickets.find((b) => b.id === t.id);
            if (
              !previous ||
              previous.status !== 'waiting' ||
              t.status !== 'waiting'
            )
              continue;
            if (previous.requested_member_id === t.requested_member_id)
              continue;
            if (
              previous.estimated_start_at === null ||
              t.estimated_start_at === null
            )
              continue;
            expect(t.estimated_start_at).toBeLessThanOrEqual(
              previous.estimated_start_at,
            );
          }
        }
      }),
      PARAMS,
    );
  });

  it('invariant 6 — one end-of-day warning per ticket at most', () => {
    fc.assert(
      fc.property(runs, (run) => {
        const warned = new Map<string, number>();
        const counts = new Map<string, number>();
        for (const { after, output } of simulate(run)) {
          for (const t of after.tickets) {
            if (t.end_of_day_warned_at === null) {
              expect(warned.has(t.id)).toBe(false);
            } else {
              const first = warned.get(t.id) ?? t.end_of_day_warned_at;
              expect(t.end_of_day_warned_at).toBe(first);
              warned.set(t.id, first);
            }
          }
          for (const n of output.notifications) {
            if (n.template === 'end_of_day_risk') {
              counts.set(n.ticket_id, (counts.get(n.ticket_id) ?? 0) + 1);
            }
          }
        }
        expect([...counts.values()].every((c) => c === 1)).toBe(true);
      }),
      PARAMS,
    );
  });

  it('invariant 9 — no ticket survives its service day', () => {
    fc.assert(
      fc.property(runs, (run) => {
        const traces = simulate(run, true);
        const last = traces[traces.length - 1];
        expect(
          last?.after.tickets.filter((t) => isActiveStatus(t.status)),
        ).toEqual([]);
      }),
      PARAMS,
    );
  });

  it('notifications are never duplicated (same ticket and dedupe key)', () => {
    fc.assert(
      fc.property(runs, (run) => {
        const seen = new Set<string>();
        for (const { output } of simulate(run, true)) {
          for (const n of output.notifications) {
            const key = `${n.ticket_id}|${n.dedupe_key}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        }
      }),
      PARAMS,
    );
  });

  it('displayed waits are multiples of 5 minutes and estimates never start in the past', () => {
    fc.assert(
      fc.property(runs, (run) => {
        for (const { after, now } of simulate(run)) {
          const schedule = computeSchedule(after, now);
          for (const estimate of Object.values(schedule.tickets)) {
            if (estimate.estimated_start_at === null) continue;
            expect(estimate.estimated_start_at).toBeGreaterThanOrEqual(now);
            expect((estimate.wait_minutes ?? -1) % 5).toBe(0);
          }
        }
      }),
      PARAMS,
    );
  });
});
