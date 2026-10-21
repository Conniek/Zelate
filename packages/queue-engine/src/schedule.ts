/**
 * Wait simulation (H2, PRD §5.2 « Calcul de l'heure de passage »):
 *
 *   T_k = t0 + R_c + Σ_{i<k} d_i      R_c = max(m, D_current − E)
 *
 * The simulation replays distribution rule 4 stylist by stylist: the stylist
 * who frees up first (tie: fewest clients served today, rule 2) takes the
 * first eligible ticket in queue order; a ticket whose declared arrival time
 * is not reached is skipped (H8). Doing the estimate with the same rule as
 * the call keeps the estimated stylist (ADR-015) consistent with who will
 * actually call the client.
 */
import {
  MINUTE,
  OVERRUN_MINIMUM_MINUTES,
  UNKNOWN_SERVICE_MINUTES,
  WAIT_ROUNDING_MINUTES,
} from './constants.ts';
import {
  appointmentToTake,
  appointmentsOf,
  awaitsDeclaredArrival,
  busyTicketOf,
  canServe,
  ceilToMinute,
  durationOf,
  fullnessLimit,
  isOnSite,
  masters,
  orderedQueue,
  readyStart,
  shiftEndOf,
  skipClosures,
} from './rules.ts';
import { newTicket } from './state.ts';
import type {
  FreeSlot,
  Instant,
  MemberState,
  QueueState,
  Schedule,
  SalonIndicators,
  TicketEstimate,
  TicketState,
} from './types.ts';

interface SimStylist {
  readonly member: MemberState;
  freeAt: Instant;
  readonly shiftEnd: Instant | null;
  position: number;
  done: boolean;
}

interface SimSlot {
  readonly start: Instant;
  readonly memberId: string;
  readonly position: number;
}

/** t0 of a stylist who receives clients today, or null if he is out of the calculation. */
function startOfAvailability(
  member: MemberState,
  now: Instant,
): Instant | null {
  if (member.status !== 'active' || !member.is_hairdressing) return null;
  const { status, expected_back_at } = member.presence;
  switch (status) {
    case 'available':
    case 'in_service':
      return now;
    case 'on_break':
    case 'late':
      // An overdue break or arrival counts from now. A break ends automatically at
      // the next tick (E32); a late stylist stays late until he sets himself available.
      return Math.max(now, expected_back_at ?? now);
    case 'off_duty':
      return shiftEndOf(member, now) === null ? null : now;
    case 'offline':
    case 'absent':
      return null;
  }
}

function stylistsAt(state: QueueState, now: Instant): SimStylist[] {
  const stylists: SimStylist[] = [];
  for (const member of state.members) {
    const t0 = startOfAvailability(member, now);
    if (t0 === null) continue;
    let freeAt = t0;
    let position = 0;
    const busy = busyTicketOf(state, member.id);
    if (busy?.status === 'in_service' && busy.started_at !== null) {
      const remaining = Math.max(
        OVERRUN_MINIMUM_MINUTES * MINUTE,
        durationOf(busy) - (now - busy.started_at),
      );
      freeAt = t0 + remaining;
    } else if (busy?.status === 'called') {
      const start =
        busy.arrived_at === null
          ? Math.max(t0, busy.declared_arrival_at ?? t0)
          : t0;
      freeAt = start + durationOf(busy);
      position = 1;
    }
    stylists.push({
      member,
      freeAt,
      shiftEnd: shiftEndOf(member, now),
      position,
      done: false,
    });
  }
  return stylists;
}

function fits(stylist: SimStylist, start: Instant, duration: number): boolean {
  return stylist.shiftEnd === null || start + duration <= stylist.shiftEnd;
}

function nextStylist(stylists: readonly SimStylist[]): SimStylist | undefined {
  let best: SimStylist | undefined;
  for (const s of stylists) {
    if (s.done) continue;
    if (
      best === undefined ||
      s.freeAt < best.freeAt ||
      (s.freeAt === best.freeAt &&
        (s.member.served_today_count < best.member.served_today_count ||
          (s.member.served_today_count === best.member.served_today_count &&
            s.member.id < best.member.id)))
    ) {
      best = s;
    }
  }
  return best;
}

/**
 * Simulates the distribution of `queue` (walk-ins, already in queue order)
 * together with the appointments of the day (H10): each appointment keeps its
 * stylist and never starts before its time unless its client is on site and
 * the stylist is free (rule 8); a walk-in goes before an appointment only if
 * his service ends before the appointment time (rule 6, margin 0).
 */
