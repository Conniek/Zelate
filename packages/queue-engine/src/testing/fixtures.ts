/**
 * Test builders. Times are given in Paris wall-clock on Wednesday
 * 21/10/2026 (UTC+2) and converted to UTC instants, the way the shared
 * transaction module will build the state.
 */
import { applyCommand } from '../commands.ts';
import { MINUTE } from '../constants.ts';
import type {
  Actor,
  Command,
  CommandResult,
  EngineOutput,
  Instant,
  MemberState,
  OpeningRange,
  PresenceState,
  QueueState,
  SalonState,
  ServiceState,
  TicketState,
} from '../types.ts';
import { DEFAULT_SALON_SETTINGS } from '../types.ts';

export const DAY = '2026-10-21';
const PARIS_OFFSET_HOURS = 2;

/** `at('14:05')` = 21/10/2026 14:05 in Paris, as a UTC instant. */
export function at(hhmm: string): Instant {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  return Date.UTC(2026, 9, 21, h - PARIS_OFFSET_HOURS, m);
}

export const min = (n: number): number => n * MINUTE;

export function range(opens: string, closes: string): OpeningRange {
  return { opens_at: at(opens), closes_at: at(closes) };
}

/** Midnight at the end of 21/10/2026 in Paris. */
export const END_OF_DAY = Date.UTC(2026, 9, 21, 22, 0);

export function makeSalon(overrides: Partial<SalonState> = {}): SalonState {
  return {
    id: 'salon-1',
    status: 'published',
    queue_status: 'open',
    settings: DEFAULT_SALON_SETTINGS,
    service_day: {
      service_date: DAY,
      opening_ranges: [range('09:00', '19:00')],
      ends_at: END_OF_DAY,
    },
    queue_version: 0,
    waiting_count: 0,
    current_wait_minutes: null,
    is_full: false,
    estimate_updated_at: null,
    ...overrides,
  };
}

export function presence(
  status: PresenceState['status'] = 'available',
  overrides: Partial<PresenceState> = {},
): PresenceState {
  return {
    status,
    status_since: at('09:00'),
    break_type: null,
    expected_back_at: null,
    shift_end_at: null,
    ...overrides,
  };
}

export function makeMember(
  id: string,
  overrides: Partial<MemberState> = {},
): MemberState {
  return {
    id,
    role: 'stylist',
    status: 'active',
    is_hairdressing: true,
    specialties: ['women_cut', 'men_cut'],
    served_today_count: 0,
    presence: presence('available'),
    ...overrides,
  };
}

export function makeManager(
  id = 'gerant',
  overrides: Partial<MemberState> = {},
): MemberState {
  return makeMember(id, {
    role: 'manager',
    is_hairdressing: false,
    specialties: [],
    ...overrides,
  });
}

export const SERVICES: readonly ServiceState[] = [
  {
    id: 'cut',
    duration_minutes: 30,
    required_specialty_code: 'women_cut',
    is_active: true,
  },
  {
    id: 'men',
    duration_minutes: 20,
    required_specialty_code: 'men_cut',
    is_active: true,
  },
  {
    id: 'color',
    duration_minutes: 60,
    required_specialty_code: 'color',
    is_active: true,
  },
  {
    id: 'blowdry',
    duration_minutes: 15,
    required_specialty_code: null,
    is_active: true,
  },
  {
    id: 'retired',
    duration_minutes: 45,
    required_specialty_code: null,
    is_active: false,
  },
];

const SERVICE_DURATION: Record<string, number> = Object.fromEntries(
  SERVICES.map((s) => [s.id, s.duration_minutes]),
);

let rankCounter = 0;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Deterministic 5-character ticket code without 0/O/1/I. */
export function codeFor(n: number): string {
  let rest = n;
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code = CODE_ALPHABET[rest % 32] + code;
    rest = Math.floor(rest / 32);
  }
  return code;
}

