/** Property tests (fast-check) of the H10 invariants: no appointment delayed by a walk-in; no reassignment moves a client back without his consent; pending check-ins never enter an estimate. */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyCommand, computeSchedule } from './index.ts';
import {
  at,
  makeManager,
  makeMember,
  makeState,
  makeTicket,
  member,
  walkIn,
} from './testing/fixtures.ts';
import type { QueueState, TicketState } from './types.ts';

const PARAMS = { numRuns: Number(process.env.FC_RUNS ?? 150) };
const NOW = at('10:00');
const SERVICE_IDS = ['cut', 'men', 'color', 'blowdry', null] as const;
const STYLISTS = ['ines', 'karim'] as const;

interface Scenario {
  readonly slots: readonly { member: number; slot: number; onSite: boolean }[];
  readonly walkIns: readonly { service: number; stylist: number }[];
  readonly busy: readonly number[];
  readonly newcomer: { service: number; stylist: number };
}

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  slots: fc.uniqueArray(
    fc.record({
      member: fc.nat({ max: 1 }),
      slot: fc.nat({ max: 9 }),
      onSite: fc.boolean(),
    }),
    { maxLength: 8, selector: (s) => `${s.member}:${s.slot}` },
  ),
  walkIns: fc.array(
    fc.record({ service: fc.nat({ max: 4 }), stylist: fc.nat({ max: 2 }) }),
    { maxLength: 5 },
  ),
  busy: fc.array(fc.constantFrom(5, 15, 30, 45), { maxLength: 2 }),
  newcomer: fc.record({
    service: fc.nat({ max: 4 }),
    stylist: fc.nat({ max: 2 }),
  }),
});

const stylistOf = (i: number): string | null => STYLISTS[i] ?? null;

function build(s: Scenario): QueueState {
  const appointments: TicketState[] = s.slots.map((slot, i) =>
    makeTicket(`rv${i}`, {
      kind: 'appointment',
      appointment_source: 'salon_entry',
      channel: 'front_desk',
      scheduled_at: at('10:30') + slot.slot * 30 * 60_000,
      assigned_member_id: STYLISTS[slot.member] ?? 'ines',
      service_id: 'cut',
      planned_duration_minutes: 30,
      arrived_at: slot.onSite ? NOW : null,
      queue_rank: 100 + i,
    }),
  );
  const queue = s.walkIns.map((w, i) =>
    makeTicket(`w${i}`, {
      service_id: SERVICE_IDS[w.service] ?? null,
      requested_member_id: stylistOf(w.stylist),
      queue_rank: i + 1,
    }),
  );
  const inService = s.busy.map((extra, i) =>
    makeTicket(`busy${i}`, {
      status: 'in_service',
      assigned_member_id: STYLISTS[i] ?? 'ines',
      started_at: NOW - 20 * 60_000,
      arrived_at: NOW - 20 * 60_000,
      planned_duration_minutes: 20 + extra,
      call_count: 1,
    }),
  );
  return makeState({
    members: [
      makeManager(),
      makeMember('ines'),
      makeMember('karim', { specialties: ['women_cut', 'men_cut', 'color'] }),
    ],
    tickets: [...inService, ...appointments, ...queue],
  });
}

const waitingAppointments = (state: QueueState) =>
  state.tickets.filter(
    (t) => t.kind === 'appointment' && t.status === 'waiting',
  );

describe('H10 invariants (property)', () => {
  it('a walk-in never delays an appointment', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const state = build(s);
        const before = computeSchedule(state, NOW);
        const out = applyCommand(
          state,
          walkIn('new', {
            service_id: SERVICE_IDS[s.newcomer.service] ?? null,
            requested_member_id: stylistOf(s.newcomer.stylist),
          }),
          NOW,
        );
        if (!out.ok) return true;
        const after = computeSchedule(out.state, NOW);
        return waitingAppointments(state).every((t) => {
          const was = before.tickets[t.id]?.estimated_start_at;
          const is = after.tickets[t.id]?.estimated_start_at;
          // An on-site client taken early may go back to his own time, never beyond.
          return (
            was === undefined ||
            was === null ||
            (is ?? Infinity) <= Math.max(was, t.scheduled_at ?? 0)
          );
        });
      }),
      PARAMS,
    );
  });

  it('an appointment keeps its stylist and never starts before its time', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const state = build(s);
        const schedule = computeSchedule(state, NOW);
        return waitingAppointments(state).every((t) => {
          const e = schedule.tickets[t.id];
          return (
            e !== undefined &&
            e.estimated_member_id === t.assigned_member_id &&
            (e.estimated_start_at === null ||
              e.estimated_start_at >= (t.scheduled_at ?? 0) ||
              t.arrived_at !== null)
          );
        });
      }),
      PARAMS,
    );
  });

  it('a reassignment applied at once never moves the client back', () => {
    fc.assert(
      fc.property(scenarioArb, fc.nat({ max: 1 }), (s, target) => {
        const state = build(s);
        const first = state.tickets.find((t) => t.id.startsWith('w'));
        if (!first) return true;
        const before = computeSchedule(state, NOW).tickets[first.id]
          ?.estimated_start_at;
        const out = applyCommand(
          state,
          {
            command: 'reassign_ticket',
            actor: member('gerant'),
            payload: {
              ticket_id: first.id,
              member_id: STYLISTS[target] ?? 'ines',
            },
          },
          NOW,
        );
        if (!out.ok) return true;
        const moved = out.state.tickets.find((t) => t.id === first.id);
        if (moved?.reassignment_member_id) {
          return moved.requested_member_id === first.requested_member_id;
        }
        const after = computeSchedule(out.state, NOW).tickets[first.id]
          ?.estimated_start_at;
        return before == null || (after ?? Infinity) <= before;
      }),
      PARAMS,
    );
  });

  it('a pending check-in is in no estimate and delays nobody', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const state = build(s);
        const pending = makeTicket('pc', {
          kind: 'appointment',
          appointment_source: 'client_check_in',
          status: 'pending_confirmation',
          channel: 'qr',
          scheduled_at: at('11:00'),
          requested_member_id: 'ines',
          queue_rank: 200,
        });
        const withPending = { ...state, tickets: [...state.tickets, pending] };
        const a = computeSchedule(state, NOW).tickets;
        const b = computeSchedule(withPending, NOW).tickets;
        expect(b['pc']?.estimated_start_at ?? null).toBeNull();
        return state.tickets.every(
          (t) => a[t.id]?.estimated_start_at === b[t.id]?.estimated_start_at,
        );
      }),
      PARAMS,
    );
  });
});