function simulate(
  state: QueueState,
  now: Instant,
  queue: readonly TicketState[],
): Map<string, SimSlot> {
  const stylists = stylistsAt(state, now);
  const pending = [...queue];
  const appointments = new Map<string, TicketState[]>(
    stylists.map((s) => [s.member.id, appointmentsOf(state, s.member.id)]),
  );
  const slots = new Map<string, SimSlot>();
  const day = state.salon.service_day;

  for (;;) {
    const stylist = nextStylist(
      stylists.filter(
        (s) =>
          pending.length > 0 ||
          (appointments.get(s.member.id)?.length ?? 0) > 0,
      ),
    );
    if (!stylist) break;
    const t = skipClosures(day, stylist.freeAt);
    stylist.freeAt = t;

    const mine = appointments.get(stylist.member.id) as TicketState[];
    const due = mine[0] !== undefined && (mine[0].scheduled_at as Instant) <= t;
    const limit =
      mine[0] === undefined || due
        ? Number.POSITIVE_INFINITY
        : (mine[0].scheduled_at as Instant);

    let chosen: { index: number; start: Instant } | null = null;
    let nextArrival = Number.POSITIVE_INFINITY;
    if (!due) {
      for (let i = 0; i < pending.length; i += 1) {
        const ticket = pending[i] as TicketState;
        if (!canServe(state, stylist.member, ticket)) continue;
        const duration = durationOf(ticket);
        if (awaitsDeclaredArrival(ticket, t)) {
          const arrival = ticket.declared_arrival_at as Instant;
          if (fits(stylist, arrival, duration) && arrival + duration <= limit) {
            nextArrival = Math.min(nextArrival, arrival);
          }
          continue;
        }
        const start = readyStart(ticket, t);
        if (!fits(stylist, start, duration) || start + duration > limit)
          continue;
        chosen = { index: i, start };
        break;
      }
    }

    if (chosen) {
      const ticket = pending[chosen.index] as TicketState;
      pending.splice(chosen.index, 1);
      slots.set(ticket.id, {
        start: chosen.start,
        memberId: stylist.member.id,
        position: stylist.position,
      });
      stylist.position += 1;
      stylist.freeAt = chosen.start + durationOf(ticket);
    } else if (nextArrival !== Number.POSITIVE_INFINITY) {
      // H8: nobody else to take, the stylist waits for the declared arrival.
      stylist.freeAt = nextArrival;
    } else {
      const appointment = appointmentToTake(mine, t);
      if (!appointment) {
        stylist.done = true;
        continue;
      }
      mine.splice(mine.indexOf(appointment), 1);
      const scheduled = appointment.scheduled_at as Instant;
      const start = isOnSite(appointment) ? t : Math.max(t, scheduled);
      slots.set(appointment.id, {
        start,
        memberId: stylist.member.id,
        position: stylist.position,
      });
      stylist.position += 1;
      stylist.freeAt = start + durationOf(appointment);
    }
  }
  return slots;
}

function waitMinutes(start: Instant, now: Instant): number {
  const step = WAIT_ROUNDING_MINUTES * MINUTE;
  return Math.max(0, Math.ceil((start - now) / step) * WAIT_ROUNDING_MINUTES);
}

function shortestServiceMinutes(state: QueueState): number {
  const durations = state.services
    .filter((s) => s.is_active)
    .map((s) => s.duration_minutes);
  return durations.length > 0
    ? Math.min(...durations)
    : UNKNOWN_SERVICE_MINUTES;
}

/**
 * Indicators of the salon page (E31) and « file complète » (K36): a virtual
 * « premier disponible » client is added at the end of the queue with the
 * shortest active service, so that `is_full` means that no new ticket can
 * fit before the last closing.
 */
function indicators(
  state: QueueState,
  now: Instant,
  queue: readonly TicketState[],
): SalonIndicators {
  const minutes = shortestServiceMinutes(state);
  const virtualTicket = newTicket({
    id: '\u0000virtual',
    service_date: state.salon.service_day.service_date,
    short_code: '',
    client_id: null,
    channel: 'app',
    service_id: null,
    planned_duration_minutes: minutes,
    requested_member_id: null,
    queue_rank: Number.MAX_SAFE_INTEGER,
    declared_arrival_at: null,
    notifications_consent_at: null,
    created_by_member_id: null,
    created_at: now,
  });
  const slot = simulate(state, now, [...queue, virtualTicket]).get(
    virtualTicket.id,
  );
  const limit = fullnessLimit(state.salon.service_day);
  const start = slot ? ceilToMinute(slot.start) : null;
  return {
    waiting_count: state.tickets.filter((t) => t.status === 'waiting').length,
    current_wait_minutes: start === null ? null : waitMinutes(start, now),
    is_full:
      now >= limit || (start !== null && start + minutes * MINUTE > limit),
  };
}