export function makeTicket(
  id: string,
  overrides: Partial<TicketState> = {},
): TicketState {
  rankCounter += 1;
  const serviceId =
    overrides.service_id === undefined ? 'cut' : overrides.service_id;
  return {
    id,
    service_date: DAY,
    short_code: codeFor(rankCounter),
    kind: 'queue',
    scheduled_at: null,
    appointment_source: null,
    confirmed_at: null,
    confirmed_by_member_id: null,
    confirmation_reminder_sent_at: null,
    appointment_delay_warned_steps: 0,
    client_id: `client-${id}`,
    channel: 'app',
    is_test: false,
    service_id: serviceId,
    planned_duration_minutes:
      serviceId === null ? 30 : (SERVICE_DURATION[serviceId] ?? 30),
    requested_member_id: null,
    estimated_member_id: null,
    assigned_member_id: null,
    status: 'waiting',
    queue_rank: rankCounter,
    priority_since: null,
    call_count: 0,
    postpone_count: 0,
    declared_arrival_at: null,
    notifications_consent_at: at('08:00'),
    eta_response: null,
    declared_delay_minutes: null,
    arrived_at: null,
    stylist_change_pending_since: null,
    reassignment_member_id: null,
    reassignment_requested_at: null,
    reassignment_proposed_start_at: null,
    estimated_start_at: null,
    last_notified_start_at: null,
    initial_estimated_start_at: null,
    t30_estimated_start_at: null,
    estimate_version: 0,
    turn_approaching_sent_at: null,
    get_ready_sent_at: null,
    called_at: null,
    release_due_at: null,
    reminder_sent_at: null,
    end_of_day_warned_at: null,
    end_of_day_choice: null,
    closing_decision: null,
    started_at: null,
    completed_at: null,
    actual_duration_minutes: null,
    cancelled_at: null,
    cancel_reason: null,
    removal_reason: null,
    no_show_at: null,
    created_by_member_id: null,
    created_at: at('09:00'),
    ...overrides,
  };
}

/** Ticket called by `memberId` at `calledAt`, release 10 min later. */
export function calledTicket(
  id: string,
  memberId: string,
  calledAt: Instant,
  overrides: Partial<TicketState> = {},
): TicketState {
  return makeTicket(id, {
    status: 'called',
    assigned_member_id: memberId,
    called_at: calledAt,
    call_count: 1,
    release_due_at: calledAt + min(10),
    ...overrides,
  });
}

/** Ticket in service with `memberId` since `startedAt`. */
export function inServiceTicket(
  id: string,
  memberId: string,
  startedAt: Instant,
  overrides: Partial<TicketState> = {},
): TicketState {
  return makeTicket(id, {
    status: 'in_service',
    assigned_member_id: memberId,
    arrived_at: startedAt,
    started_at: startedAt,
    call_count: 1,
    ...overrides,
  });
}

export interface StateInput {
  salon?: Partial<SalonState>;
  members?: readonly MemberState[];
  services?: readonly ServiceState[];
  tickets?: readonly TicketState[];
}

export function makeState(input: StateInput = {}): QueueState {
  return {
    salon: makeSalon(input.salon),
    members: input.members ?? [makeMember('ines')],
    services: input.services ?? SERVICES,
    tickets: input.tickets ?? [],
  };
}

export const member = (member_id: string): Actor => ({
  type: 'member',
  member_id,
});
export const client = (id: string): Actor => ({
  type: 'client',
  profile_id: `client-${id}`,
});
export const token = (ticket_id: string): Actor => ({
  type: 'ticket_token',
  ticket_id,
});

/** Applies a command that must succeed. */
export function ok(
  state: QueueState,
  command: Command,
  now: Instant,
): EngineOutput {
  const result = applyCommand(state, command, now);
  if (!result.ok) {
    throw new Error(`${command.command} failed with ${result.error.code}`);
  }
  return result;
}

/** Applies a command that must fail and returns its error code. */
export function fails(
  state: QueueState,
  command: Command,
  now: Instant,
): string {
  const result: CommandResult = applyCommand(state, command, now);
  if (result.ok) {
    throw new Error(`${command.command} unexpectedly succeeded`);
  }
  return result.error.code;
}

export function ticketOf(state: QueueState, id: string): TicketState {
  const ticket = state.tickets.find((t) => t.id === id);
  if (!ticket) throw new Error(`ticket ${id} not found`);
  return ticket;
}

export function memberOf(state: QueueState, id: string): MemberState {
  const found = state.members.find((m) => m.id === id);
  if (!found) throw new Error(`member ${id} not found`);
  return found;
}

// Command builders ---------------------------------------------------------

