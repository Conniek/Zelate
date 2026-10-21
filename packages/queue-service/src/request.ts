/**
 * Validation of a `queue-command` request body (TRD §6.2). Hand-written
 * checks, no dependency: the same file runs in Node (tests) and Deno.
 *
 * Common body: `{ command, command_id, payload, tracking_token?, salon_id? }`
 * (`salon_id`: the salon a member of several salons acts in). Any
 * malformed field gives `invalid_payload`; business checks stay in the engine.
 */
import {
  REMOVAL_REASONS,
  type BreakType,
  type ClosingDecision,
  type EndOfDayChoice,
  type Instant,
  type PresenceStatus,
  type QueueStatus,
  type RemovalReason,
} from '../../queue-engine/src/index.ts';

export interface Payloads {
  join_queue: {
    salon_id: string;
    service_id: string | null;
    requested_member_id: string | null;
    declared_arrival_at: Instant | null;
    channel: 'app' | 'qr';
    notifications_consent: boolean;
    first_name: string | null;
  };
  register_walk_in: {
    first_name: string;
    phone: string;
    service_id: string | null;
    requested_member_id: string | null;
  };
  create_appointment: {
    first_name: string;
    scheduled_at: Instant;
    member_id: string;
    service_id: string | null;
    phone: string | null;
  };
  update_appointment: {
    ticket_id: string;
    scheduled_at?: Instant;
    member_id?: string;
    service_id?: string | null;
    first_name?: string;
    phone?: string;
  };
  cancel_appointment: { ticket_id: string; reason_code: RemovalReason };
  check_in_appointment: {
    salon_id: string;
    qr_token: string;
    scheduled_time: string;
    member_id: string | null;
    service_id: string | null;
    notifications_consent: boolean;
    first_name: string | null;
  };
  confirm_appointment: {
    ticket_id: string;
    decision: 'confirm' | 'reject';
    member_id?: string;
    merge_into_ticket_id?: string;
    reason_code?: RemovalReason;
  };
  respond_eta: {
    ticket_id: string;
    response: 'on_time' | 'late' | 'cancel';
    delay_minutes: number | null;
  };
  cancel_ticket: { ticket_id: string };
  resolve_stylist_change: {
    ticket_id: string;
    choice: 'wait' | 'first_available';
  };
  respond_end_of_day: { ticket_id: string; choice: EndOfDayChoice };
  set_notifications_consent: { ticket_id: string; consent: boolean };
  confirm_arrival: { short_code: string };
  call_ticket: Record<string, never>;
  start_service: {
    ticket_id: string;
    service_id: string | null;
    planned_duration_minutes: number;
  };
  adjust_duration: { ticket_id: string; delta_minutes: number };
  complete_service: { ticket_id: string };
  take_next: { ticket_id: string };
  remove_ticket: {
    ticket_id: string;
    reason_code: RemovalReason;
    note: string | null;
  };
  reassign_ticket: { ticket_id: string; member_id: string };
  respond_reassignment: { ticket_id: string; choice: 'accept' | 'refuse' };
  set_presence: {
    member_id: string;
    status: PresenceStatus;
    break_type: BreakType | null;
    until: Instant | null;
    shift_end_at: Instant | null;
  };
  set_hairdressing: { is_hairdressing: boolean };
  set_queue_status: { salon_id: string; status: QueueStatus };
  resolve_closing: { ticket_ids: string[]; decision: ClosingDecision };
  create_test_ticket: { salon_id: string };
  publish_salon: { salon_id: string };
}

export type CommandName = keyof Payloads;

export type ParsedRequest = {
  [K in CommandName]: {
    readonly command: K;
    readonly command_id: string;
    readonly tracking_token: string | null;
    /** Body-level salon of a member of several salons (DEV-5). */
    readonly salon_id: string | null;
    readonly payload: Payloads[K];
  };
}[CommandName];

// ---------------------------------------------------------------------------
// Field readers: each throws Invalid, caught once by parseRequest.
// ---------------------------------------------------------------------------

class Invalid extends Error {}

type Fields = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function present(p: Fields, key: string): boolean {
  return p[key] !== undefined && p[key] !== null;
}

function uuid(p: Fields, key: string): string {
  const v = p[key];
  if (typeof v !== 'string' || !UUID.test(v)) throw new Invalid();
  return v.toLowerCase();
}

function optUuid(p: Fields, key: string): string | null {
  return present(p, key) ? uuid(p, key) : null;
}

function text(p: Fields, key: string, min: number, max: number): string {
  const v = p[key];
  if (typeof v !== 'string') throw new Invalid();
  const trimmed = v.trim();
  if (trimmed.length < min || trimmed.length > max) throw new Invalid();
  return trimmed;
}

