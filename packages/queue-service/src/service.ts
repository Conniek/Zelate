/**
 * `queue-command` (TRD §6.2) without HTTP or SQL: resolves who is calling,
 * takes the salon lock, replays a known `command_id` (ADR-004), prepares what
 * the engine leaves to its caller (ids, codes, phone checks, QR, K15 limit,
 * first profile), runs the engine and hands one write set to the database
 * (ADR-003, BACKEND_SCHEMA §8.2).
 */
import {
  applyCommand,
  computeSchedule,
  detectTimeTriggers,
  findNextFreeSlots,
  isActiveStatus,
  newTicket,
  type Actor,
  type Command,
  type EngineOutput,
  type Instant,
  type QueueErrorCode,
  type QueueState,
  type TicketState,
} from '../../queue-engine/src/index.ts';
import { normalizeFrenchMobile } from '../../auth-policy/src/phone.ts';
import proManager from '../../i18n/src/fr/pro-manager.json' with { type: 'json' };
import { diffStates, iso, ticketColumns, toState } from './mapping.ts';
import type {
  Broadcast,
  ContactMove,
  ContactReplace,
  DayData,
  DbValue,
  EventRow,
  FreeSlotRow,
  MemberRecord,
  MemberRef,
  NewContact,
  NotificationRow,
  QueueDb,
  QueueTx,
  StoredResponse,
  TicketUpdate,
  WriteSet,
} from './ports.ts';
import type { PhoneHasher, Random } from './random.ts';
import {
  isUuid,
  parseRequest,
  type CommandName,
  type ParsedRequest,
} from './request.ts';
import { isoWeekday, parisDate, parisInstant, serviceDayOf } from './time.ts';

export type ServiceErrorCode =
  | QueueErrorCode
  | 'rate_limited'
  | 'invalid_phone'
  | 'invalid_qr_token'
  | 'salon_not_ready'
  | 'salon_already_published';

export interface QueueServiceDeps {
  readonly db: QueueDb;
  readonly clock: () => Instant;
  readonly random: Random;
  readonly phones: PhoneHasher;
}

/** Profile of the verified session, or null without session. */
export interface Caller {
  readonly profileId: string | null;
}

export type CommandResponse = StoredResponse;

const HOUR = 60 * 60 * 1000;
/** K15: appointments entered per hour and per salon. */
export const APPOINTMENTS_PER_HOUR = 60;

// ---------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------

const STATUS: Partial<Record<ServiceErrorCode, number>> = {
  invalid_payload: 400,
  forbidden: 403,
  rate_limited: 429,
};

export function errorResponse(
  code: ServiceErrorCode,
  details?: Record<string, unknown>,
): CommandResponse {
  return {
    status: STATUS[code] ?? 409,
    body: {
      ok: false,
      error: {
        code,
        messageKey: `errors.queue.${code}`,
        ...(details ? { details } : {}),
      },
    },
  };
}

function okResponse(data: Record<string, unknown>): CommandResponse {
  return { status: 200, body: { ok: true, data } };
}

const UNAUTHENTICATED: CommandResponse = {
  ...errorResponse('forbidden'),
  status: 401,
};

// ---------------------------------------------------------------------------
// Who is calling (TRD §6.2 « Contexte autorisé »)
// ---------------------------------------------------------------------------

const CLIENT_SESSION: ReadonlySet<CommandName> = new Set([
  'join_queue',
  'check_in_appointment',
]);

const CLIENT_OR_TOKEN: ReadonlySet<CommandName> = new Set([
  'respond_eta',
  'cancel_ticket',
  'resolve_stylist_change',
  'respond_end_of_day',
  'respond_reassignment',
  'set_notifications_consent',
]);

interface Context {
  readonly salonId: string;
  readonly actor: Actor;
  readonly member: MemberRef | null;
  readonly profileId: string | null;
}