export function joinQueue(
  id: string,
  payload: Partial<Extract<Command, { command: 'join_queue' }>['payload']> = {},
  actor: Actor = client(id),
): Command {
  return {
    command: 'join_queue',
    actor,
    payload: {
      ticket_id: id,
      short_code: 'AF2K9',
      service_id: 'cut',
      requested_member_id: null,
      declared_arrival_at: null,
      channel: 'app',
      notifications_consent: true,
      has_active_ticket_elsewhere: false,
      ...payload,
    },
  };
}

export function walkIn(
  id: string,
  payload: Partial<
    Extract<Command, { command: 'register_walk_in' }>['payload']
  > = {},
  actor: Actor = member('gerant'),
): Command {
  return {
    command: 'register_walk_in',
    actor,
    payload: {
      ticket_id: id,
      short_code: 'WK2N3',
      service_id: null,
      requested_member_id: null,
      phone_has_active_ticket: false,
      ...payload,
    },
  };
}

export const callTicket = (memberId: string): Command => ({
  command: 'call_ticket',
  actor: member(memberId),
  payload: {},
});

export const confirmArrival = (
  memberId: string,
  short_code: string,
): Command => ({
  command: 'confirm_arrival',
  actor: member(memberId),
  payload: { short_code },
});

export const startService = (
  memberId: string,
  ticket_id: string,
  planned_duration_minutes = 30,
  service_id: string | null = 'cut',
): Command => ({
  command: 'start_service',
  actor: member(memberId),
  payload: { ticket_id, service_id, planned_duration_minutes },
});

export const adjustDuration = (
  memberId: string,
  ticket_id: string,
  delta_minutes: number,
): Command => ({
  command: 'adjust_duration',
  actor: member(memberId),
  payload: { ticket_id, delta_minutes },
});

export const completeService = (
  memberId: string,
  ticket_id: string,
): Command => ({
  command: 'complete_service',
  actor: member(memberId),
  payload: { ticket_id },
});

export const takeNext = (memberId: string, ticket_id: string): Command => ({
  command: 'take_next',
  actor: member(memberId),
  payload: { ticket_id },
});

export const respondEta = (
  ticket_id: string,
  response: 'on_time' | 'late' | 'cancel',
  delay_minutes: number | null = null,
  actor: Actor = token(ticket_id),
): Command => ({
  command: 'respond_eta',
  actor,
  payload: { ticket_id, response, delay_minutes },
});

export const cancelTicket = (
  ticket_id: string,
  actor: Actor = token(ticket_id),
): Command => ({
  command: 'cancel_ticket',
  actor,
  payload: { ticket_id },
});

export const removeTicket = (
  ticket_id: string,
  reason_code = 'emergency',
  actor: Actor = member('gerant'),
): Command => ({
  command: 'remove_ticket',
  actor,
  payload: { ticket_id, reason_code },
});

export const setPresence = (
  actorId: string,
  member_id: string,
  status: PresenceState['status'],
  extra: {
    break_type?: PresenceState['break_type'];
    until?: Instant | null;
    shift_end_at?: Instant | null;
  } = {},
): Command => ({
  command: 'set_presence',
  actor: member(actorId),
  payload: {
    member_id,
    status,
    break_type: extra.break_type ?? null,
    until: extra.until ?? null,
    shift_end_at: extra.shift_end_at ?? null,
  },
});

export const resolveStylistChange = (
  ticket_id: string,
  choice: 'wait' | 'first_available',
  actor: Actor = token(ticket_id),
): Command => ({
  command: 'resolve_stylist_change',
  actor,
  payload: { ticket_id, choice },
});

export const respondEndOfDay = (
  ticket_id: string,
  choice: 'stay' | 'cancel',
  actor: Actor = token(ticket_id),
): Command => ({
  command: 'respond_end_of_day',
  actor,
  payload: { ticket_id, choice },
});

export const setHairdressing = (
  is_hairdressing: boolean,
  actorId = 'gerant',
): Command => ({
  command: 'set_hairdressing',
  actor: member(actorId),
  payload: { is_hairdressing },
});

export const setQueueStatus = (
  status: 'open' | 'paused' | 'closed',
  actorId = 'gerant',
): Command => ({
  command: 'set_queue_status',
  actor: member(actorId),
  payload: { status },
});

export const resolveClosing = (
  ticket_ids: readonly string[],
  decision: 'serve' | 'cancel',
  actorId = 'gerant',
): Command => ({
  command: 'resolve_closing',
  actor: member(actorId),
  payload: { ticket_ids, decision },
});