function optText(p: Fields, key: string, min: number, max: number) {
  return present(p, key) ? text(p, key, min, max) : null;
}

function bool(p: Fields, key: string, fallback?: boolean): boolean {
  const v = p[key];
  if (v === undefined && fallback !== undefined) return fallback;
  if (typeof v !== 'boolean') throw new Invalid();
  return v;
}

function int(p: Fields, key: string, min: number, max: number): number {
  const v = p[key];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) {
    throw new Invalid();
  }
  return v;
}

function instant(p: Fields, key: string): Instant {
  const v = p[key];
  // An explicit offset is required: a naive time would be read in UTC.
  if (typeof v !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/.test(v)) {
    throw new Invalid();
  }
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) throw new Invalid();
  return ms;
}

function optInstant(p: Fields, key: string): Instant | null {
  return present(p, key) ? instant(p, key) : null;
}

function oneOf<T extends string>(
  p: Fields,
  key: string,
  values: readonly T[],
): T {
  const v = p[key];
  if (typeof v !== 'string' || !(values as readonly string[]).includes(v)) {
    throw new Invalid();
  }
  return v as T;
}

const firstName = (p: Fields) => text(p, 'first_name', 1, 30);
const optFirstName = (p: Fields) => optText(p, 'first_name', 1, 30);
const ticketId = (p: Fields) => uuid(p, 'ticket_id');
const removalReason = (p: Fields) => oneOf(p, 'reason_code', REMOVAL_REASONS);

const PRESENCE_STATUSES: readonly PresenceStatus[] = [
  'offline',
  'available',
  'in_service',
  'on_break',
  'late',
  'absent',
  'off_duty',
];

type Parsers = { [K in CommandName]: (p: Fields) => Payloads[K] };