/** Estimated start, stylist, displayed wait and position of every waiting ticket (H2). */
export function computeSchedule(state: QueueState, now: Instant): Schedule {
  const queue = orderedQueue(state);
  const slots = simulate(state, now, queue);
  const tickets: Record<string, TicketEstimate> = {};
  const appointments = state.tickets.filter(
    (t) => t.status === 'waiting' && t.kind === 'appointment',
  );
  for (const ticket of [...queue, ...appointments]) {
    const slot = slots.get(ticket.id);
    const start = slot ? ceilToMinute(slot.start) : null;
    tickets[ticket.id] = {
      ticket_id: ticket.id,
      estimated_start_at: start,
      estimated_member_id: slot?.memberId ?? null,
      wait_minutes: slot ? waitMinutes(slot.start, now) : null,
      position: slot?.position ?? null,
    };
  }
  return { tickets, salon: indicators(state, now, queue) };
}

interface Interval {
  readonly start: Instant;
  readonly end: Instant;
}

/** Free windows of a stylist from `from` to `to`, minus `busy`, within the opening ranges. */
function holesOf(
  from: Instant,
  to: Instant,
  busy: readonly Interval[],
  ranges: readonly Interval[],
): Interval[] {
  const free: Interval[] = [];
  let cursor = from;
  for (const b of [...busy].sort((x, y) => x.start - y.start)) {
    if (b.start > cursor)
      free.push({ start: cursor, end: Math.min(b.start, to) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < to) free.push({ start: cursor, end: to });
  const holes: Interval[] = [];
  for (const f of free) {
    for (const r of ranges) {
      const start = ceilToMinute(Math.max(f.start, r.start));
      const end = Math.min(f.end, r.end);
      if (end > start) holes.push({ start, end });
    }
  }
  return holes.sort((a, b) => a.start - b.start);
}

/**
 * Next free slots (E22): for each active service, the earliest hole of a
 * present stylist who masters it, outside breaks and within opening hours,
 * including after his last client (margin 0). Nothing while the queue is not
 * open. Holes come from the same simulation as the estimates, so a hole is
 * never a time that a waiting ticket is already going to use.
 */
export function findNextFreeSlots(state: QueueState, now: Instant): FreeSlot[] {
  if (state.salon.queue_status !== 'open') return [];
  const queue = orderedQueue(state);
  const slots = simulate(state, now, queue);
  const byId = new Map(state.tickets.map((t) => [t.id, t]));
  const ranges = state.salon.service_day.opening_ranges.map((r) => ({
    start: r.opens_at,
    end: r.closes_at,
  }));
  const holes = stylistsAt(state, now).map((stylist) => {
    const busy: Interval[] = [{ start: now, end: stylist.freeAt }];
    for (const [id, slot] of slots) {
      const ticket = byId.get(id);
      if (slot.memberId === stylist.member.id && ticket) {
        busy.push({ start: slot.start, end: slot.start + durationOf(ticket) });
      }
    }
    return {
      member: stylist.member,
      holes: holesOf(
        Math.max(now, startOfAvailability(stylist.member, now) ?? now),
        stylist.shiftEnd ?? state.salon.service_day.ends_at,
        busy,
        ranges,
      ),
    };
  });
  const result: FreeSlot[] = [];
  for (const service of state.services) {
    if (!service.is_active) continue;
    const need = service.duration_minutes * MINUTE;
    let best: FreeSlot | null = null;
    for (const { member, holes: windows } of holes) {
      if (!masters(member, service)) continue;
      const hole = windows.find((w) => w.end - w.start >= need);
      if (
        hole &&
        (best === null ||
          hole.start < best.start_at ||
          (hole.start === best.start_at && member.id < best.member_id))
      ) {
        best = {
          service_id: service.id,
          start_at: hole.start,
          member_id: member.id,
        };
      }
    }
    if (best) result.push(best);
  }
  return result;
}