function payloadField(req: ParsedRequest, key: string): string | null {
  const value = (req.payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

async function resolveContext(
  tx: QueueTx,
  req: ParsedRequest,
  caller: Caller,
): Promise<Context | CommandResponse> {
  if (CLIENT_SESSION.has(req.command)) {
    if (!caller.profileId) return UNAUTHENTICATED;
    return {
      salonId: payloadField(req, 'salon_id')!,
      actor: { type: 'client', profile_id: caller.profileId },
      member: null,
      profileId: caller.profileId,
    };
  }

  if (CLIENT_OR_TOKEN.has(req.command)) {
    const ticketId = payloadField(req, 'ticket_id')!;
    if (req.tracking_token) {
      const ref = await tx.ticketByToken(req.tracking_token);
      if (!ref || ref.ticket_id !== ticketId) return errorResponse('forbidden');
      return {
        salonId: ref.salon_id,
        actor: { type: 'ticket_token', ticket_id: ref.ticket_id },
        member: null,
        profileId: null,
      };
    }
    if (!caller.profileId) return UNAUTHENTICATED;
    const ref = await tx.ticketRef(ticketId);
    // Same answer for an unknown ticket and someone else's (no probing).
    if (!ref || ref.client_id !== caller.profileId) {
      return errorResponse('forbidden');
    }
    return {
      salonId: ref.salon_id,
      actor: { type: 'client', profile_id: caller.profileId },
      member: null,
      profileId: caller.profileId,
    };
  }

  // Salon members: active memberships only (ADR-019).
  if (!caller.profileId) return UNAUTHENTICATED;
  const memberships = await tx.memberships(caller.profileId);
  if (memberships.length === 0) return errorResponse('forbidden');
  let member = memberships[0]!;
  let salonId = payloadField(req, 'salon_id') ?? req.salon_id;
  if (!salonId && req.command === 'set_presence') {
    // The salon of the member whose status changes.
    salonId = await tx.memberSalon(req.payload.member_id);
    if (!salonId) return errorResponse('forbidden');
  }
  if (salonId) {
    const match = memberships.find((m) => m.salon_id === salonId);
    if (!match) return errorResponse('forbidden');
    member = match;
  } else if (memberships.length > 1) {
    // Several salons: follow the ticket. A ticket of a salon the caller does
    // not belong to is never loaded (the engine answers from his own salon).
    // Without ticket, the body must say which salon: never guess.
    const ticketId = payloadField(req, 'ticket_id');
    if (!ticketId) return errorResponse('invalid_payload');
    const ref = await tx.ticketRef(ticketId);
    member = memberships.find((m) => m.salon_id === ref?.salon_id) ?? member;
  }
  return {
    salonId: member.salon_id,
    actor: { type: 'member', member_id: member.member_id },
    member,
    profileId: caller.profileId,
  };
}

// ---------------------------------------------------------------------------
// Preparation of one command
// ---------------------------------------------------------------------------

/** What a command adds to the engine's writes. */
interface Extras {
  profile?: { id: string; first_name: string };
  profileConsent?: { id: string; tracking_consent_at: string | null };
  displayNames: Map<string, string>;
  ticketColumns: Map<string, Record<string, DbValue>>;
  newContacts: NewContact[];
  contactMoves: ContactMove[];
  contactReplaces: ContactReplace[];
  staffNotifications: NotificationRow[];
  broadcasts: Broadcast[];
  salon: Record<string, DbValue>;
  data: Record<string, unknown>;
  /**
   * Checks on phone numbers, run only once the engine has accepted the
   * command (ticket, status and caller checked): before that, they would let
   * any member test whether a number is queued somewhere (H6).
   */
  afterEngine: (() => Promise<CommandResponse | null>)[];
}

function emptyExtras(): Extras {
  return {
    displayNames: new Map(),
    ticketColumns: new Map(),
    newContacts: [],
    contactMoves: [],
    contactReplaces: [],
    staffNotifications: [],
    broadcasts: [],
    salon: {},
    data: {},
    afterEngine: [],
  };
}

interface Run {
  readonly tx: QueueTx;
  readonly deps: QueueServiceDeps;
  readonly ctx: Context;
  readonly day: DayData;
  readonly state: QueueState;
  readonly now: Instant;
  readonly serviceDate: string;
  readonly extras: Extras;
}

type Prepared = Command | CommandResponse;

/** A ticket code unused today in this salon (H7). */
function freeShortCode(run: Run): string {
  const taken = new Set(run.state.tickets.map((t) => t.short_code));
  for (;;) {
    const code = run.deps.random.shortCode();
    if (!taken.has(code)) return code;
  }
}

/** New ticket identifiers, display name and tracking secrets (ADR-006). */
function newIds(run: Run, displayName: string) {
  const ticket_id = run.deps.random.uuid();
  run.extras.displayNames.set(ticket_id, displayName);
  run.extras.ticketColumns.set(ticket_id, {
    tracking_token: run.deps.random.trackingToken(),
    tracking_short_code: run.deps.random.trackingShortCode(),
  });
  const short_code = freeShortCode(run);
  run.extras.data.ticket_id = ticket_id;
  run.extras.data.short_code = short_code;
  return { ticket_id, short_code };
}

/** K30: the client's first name, creating the profile at the first ticket. */
async function clientFirstName(
  run: Run,
  given: string | null,
): Promise<string | CommandResponse> {
  const profileId = run.ctx.profileId!;
  const existing = await run.tx.profileFirstName(profileId);
  if (existing !== null) return existing;
  if (!given) return errorResponse('invalid_payload');
  run.extras.profile = { id: profileId, first_name: given };
  return given;
}

interface ClientPhone {
  readonly e164: string;
  readonly hash: Uint8Array;
  readonly activeSalons: string[];
}

async function clientPhone(run: Run): Promise<ClientPhone | CommandResponse> {
  const e164 = await run.tx.authPhone(run.ctx.profileId!);
  if (!e164) return errorResponse('forbidden');
  const hash = await run.deps.phones.hash(e164);
  return {
    e164,
    hash,
    activeSalons: await run.tx.salonsWithActivePhone(hash, null),
  };
}

type Prepare<K extends CommandName> = (
  run: Run,
  req: Extract<ParsedRequest, { command: K }>,
  phone: PreparedPhone | null,
) => Promise<Prepared>;

const passThrough =
  <K extends CommandName>(): Prepare<K> =>
  async (run, req) =>
    ({
      command: req.command,
      actor: run.ctx.actor,
      payload: req.payload,
    }) as unknown as Command;

const PREPARE: { [K in CommandName]?: Prepare<K> } = {
  async join_queue(run, req) {
    const p = req.payload;
    const firstName = await clientFirstName(run, p.first_name);
    if (typeof firstName !== 'string') return firstName;
    const phone = await clientPhone(run);
    if ('status' in phone) return phone;
    const active = await run.tx.activeTicketOfClient(run.ctx.profileId!);
    const { ticket_id, short_code } = newIds(run, firstName);
    run.extras.newContacts.push({
      ticket_id,
      phone_e164: phone.e164,
      phone_hash: phone.hash,
      is_pending_confirmation: false,
    });
    return {
      command: 'join_queue',
      actor: run.ctx.actor,
      payload: {
        ticket_id,
        short_code,
        service_id: p.service_id,
        requested_member_id: p.requested_member_id,
        declared_arrival_at: p.declared_arrival_at,
        channel: p.channel,
        notifications_consent: p.notifications_consent,
        // One active ticket per client and per number, every salon (ADR-011).
        has_active_ticket_elsewhere:
          active !== null || phone.activeSalons.length > 0,
      },
    };
  },

  async register_walk_in(run, req, phone) {
    const p = req.payload;
    const { ticket_id, short_code } = newIds(run, p.first_name);
    const activeSalons = await run.tx.salonsWithActivePhone(phone!.hash, null);
    run.extras.newContacts.push({
      ticket_id,
      phone_e164: phone!.e164,
      phone_hash: phone!.hash,
      is_pending_confirmation: false,
    });
    return {
      command: 'register_walk_in',
      actor: run.ctx.actor,
      payload: {
        ticket_id,
        short_code,
        service_id: p.service_id,
        requested_member_id: p.requested_member_id,
        phone_has_active_ticket: activeSalons.length > 0,
      },
    };
  },

  async create_appointment(run, req, phone) {
    const p = req.payload;
    const recent = await run.tx.appointmentsCreatedSince(
      run.ctx.salonId,
      run.now - HOUR,
    );
    if (recent >= APPOINTMENTS_PER_HOUR) return errorResponse('rate_limited');
    const { ticket_id, short_code } = newIds(run, p.first_name);
    let active = false;
    if (phone) {
      active =
        (await run.tx.salonsWithActivePhone(phone.hash, null)).length > 0;
      run.extras.newContacts.push({
        ticket_id,
        phone_e164: phone.e164,
        phone_hash: phone.hash,
        is_pending_confirmation: false,
      });
    }
    return {
      command: 'create_appointment',
      actor: run.ctx.actor,
      payload: {
        ticket_id,
        short_code,
        scheduled_at: p.scheduled_at,
        member_id: p.member_id,
        service_id: p.service_id,
        phone_has_active_ticket: active,
      },
    };
  },

  async update_appointment(run, req, phone) {
    const { first_name } = req.payload;
    // The engine knows neither names nor numbers.
    const payload = { ...req.payload };
    delete payload.first_name;
    delete payload.phone;
    if (phone) {
      run.extras.afterEngine.push(async () => {
        const others = await run.tx.salonsWithActivePhone(
          phone.hash,
          payload.ticket_id,
        );
        if (others.length > 0)
          return errorResponse('already_has_active_ticket');
        run.extras.contactReplaces.push({
          ticket_id: payload.ticket_id,
          phone_e164: phone.e164,
          phone_hash: phone.hash,
        });
        return null;
      });
    }
    if (first_name) run.extras.displayNames.set(payload.ticket_id, first_name);
    return { command: 'update_appointment', actor: run.ctx.actor, payload };
  },

  async check_in_appointment(run, req) {
    const p = req.payload;
    if (p.qr_token !== run.day.salon.qr_token) {
      return errorResponse('invalid_qr_token');
    }
    const firstName = await clientFirstName(run, p.first_name);
    if (typeof firstName !== 'string') return firstName;
    const phone = await clientPhone(run);
    if ('status' in phone) return phone;
    const active = await run.tx.activeTicketOfClient(run.ctx.profileId!);
    const { ticket_id, short_code } = newIds(run, firstName);
    run.extras.newContacts.push({
      ticket_id,
      phone_e164: phone.e164,
      phone_hash: phone.hash,
      is_pending_confirmation: true,
    });
    const scheduled_at = parisInstant(run.serviceDate, p.scheduled_time);
    // K21: push to the managers and to the chosen stylist, one key each.
    const recipients = new Set(
      run.day.members
        .filter((m) => m.status === 'active' && m.role === 'manager')
        .map((m) => m.id),
    );
    if (p.member_id) recipients.add(p.member_id);
    for (const member_id of recipients) {
      run.extras.staffNotifications.push({
        ticket_id,
        recipient_profile_id: null,
        recipient_member_id: member_id,
        channel: 'push',
        template: 'appointment_checked_in',
        // Names are added by the sender from the ticket, like for clients.
        params: { scheduled_at: iso(scheduled_at) },
        dedupe_key: `appointment_checked_in:${member_id}`,
        requires_consent: false,
      });
    }
    run.extras.broadcasts.push({ kind: 'salon', event: 'appointment_pending' });
    return {
      command: 'check_in_appointment',
      actor: run.ctx.actor,
      payload: {
        ticket_id,
        short_code,
        scheduled_at,
        member_id: p.member_id,
        service_id: p.service_id,
        notifications_consent: p.notifications_consent,
        // K14: a number already known here is merged by the salon, not refused.
        has_active_ticket_elsewhere:
          (active !== null && active.salon_id !== run.ctx.salonId) ||
          phone.activeSalons.some((s) => s !== run.ctx.salonId),
      },
    };
  },

  async confirm_appointment(run, req) {
    const p = req.payload;
    if (p.decision === 'confirm') {
      if (p.merge_into_ticket_id) {
        run.extras.contactMoves.push({
          from_ticket_id: p.ticket_id,
          to_ticket_id: p.merge_into_ticket_id,
        });
      } else {
        // Without merge, the number must not already hold an active ticket
        // (unique index of ADR-011).
        run.extras.afterEngine.push(async () => {
          const hash = await run.tx.contactHash(p.ticket_id);
          return hash &&
            (await run.tx.salonsWithActivePhone(hash, p.ticket_id)).length > 0
            ? errorResponse('already_has_active_ticket')
            : null;
        });
      }
    }
    return { command: 'confirm_appointment', actor: run.ctx.actor, payload: p };
  },

  async remove_ticket(run, req) {
    const { note, ...payload } = req.payload;
    if (note) {
      // K10: the note lives on the ticket, never in the audit log.
      run.extras.ticketColumns.set(payload.ticket_id, { removal_note: note });
    }
    return { command: 'remove_ticket', actor: run.ctx.actor, payload };
  },

  async set_queue_status(run, req) {
    return {
      command: 'set_queue_status',
      actor: run.ctx.actor,
      payload: { status: req.payload.status },
    };
  },

  respond_eta: passThrough(),
  cancel_ticket: passThrough(),
  cancel_appointment: passThrough(),
  resolve_stylist_change: passThrough(),
  respond_end_of_day: passThrough(),
  respond_reassignment: passThrough(),
  confirm_arrival: passThrough(),
  call_ticket: passThrough(),
  start_service: passThrough(),
  adjust_duration: passThrough(),
  complete_service: passThrough(),
  take_next: passThrough(),
  reassign_ticket: passThrough(),
  set_presence: passThrough(),
  set_hairdressing: passThrough(),
  resolve_closing: passThrough(),
};

// ---------------------------------------------------------------------------
// Commands outside the engine (K24, K34, K35)
// ---------------------------------------------------------------------------

interface Outcome {
  readonly output: EngineOutput;
  readonly extraEvents: EventRow[];
  /** Only the ticket channels hear about it (a change the salon cannot see). */
  readonly ticketBroadcastsOnly?: boolean;
}

function unchanged(state: QueueState): EngineOutput {
  return { state, events: [], notifications: [] };
}

function bumpVersion(state: QueueState): QueueState {
  return {
    ...state,
    salon: { ...state.salon, queue_version: state.salon.queue_version + 1 },
  };
}

function isManager(run: Run): boolean {
  return run.ctx.member?.role === 'manager';
}

function setNotificationsConsent(
  run: Run,
  req: Extract<ParsedRequest, { command: 'set_notifications_consent' }>,
): Outcome | CommandResponse {
  const ticket = run.state.tickets.find((t) => t.id === req.payload.ticket_id);
  if (!ticket || !isActiveStatus(ticket.status)) {
    return errorResponse('invalid_transition');
  }
  const consentAt = req.payload.consent ? run.now : null;
  if (run.ctx.actor.type === 'client') {
    run.extras.profileConsent = {
      id: run.ctx.actor.profile_id,
      tracking_consent_at: consentAt === null ? null : iso(consentAt),
    };
  }
  if (ticket.notifications_consent_at === consentAt) {
    return { output: unchanged(run.state), extraEvents: [] };
  }
  const state: QueueState = bumpVersion({
    ...run.state,
    tickets: run.state.tickets.map((t) =>
      t.id === ticket.id ? { ...t, notifications_consent_at: consentAt } : t,
    ),
  });
  return {
    output: { state, events: [], notifications: [] },
    extraEvents: [],
    ticketBroadcastsOnly: true,
  };
}

function createTestTicket(run: Run): Outcome | CommandResponse {
  if (!isManager(run)) return errorResponse('forbidden');
  if (run.day.salon.status === 'published') {
    return errorResponse('salon_already_published');
  }
  const running = run.state.tickets.find(
    (t) => t.is_test && isActiveStatus(t.status),
  );
  if (running) {
    run.extras.data.ticket_id = running.id;
    run.extras.data.short_code = running.short_code;
    return { output: unchanged(run.state), extraEvents: [] };
  }
  // The fictitious client is named from the dictionary (K24), never in code.
  const { ticket_id, short_code } = newIds(
    run,
    proManager.setup.test.ticket_name,
  );
  const rank = Math.max(0, ...run.state.tickets.map((t) => t.queue_rank)) + 1;
  const ticket: TicketState = {
    ...newTicket({
      id: ticket_id,
      service_date: run.serviceDate,
      short_code,
      client_id: null,
      channel: 'front_desk',
      service_id: null,
      planned_duration_minutes: 30,
      requested_member_id: null,
      queue_rank: rank,
      declared_arrival_at: null,
      notifications_consent_at: null,
      created_by_member_id: run.ctx.member!.member_id,
      created_at: run.now,
    }),
    is_test: true,
  };
  // Estimated stylist and time at once, so that the test client shows in a
  // stylist's queue straight away (ADR-015).
  const added: QueueState = {
    ...run.state,
    tickets: [...run.state.tickets, ticket],
  };
  const estimate = computeSchedule(added, run.now).tickets[ticket_id];
  const state = bumpVersion({
    ...added,
    tickets: added.tickets.map((t) =>
      t.id === ticket_id && estimate
        ? {
            ...t,
            estimated_start_at: estimate.estimated_start_at,
            estimated_member_id: estimate.estimated_member_id,
            last_notified_start_at: estimate.estimated_start_at,
          }
        : t,
    ),
  });
  return {
    output: {
      state,
      events: [
        {
          scope: 'ticket',
          type: 'created',
          ticket_id,
          actor_type: 'manager',
          actor_member_id: run.ctx.member!.member_id,
          actor_profile_id: null,
          reason_code: null,
        },
      ],
      notifications: [],
    },
    extraEvents: [],
  };
}

type PublishMissing =
  | 'verification'
  | 'setup_test'
  | 'opening_hours'
  | 'active_stylist'
  | 'active_service';

function publishSalon(run: Run): Outcome | CommandResponse {
  if (!isManager(run)) return errorResponse('forbidden');
  const salon = run.day.salon;
  if (salon.status === 'published') {
    return errorResponse('salon_already_published');
  }
  const missing: PublishMissing[] = [];
  if (salon.status !== 'approved') missing.push('verification');
  if (salon.setup_test_passed_at === null) missing.push('setup_test');
  if (salon.opening_hours_count === 0) missing.push('opening_hours');
  if (
    !run.day.members.some((m) => m.status === 'active' && m.is_hairdressing)
  ) {
    missing.push('active_stylist');
  }
  if (!run.day.services.some((s) => s.is_active))
    missing.push('active_service');
  if (missing.length > 0) return errorResponse('salon_not_ready', { missing });

  run.extras.salon.status = 'published';
  run.extras.salon.published_at = iso(run.now);
  const state = bumpVersion({
    ...run.state,
    salon: { ...run.state.salon, status: 'published' },
  });
  return {
    output: { state, events: [], notifications: [] },
    extraEvents: [
      {
        scope: 'salon',
        type: 'published',
        subject_member_id: null,
        actor_type: 'manager',
        actor_member_id: run.ctx.member!.member_id,
        actor_profile_id: null,
        reason_code: null,
        command_id: null,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

function clientNotifications(output: EngineOutput): NotificationRow[] {
  const tickets = new Map(output.state.tickets.map((t) => [t.id, t]));
  const rows: NotificationRow[] = [];
  for (const intent of output.notifications) {
    const params: Record<string, DbValue> = { ...intent.params };
    if (intent.variant) params.variant = intent.variant;
    // K19: send-notifications writes this column once the message leaves.
    if (intent.on_sent) {
      params.on_sent_last_notified_start_at = iso(
        intent.on_sent.last_notified_start_at,
      );
    }
    // Push first, SMS as fallback: send-notifications skips the SMS when a
    // push subscription is active, except « votre tour » (E1).
    for (const channel of ['push', 'sms'] as const) {
      rows.push({
        ticket_id: intent.ticket_id,
        recipient_profile_id: tickets.get(intent.ticket_id)?.client_id ?? null,
        recipient_member_id: null,
        channel,
        template: intent.template,
        params,
        dedupe_key: intent.dedupe_key,
        requires_consent: intent.requires_consent,
      });
    }
  }
  return rows;
}

const MINUTE = 60_000;

/**
 * Two slot lists are the same when every service starts at the same minute,
 * or « now » in both (a slot at or before the next minute): a free stylist's
 * slot follows the clock and must not be rewritten every minute. The
 * interface shows a past or current `start_at` as « maintenant ».
 */
function sameSlots(
  stored: readonly FreeSlotRow[],
  computed: readonly FreeSlotRow[],
  now: Instant,
): boolean {
  const soon = now + MINUTE;
  return (
    stored.length === computed.length &&
    stored.every((s, i) => {
      const a = Date.parse(s.start_at);
      const b = Date.parse(computed[i]!.start_at);
      return (
        s.service_id === computed[i]!.service_id &&
        (a === b || (a <= soon && b <= soon))
      );
    })
  );
}

function buildWrites(
  run: Run,
  outcome: Outcome,
  commandId: string | null,
): WriteSet {
  const { output } = outcome;
  const { extras } = run;
  const diff = diffStates(
    run.state,
    output.state,
    run.ctx.member?.member_id ?? null,
  );

  // Columns the engine does not know: names, secrets, note (never in events).
  const ticketUpdates: TicketUpdate[] = diff.ticket_updates.map((u) => ({
    id: u.id,
    columns: { ...u.columns, ...(extras.ticketColumns.get(u.id) ?? {}) },
  }));
  const updated = new Set(ticketUpdates.map((u) => u.id));
  const isNew = new Set(diff.new_tickets.map((t) => t.id));
  for (const [id, columns] of extras.ticketColumns) {
    if (!updated.has(id) && !isNew.has(id)) ticketUpdates.push({ id, columns });
  }
  for (const [id, name] of extras.displayNames) {
    if (isNew.has(id)) continue;
    const update = ticketUpdates.find((u) => u.id === id);
    if (update) {
      ticketUpdates[ticketUpdates.indexOf(update)] = {
        id,
        columns: { ...update.columns, display_name: name },
      };
    } else {
      ticketUpdates.push({ id, columns: { display_name: name } });
    }
  }

  const extraChanged =
    ticketUpdates.length > diff.ticket_updates.length ||
    extras.contactReplaces.length > 0;
  let version = output.state.salon.queue_version;
  const salon: Record<string, DbValue> = { ...diff.salon, ...extras.salon };
  const broadcasts: Broadcast[] = [...diff.broadcasts, ...extras.broadcasts];
  if (extraChanged && !diff.changed) {
    // A name or a phone changed without any engine change: still a new
    // version, so that every screen reads again.
    version += 1;
    salon.queue_version = version;
    broadcasts.unshift(
      { kind: 'salon', event: 'queue_updated' },
      ...ticketUpdates.map((u): Broadcast => ({
        kind: 'ticket',
        ticket_id: u.id,
        status:
          output.state.tickets.find((t) => t.id === u.id)?.status ?? 'waiting',
      })),
    );
  }

  // ADR-017: next free slot per service, without the stylist. It moves with
  // time too, so it is compared with the stored one at every pass.
  // Rounded up to the minute: no millisecond noise in the stored value.
  const slots: FreeSlotRow[] = findNextFreeSlots(output.state, run.now).map(
    (s) => ({
      service_id: s.service_id,
      start_at: iso(Math.ceil(s.start_at / MINUTE) * MINUTE),
    }),
  );
  if (!sameSlots(run.day.salon.next_free_slots, slots, run.now)) {
    salon.next_free_slots = JSON.stringify(slots);
    if (!diff.changed && !extraChanged) {
      // A new version, so that public pages read the new slot again.
      version += 1;
      salon.queue_version = version;
      broadcasts.push({ kind: 'salon_public' });
    }
  }

  return {
    salon_id: run.ctx.salonId,
    service_date: run.serviceDate,
    ...(extras.profile ? { profile: extras.profile } : {}),
    ...(extras.profileConsent
      ? { profile_consent: extras.profileConsent }
      : {}),
    salon,
    members: diff.members,
    presences: diff.presences,
    new_tickets: diff.new_tickets.map((ticket) => ({
      columns: {
        ...ticketColumns(ticket),
        salon_id: run.ctx.salonId,
        display_name: extras.displayNames.get(ticket.id) ?? '',
        ...(extras.ticketColumns.get(ticket.id) ?? {}),
      },
    })),
    ticket_updates: ticketUpdates,
    new_contacts: extras.newContacts.filter((c) => isNew.has(c.ticket_id)),
    contact_updates: diff.contact_updates,
    contact_moves: extras.contactMoves,
    contact_replaces: extras.contactReplaces,
    events: [
      ...output.events.map((e) => ({ ...e, command_id: commandId })),
      ...outcome.extraEvents.map((e) => ({ ...e, command_id: commandId })),
    ],
    notifications: [
      ...clientNotifications(output),
      ...extras.staffNotifications,
    ],
    broadcasts: outcome.ticketBroadcastsOnly
      ? broadcasts.filter((b) => b.kind === 'ticket')
      : broadcasts,
    version,
  };
}

function successData(
  run: Run,
  req: ParsedRequest,
  output: EngineOutput,
  version: number,
): Record<string, unknown> {
  const data: Record<string, unknown> = { ...run.extras.data };
  if (req.command === 'call_ticket') {
    const before = new Map(run.state.tickets.map((t) => [t.id, t.status]));
    const called = output.state.tickets.find(
      (t) => t.status === 'called' && before.get(t.id) !== 'called',
    );
    if (called) {
      data.ticket_id = called.id;
      data.short_code = called.short_code;
    }
  }
  if (output.warnings?.length) data.warnings = output.warnings;
  data.queue_version = version;
  return data;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

interface PreparedPhone {
  readonly e164: string;
  readonly hash: Uint8Array;
}

/** Phone typed by the salon: normalised and hashed before the lock is taken. */
async function preparePhone(
  req: ParsedRequest,
  phones: PhoneHasher,
): Promise<PreparedPhone | null | 'invalid_phone'> {
  const raw =
    req.command === 'register_walk_in' ||
    req.command === 'create_appointment' ||
    req.command === 'update_appointment'
      ? req.payload.phone
      : undefined;
  if (raw === undefined || raw === null) return null;
  const normalized = normalizeFrenchMobile(raw);
  if (!normalized.ok) return 'invalid_phone';
  return { e164: normalized.e164, hash: await phones.hash(normalized.e164) };
}

async function execute(
  run: Run,
  req: ParsedRequest,
  phone: PreparedPhone | null,
): Promise<CommandResponse> {
  let outcome: Outcome | CommandResponse;
  if (req.command === 'set_notifications_consent') {
    outcome = setNotificationsConsent(run, req);
  } else if (req.command === 'create_test_ticket') {
    outcome = createTestTicket(run);
  } else if (req.command === 'publish_salon') {
    outcome = publishSalon(run);
  } else {
    const prepare = PREPARE[req.command] as Prepare<CommandName>;
    const command = await prepare(run, req as never, phone);
    if ('status' in command) return command;
    const result = applyCommand(run.state, command, run.now);
    if (!result.ok) return errorResponse(result.error.code);
    for (const check of run.extras.afterEngine) {
      const refused = await check();
      if (refused) return refused;
    }
    outcome = { output: result, extraEvents: [] };
  }
  if ('status' in outcome) return outcome;

  // complete_service of the setup test (K35).
  if (req.command === 'complete_service') {
    const ticket = outcome.output.state.tickets.find(
      (t) => t.id === req.payload.ticket_id,
    );
    if (ticket?.is_test && run.day.salon.setup_test_passed_at === null) {
      run.extras.salon.setup_test_passed_at = iso(run.now);
    }
  }

  const writes = buildWrites(run, outcome, req.command_id);
  await run.tx.apply(writes);
  return okResponse(successData(run, req, outcome.output, writes.version));
}

export async function handleQueueCommand(
  deps: QueueServiceDeps,
  caller: Caller,
  body: unknown,
): Promise<CommandResponse> {
  const req = parseRequest(body);
  if (!req) return errorResponse('invalid_payload');
  const phone = await preparePhone(req, deps.phones);
  if (phone === 'invalid_phone') return errorResponse('invalid_phone');

  try {
    return await commandTransaction(deps, caller, req, phone);
  } catch (error) {
    // Two salons racing for the same client or number: the unique index
    // decides, the transaction is rolled back, the answer stays a business one.
    if (isActiveTicketConflict(error)) {
      return errorResponse('already_has_active_ticket');
    }
    throw error;
  }
}

const ACTIVE_TICKET_INDEXES = [
  'tickets_one_active_per_client',
  'ticket_contacts_one_active_per_phone',
];

function isActiveTicketConflict(error: unknown): boolean {
  const e = error as { code?: string; constraint_name?: string } | null;
  return (
    e?.code === '23505' &&
    ACTIVE_TICKET_INDEXES.includes(e.constraint_name ?? '')
  );
}

function commandTransaction(
  deps: QueueServiceDeps,
  caller: Caller,
  req: ParsedRequest,
  phone: PreparedPhone | null,
): Promise<CommandResponse> {
  return deps.db.transaction(async (tx) => {
    const ctx = await resolveContext(tx, req, caller);
    if ('status' in ctx) return ctx;
    // A place of an earlier day never blocks « une place à la fois » (S-15).
    await tx.closePastDays(parisDate(deps.clock()));
    await tx.lockSalon(ctx.salonId);
    // ADR-004: checked under the lock, so a retry waits for the first try.
    const stored = await tx.findProcessed(req.command_id);
    if (stored) return stored;

    const now = deps.clock();
    const serviceDate = parisDate(now);
    const day = await tx.loadDay(
      ctx.salonId,
      serviceDate,
      isoWeekday(serviceDate),
    );
    if (!day) return errorResponse('forbidden');
    const run: Run = {
      tx,
      deps,
      ctx,
      day,
      now,
      serviceDate,
      state: toState(
        day,
        serviceDayOf(serviceDate, day.opening_hours, day.closed),
        now,
      ),
      extras: emptyExtras(),
    };
    const response = await execute(run, req, phone);
    await tx.saveProcessed(req.command_id, req.command, ctx.salonId, response);
    return response;
  });
}

// ---------------------------------------------------------------------------
// queue-tick (TRD §6.1): time triggers, salon by salon
// ---------------------------------------------------------------------------

export interface TickReport {
  /** Salon days examined. */
  readonly salons: number;
  /** Salon days where something was written. */
  readonly changed: number;
  /** Salon days whose transaction failed (the others still ran). */
  readonly failed: number;
}

const SYSTEM_CONTEXT = (salonId: string): Context => ({
  salonId,
  actor: { type: 'system' },
  member: null,
  profileId: null,
});

/** E19: second push to the salon 10 min after an unconfirmed check-in. */
function confirmationReminders(run: Run, after: QueueState): void {
  const before = new Map(run.state.tickets.map((t) => [t.id, t]));
  const managers = run.day.members
    .filter((m) => m.status === 'active' && m.role === 'manager')
    .map((m) => m.id);
  for (const ticket of after.tickets) {
    if (
      ticket.confirmation_reminder_sent_at === null ||
      before.get(ticket.id)?.confirmation_reminder_sent_at !== null
    ) {
      continue;
    }
    const recipients = new Set(managers);
    if (ticket.requested_member_id) recipients.add(ticket.requested_member_id);
    for (const member_id of recipients) {
      run.extras.staffNotifications.push({
        ticket_id: ticket.id,
        recipient_profile_id: null,
        recipient_member_id: member_id,
        channel: 'push',
        template: 'appointment_checked_in',
        params: {
          variant: 'reminder',
          scheduled_at:
            ticket.scheduled_at === null ? null : iso(ticket.scheduled_at),
        },
        dedupe_key: `appointment_checked_in:${member_id}:reminder`,
        requires_consent: false,
      });
    }
  }
}

/** K8, E10, E28: absences counted by number, every salon; warning outside the SMS cap. */
async function noShowWarnings(run: Run, after: QueueState): Promise<void> {
  const before = new Map(run.state.tickets.map((t) => [t.id, t.status]));
  const released = after.tickets.filter(
    (t) => t.status === 'no_show' && before.get(t.id) !== 'no_show',
  );
  if (released.length === 0) return;
  const warned = new Set(
    await run.tx.recordNoShows(
      released.map((t) => t.id),
      run.now,
    ),
  );
  for (const ticket of released) {
    if (!warned.has(ticket.id)) continue;
    for (const channel of ['push', 'sms'] as const) {
      run.extras.staffNotifications.push({
        ticket_id: ticket.id,
        recipient_profile_id: ticket.client_id,
        recipient_member_id: null,
        channel,
        template: 'no_show_warning',
        params: {},
        dedupe_key: 'no_show_warning',
        requires_consent: false,
      });
    }
  }
}

async function tickSalon(
  tx: QueueTx,
  deps: QueueServiceDeps,
  salonId: string,
  serviceDate: string,
  now: Instant,
): Promise<boolean> {
  await tx.lockSalon(salonId);
  const day = await tx.loadDay(salonId, serviceDate, isoWeekday(serviceDate));
  if (!day) return false;
  const run: Run = {
    tx,
    deps,
    ctx: SYSTEM_CONTEXT(salonId),
    day,
    now,
    serviceDate,
    state: toState(
      day,
      serviceDayOf(serviceDate, day.opening_hours, day.closed),
      now,
    ),
    extras: emptyExtras(),
  };
  const output = detectTimeTriggers(run.state, now);
  confirmationReminders(run, output.state);
  await noShowWarnings(run, output.state);
  let writes = buildWrites(run, { output, extraEvents: [] }, null);
  if (serviceDate < parisDate(now)) {
    // A past day only closes its tickets: today's pass owns the salon's
    // counters and free slots; only the version moves, for the broadcasts.
    const { queue_version } = writes.salon;
    writes = {
      ...writes,
      salon: queue_version === undefined ? {} : { queue_version },
      broadcasts: writes.broadcasts.filter((b) => b.kind !== 'salon_public'),
    };
  }
  const empty =
    Object.keys(writes.salon).length === 0 &&
    writes.ticket_updates.length === 0 &&
    writes.presences.length === 0 &&
    writes.members.length === 0 &&
    writes.notifications.length === 0;
  if (empty) return false;
  await tx.apply(writes);
  return true;
}

export async function runQueueTick(
  deps: QueueServiceDeps,
): Promise<TickReport> {
  const now = deps.clock();
  const due = await deps.db.transaction((tx) =>
    tx.dueSalonDays(parisDate(now)),
  );
  let changed = 0;
  let failed = 0;
  for (const { salon_id, service_date } of due) {
    try {
      const wrote = await deps.db.transaction((tx) =>
        tickSalon(tx, deps, salon_id, service_date, now),
      );
      if (wrote) changed += 1;
    } catch {
      // One salon in error never stops the others; the next minute retries.
      failed += 1;
    }
  }
  return { salons: due.length, changed, failed };
}

// ---------------------------------------------------------------------------
// Previews (TRD §6.3, K2): the engine runs a manager's command, nothing is
// written. `set_presence` (F-M8, S-11) and `reassign_ticket` (F-M10, S-13).
// ---------------------------------------------------------------------------

export interface PresencePreviewTicket {
  readonly ticket_id: string;
  readonly short_code: string;
  readonly kind: 'queue' | 'appointment';
  readonly status_before: string;
  readonly status_after: string;
  /** Who serves, or is expected to serve, the client: assigned, else estimated. */
  readonly member_before: string | null;
  readonly member_after: string | null;
  readonly estimated_start_at_before: string | null;
  readonly estimated_start_at_after: string | null;
  /** The client will be asked to wait or take the first available (E7). */
  readonly choice_required: boolean;
}

/** S-13: what the reassignment does for the ticket itself. */
export interface ReassignmentPreview {
  readonly ticket_id: string;
  readonly estimated_start_at_before: string | null;
  readonly estimated_start_at_after: string | null;
  /** Later than now: the client is asked first (E9), nothing moves before. */
  readonly needs_client_answer: boolean;
}

type PreviewedCommand = 'set_presence' | 'reassign_ticket';

const servingMember = (t: TicketState): string | null =>
  t.assigned_member_id ?? t.estimated_member_id;

const isoOrNull = (instant: Instant | null): string | null =>
  instant === null ? null : iso(instant);

/** Every active ticket whose time, stylist or status the command would change. */
function previewImpact(
  before: QueueState,
  after: QueueState,
): PresencePreviewTicket[] {
  const old = new Map(before.tickets.map((t) => [t.id, t]));
  const tickets: PresencePreviewTicket[] = [];
  for (const next of after.tickets) {
    const prev = old.get(next.id);
    if (!prev || !isActiveStatus(prev.status)) continue;
    const choice =
      prev.stylist_change_pending_since === null &&
      next.stylist_change_pending_since !== null;
    const changed =
      choice ||
      prev.estimated_start_at !== next.estimated_start_at ||
      servingMember(prev) !== servingMember(next) ||
      prev.status !== next.status;
    if (!changed) continue;
    tickets.push({
      ticket_id: next.id,
      short_code: next.short_code,
      kind: next.kind,
      status_before: prev.status,
      status_after: next.status,
      member_before: servingMember(prev),
      member_after: servingMember(next),
      estimated_start_at_before: isoOrNull(prev.estimated_start_at),
      estimated_start_at_after: isoOrNull(next.estimated_start_at),
      choice_required: choice,
    });
  }
  return tickets;
}

async function previewCommand(
  deps: QueueServiceDeps,
  caller: Caller,
  command: PreviewedCommand,
  payload: unknown,
): Promise<CommandResponse> {
  const req = parseRequest({
    command,
    command_id: deps.random.uuid(),
    payload,
  });
  if (!req || req.command !== command) {
    return errorResponse('invalid_payload');
  }
  return deps.db.transaction(async (tx) => {
    const ctx = await resolveContext(tx, req, caller);
    if ('status' in ctx) return ctx;
    if (ctx.member?.role !== 'manager') return errorResponse('forbidden');
    const now = deps.clock();
    const serviceDate = parisDate(now);
    const day = await tx.loadDay(
      ctx.salonId,
      serviceDate,
      isoWeekday(serviceDate),
    );
    if (!day) return errorResponse('forbidden');
    const state = toState(
      day,
      serviceDayOf(serviceDate, day.opening_hours, day.closed),
      now,
    );
    const result = applyCommand(
      state,
      { command, actor: ctx.actor, payload: req.payload } as Command,
      now,
    );
    if (!result.ok) return errorResponse(result.error.code);
    const tickets = previewImpact(state, result.state);
    if (req.command !== 'reassign_ticket') return okResponse({ tickets });

    const id = req.payload.ticket_id;
    const prev = state.tickets.find((t) => t.id === id);
    const next = result.state.tickets.find((t) => t.id === id);
    const asked =
      next !== undefined &&
      next.reassignment_requested_at !== null &&
      prev?.reassignment_requested_at !== next.reassignment_requested_at;
    const reassignment: ReassignmentPreview = {
      ticket_id: id,
      estimated_start_at_before: isoOrNull(prev?.estimated_start_at ?? null),
      estimated_start_at_after: isoOrNull(
        asked
          ? (next?.reassignment_proposed_start_at ?? null)
          : (next?.estimated_start_at ?? null),
      ),
      needs_client_answer: asked,
    };
    return okResponse({ tickets, reassignment });
  });
}

/** F-M8 (S-11): who moves if a stylist changes status. */
export function previewPresenceChange(
  deps: QueueServiceDeps,
  caller: Caller,
  payload: unknown,
): Promise<CommandResponse> {
  return previewCommand(deps, caller, 'set_presence', payload);
}

/** F-M10 (S-13): the new time of a reassigned client, and whether he is asked first. */
export function previewReassignment(
  deps: QueueServiceDeps,
  caller: Caller,
  payload: unknown,
): Promise<CommandResponse> {
  return previewCommand(deps, caller, 'reassign_ticket', payload);
}

// ---------------------------------------------------------------------------
// S-16: revoke-member-sessions and deactivate-member (TRD §6.1, K3, K38)
// ---------------------------------------------------------------------------

type TeamErrorCode =
  'team.member_not_found' | 'team.already_deactivated' | 'team.last_manager';

function teamError(code: TeamErrorCode): CommandResponse {
  return {
    status: code === 'team.member_not_found' ? 404 : 409,
    body: { ok: false, error: { code, messageKey: `errors.${code}` } },
  };
}

interface MemberAction {
  readonly manager: MemberRef;
  readonly target: MemberRecord;
}

/** A manager acting on a member of his own salon; anything else looks like « not found ». */
async function resolveMemberAction(
  tx: QueueTx,
  caller: Caller,
  body: unknown,
): Promise<MemberAction | CommandResponse> {
  if (!caller.profileId) return UNAUTHENTICATED;
  const memberId =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).member_id
      : undefined;
  if (!isUuid(memberId)) return errorResponse('invalid_payload');
  const managed = (await tx.memberships(caller.profileId)).filter(
    (m) => m.role === 'manager',
  );
  if (managed.length === 0) return errorResponse('forbidden');
  const target = await tx.memberById(memberId.toLowerCase());
  const manager = target && managed.find((m) => m.salon_id === target.salon_id);
  if (!target || !manager) return teamError('team.member_not_found');
  return { manager, target };
}

/**
 * Auth sessions belong to the account, not to the salon: they are deleted only
 * when the person works nowhere else, so that a manager can never sign out
 * someone who also works in another salon (security review DEV-6).
 */
async function sessionsToRevoke(
  tx: QueueTx,
  target: MemberRecord,
): Promise<string[]> {
  if (!target.profile_id) return [];
  const elsewhere = (await tx.memberships(target.profile_id)).filter(
    (m) => m.member_id !== target.member_id,
  );
  return elsewhere.length === 0 ? [target.profile_id] : [];
}

function memberEvent(
  action: MemberAction,
  type: 'member_sessions_revoked' | 'member_deactivated',
): EventRow {
  return {
    scope: 'salon',
    type,
    subject_member_id: action.target.member_id,
    actor_type: 'manager',
    actor_member_id: action.manager.member_id,
    actor_profile_id: null,
    reason_code: null,
    command_id: null,
  };
}

/** Phone lost or changed: every session and push subscription goes; the member stays active. */
export async function revokeMemberSessions(
  deps: QueueServiceDeps,
  caller: Caller,
  body: unknown,
): Promise<CommandResponse> {
  return deps.db.transaction(async (tx) => {
    const action = await resolveMemberAction(tx, caller, body);
    if ('status' in action) return action;
    const { target } = action;
    // Only someone who still works here (an old membership gives no power).
    if (target.status !== 'active') return teamError('team.member_not_found');
    const revoked = await sessionsToRevoke(tx, target);
    // Staff screens re-read at once: the revoked phone learns it now (ADR-019),
    // not at its next poll. The message carries only the current version.
    const date = parisDate(deps.clock());
    const day = await tx.loadDay(target.salon_id, date, isoWeekday(date));
    await tx.apply({
      salon_id: target.salon_id,
      service_date: parisDate(deps.clock()),
      salon: {},
      members: [],
      presences: [],
      new_tickets: [],
      ticket_updates: [],
      new_contacts: [],
      contact_updates: [],
      contact_moves: [],
      contact_replaces: [],
      events: [memberEvent(action, 'member_sessions_revoked')],
      notifications: [],
      revoke_sessions_of: revoked,
      delete_push_of_members: [target.member_id],
      broadcasts: [{ kind: 'salon', event: 'queue_updated' }],
      version: day?.salon.queue_version ?? 0,
    });
    // The person also works in another salon: told to the manager, who can
    // still deactivate the membership of his own salon.
    return okResponse({ sessions_kept: revoked.length === 0 });
  });
}

/**
 * Departure from the salon: the member becomes `deactivated` and loses every
 * session; his clients are handled like for a stylist absent all day (E6, E7):
 * a called client goes back to the head, those who asked for him choose
 * « premier disponible » or cancel; a client in service is completed by the
 * manager (E15).
 */
export async function deactivateMember(
  deps: QueueServiceDeps,
  caller: Caller,
  body: unknown,
): Promise<CommandResponse> {
  return deps.db.transaction(async (tx) => {
    const action = await resolveMemberAction(tx, caller, body);
    if ('status' in action) return action;
    const salonId = action.target.salon_id;
    await tx.lockSalon(salonId);
    const target = await tx.memberById(action.target.member_id);
    if (!target) return teamError('team.member_not_found');
    if (target.status === 'deactivated') {
      return teamError('team.already_deactivated');
    }
    if (
      target.role === 'manager' &&
      target.status === 'active' &&
      (await tx.activeManagerCount(salonId)) <= 1
    ) {
      return teamError('team.last_manager');
    }

    const now = deps.clock();
    const serviceDate = parisDate(now);
    const day = await tx.loadDay(salonId, serviceDate, isoWeekday(serviceDate));
    if (!day) return teamError('team.member_not_found');
    const actor: Actor = {
      type: 'member',
      member_id: action.manager.member_id,
    };
    const run: Run = {
      tx,
      deps,
      ctx: {
        salonId,
        actor,
        member: action.manager,
        profileId: caller.profileId,
      },
      day,
      now,
      serviceDate,
      state: toState(
        day,
        serviceDayOf(serviceDate, day.opening_hours, day.closed),
        now,
      ),
      extras: emptyExtras(),
    };

    let output: EngineOutput = unchanged(run.state);
    if (target.status === 'active') {
      const result = applyCommand(
        run.state,
        {
          command: 'set_presence',
          actor,
          payload: {
            member_id: target.member_id,
            status: 'absent',
            break_type: null,
            until: null,
            shift_end_at: null,
          },
        },
        now,
      );
      if (result.ok) output = result;
    }
    // From now on the engine sees him deactivated (no free slot with him).
    const after =
      output.state.salon.queue_version === run.state.salon.queue_version
        ? bumpVersion(output.state)
        : output.state;
    const state: QueueState = {
      ...after,
      members: after.members.map((m) =>
        m.id === target.member_id ? { ...m, status: 'deactivated' } : m,
      ),
    };
    const writes = buildWrites(
      run,
      {
        output: { ...output, state },
        extraEvents: [memberEvent(action, 'member_deactivated')],
      },
      null,
    );
    const previous = writes.members.find((m) => m.id === target.member_id);
    await tx.apply({
      ...writes,
      members: [
        ...writes.members.filter((m) => m.id !== target.member_id),
        {
          id: target.member_id,
          columns: { ...previous?.columns, status: 'deactivated' },
        },
      ],
      revoke_sessions_of: await sessionsToRevoke(tx, target),
      delete_push_of_members: [target.member_id],
    });
    return okResponse({ queue_version: writes.version });
  });
}