const PARSERS: Parsers = {
  join_queue: (p) => ({
    salon_id: uuid(p, 'salon_id'),
    // `unknown_service: true` or a missing service_id: « je ne sais pas encore » (E12).
    service_id: p.unknown_service === true ? null : optUuid(p, 'service_id'),
    requested_member_id: optUuid(p, 'requested_member_id'),
    declared_arrival_at: optInstant(p, 'declared_arrival_at'),
    channel: oneOf(p, 'channel', ['app', 'qr'] as const),
    notifications_consent: bool(p, 'notifications_consent', false),
    first_name: optFirstName(p),
  }),
  register_walk_in: (p) => ({
    first_name: firstName(p),
    phone: text(p, 'phone', 6, 30),
    service_id: optUuid(p, 'service_id'),
    requested_member_id: optUuid(p, 'requested_member_id'),
  }),
  create_appointment: (p) => ({
    first_name: firstName(p),
    scheduled_at: instant(p, 'scheduled_at'),
    member_id: uuid(p, 'member_id'),
    service_id: optUuid(p, 'service_id'),
    phone: optText(p, 'phone', 6, 30),
  }),
  update_appointment: (p) => {
    const out: Payloads['update_appointment'] = { ticket_id: ticketId(p) };
    if (present(p, 'scheduled_at'))
      out.scheduled_at = instant(p, 'scheduled_at');
    if (present(p, 'member_id')) out.member_id = uuid(p, 'member_id');
    if ('service_id' in p) out.service_id = optUuid(p, 'service_id');
    if (present(p, 'first_name')) out.first_name = firstName(p);
    if (present(p, 'phone')) out.phone = text(p, 'phone', 6, 30);
    return out;
  },
  cancel_appointment: (p) => ({
    ticket_id: ticketId(p),
    reason_code: removalReason(p),
  }),
  check_in_appointment: (p) => {
    const time = text(p, 'scheduled_time', 5, 5);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Invalid();
    return {
      salon_id: uuid(p, 'salon_id'),
      qr_token: text(p, 'qr_token', 1, 128),
      scheduled_time: time,
      member_id: optUuid(p, 'member_id'),
      service_id: optUuid(p, 'service_id'),
      notifications_consent: bool(p, 'notifications_consent', false),
      first_name: optFirstName(p),
    };
  },
  confirm_appointment: (p) => {
    const decision = oneOf(p, 'decision', ['confirm', 'reject'] as const);
    const out: Payloads['confirm_appointment'] = {
      ticket_id: ticketId(p),
      decision,
    };
    if (present(p, 'member_id')) out.member_id = uuid(p, 'member_id');
    if (present(p, 'merge_into_ticket_id')) {
      out.merge_into_ticket_id = uuid(p, 'merge_into_ticket_id');
    }
    // E29: a refusal always carries a reason.
    if (decision === 'reject' || present(p, 'reason_code')) {
      out.reason_code = removalReason(p);
    }
    return out;
  },
  respond_eta: (p) => ({
    ticket_id: ticketId(p),
    response: oneOf(p, 'response', ['on_time', 'late', 'cancel'] as const),
    // Range 5 to 30 is the engine's `invalid_delay`.
    delay_minutes: present(p, 'delay_minutes')
      ? int(p, 'delay_minutes', -1000, 1000)
      : null,
  }),
  cancel_ticket: (p) => ({ ticket_id: ticketId(p) }),
  resolve_stylist_change: (p) => ({
    ticket_id: ticketId(p),
    choice: oneOf(p, 'choice', ['wait', 'first_available'] as const),
  }),
  respond_end_of_day: (p) => ({
    ticket_id: ticketId(p),
    choice: oneOf(p, 'choice', ['stay', 'cancel'] as const),
  }),
  set_notifications_consent: (p) => ({
    ticket_id: ticketId(p),
    consent: bool(p, 'consent'),
  }),
  confirm_arrival: (p) => ({
    short_code: text(p, 'short_code', 5, 5).toUpperCase(),
  }),
  call_ticket: () => ({}),
  start_service: (p) => ({
    ticket_id: ticketId(p),
    service_id: optUuid(p, 'service_id'),
    planned_duration_minutes: int(p, 'planned_duration_minutes', 5, 240),
  }),
  adjust_duration: (p) => {
    const delta = int(p, 'delta_minutes', 5, 45);
    if (![5, 15, 30, 45].includes(delta)) throw new Invalid();
    return { ticket_id: ticketId(p), delta_minutes: delta };
  },
  complete_service: (p) => ({ ticket_id: ticketId(p) }),
  take_next: (p) => ({ ticket_id: ticketId(p) }),
  remove_ticket: (p) => ({
    ticket_id: ticketId(p),
    reason_code: removalReason(p),
    note: optText(p, 'note', 0, 200),
  }),
  reassign_ticket: (p) => ({
    ticket_id: ticketId(p),
    member_id: uuid(p, 'member_id'),
  }),
  respond_reassignment: (p) => ({
    ticket_id: ticketId(p),
    choice: oneOf(p, 'choice', ['accept', 'refuse'] as const),
  }),
  set_presence: (p) => ({
    member_id: uuid(p, 'member_id'),
    status: oneOf(p, 'status', PRESENCE_STATUSES),
    break_type: present(p, 'break_type')
      ? oneOf(p, 'break_type', ['meal', 'short', 'unexpected'] as const)
      : null,
    until: optInstant(p, 'until'),
    shift_end_at: optInstant(p, 'shift_end_at'),
  }),
  set_hairdressing: (p) => ({ is_hairdressing: bool(p, 'is_hairdressing') }),
  set_queue_status: (p) => ({
    salon_id: uuid(p, 'salon_id'),
    status: oneOf(p, 'status', ['open', 'paused', 'closed'] as const),
  }),
  resolve_closing: (p) => {
    const ids = p.ticket_ids;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) {
      throw new Invalid();
    }
    return {
      ticket_ids: [...new Set(ids.map((id) => uuid({ id }, 'id')))],
      decision: oneOf(p, 'decision', ['serve', 'cancel'] as const),
    };
  },
  create_test_ticket: (p) => ({ salon_id: uuid(p, 'salon_id') }),
  publish_salon: (p) => ({ salon_id: uuid(p, 'salon_id') }),
};

export const COMMAND_NAMES = Object.keys(PARSERS) as CommandName[];

function isFields(v: unknown): v is Fields {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function parseRequest(body: unknown): ParsedRequest | null {
  if (!isFields(body)) return null;
  const { command, command_id, payload, tracking_token, salon_id } = body;
  if (
    salon_id !== undefined &&
    salon_id !== null &&
    (typeof salon_id !== 'string' || !UUID.test(salon_id))
  ) {
    return null;
  }
  if (typeof command !== 'string' || !(command in PARSERS)) return null;
  if (typeof command_id !== 'string' || !UUID.test(command_id)) return null;
  if (payload !== undefined && !isFields(payload)) return null;
  if (
    tracking_token !== undefined &&
    tracking_token !== null &&
    (typeof tracking_token !== 'string' ||
      !/^[A-Za-z0-9_-]{20,64}$/.test(tracking_token))
  ) {
    return null;
  }
  try {
    const parse = PARSERS[command as CommandName] as (p: Fields) => unknown;
    return {
      command,
      command_id: command_id.toLowerCase(),
      tracking_token: (tracking_token as string | undefined) ?? null,
      salon_id: typeof salon_id === 'string' ? salon_id.toLowerCase() : null,
      payload: parse(payload ?? {}),
    } as ParsedRequest;
  } catch (error) {
    if (error instanceof Invalid) return null;
    throw error;
  }
}
