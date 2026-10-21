/**
 * Stylist space data (DEV-6): queue commands through `queue-command`, reads
 * through RPCs. Nothing is persisted on the device (ADR-007): TanStack Query
 * keeps it in memory only, and signing out clears it.
 */
import { readError } from './signup-api';
import { supabase } from './supabase';

export type PresenceStatus =
  | 'offline'
  | 'available'
  | 'in_service'
  | 'on_break'
  | 'late'
  | 'absent'
  | 'off_duty';

export interface StylistContext {
  access: 'active' | 'deactivated' | 'none';
  member_id?: string;
  salon_id?: string;
  role?: 'manager' | 'stylist';
  first_name?: string;
  is_hairdressing?: boolean;
  salon_name?: string;
  queue_status?: 'open' | 'paused' | 'closed';
  service_date?: string;
  presence?: {
    status: PresenceStatus;
    break_type: string | null;
    expected_back_at: string | null;
    shift_end_at: string | null;
  } | null;
}

/** One ticket as `get_stylist_queue()` returns it (never a phone or a token). */
export interface QueueTicket {
  id: string;
  short_code: string;
  display_name: string;
  status: string;
  kind: 'queue' | 'appointment';
  queue_rank: number;
  scheduled_at: string | null;
  planned_duration_minutes: number;
  estimated_start_at: string | null;
  eta_response: 'on_time' | 'late' | null;
  declared_delay_minutes: number | null;
  arrived_at: string | null;
  called_at: string | null;
  started_at: string | null;
  assigned_member_id: string | null;
  estimated_member_id: string | null;
  requested_member_id: string | null;
  service_id: string | null;
  release_due_at: string | null;
  reminder_sent_at: string | null;
  call_count: number;
  postpone_count: number;
  declared_arrival_at: string | null;
  is_test: boolean;
  no_show_at: string | null;
  service_name: string | null;
}

export interface StylistQueue {
  current: QueueTicket | null;
  called: QueueTicket | null;
  pending_appointments: QueueTicket[];
  next: QueueTicket[];
  appointments: QueueTicket[];
  /** My last client released for not arriving, within 15 min (F-S8). */
  released: QueueTicket | null;
}

export interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
}

export interface DaySummary {
  served_count: number;
  announced_wait_minutes: number | null;
  actual_wait_minutes: number | null;
  no_show_count: number;
  cancelled_count: number;
}

/** A read refused by the database: the session or the membership is gone. */
export class AccessLost extends Error {}

function check<T>(data: T, error: { code?: string } | null): T {
  if (error) {
    if (error.code === '42501' || error.code === 'PGRST301') {
      throw new AccessLost();
    }
    throw new Error('read failed');
  }
  return data;
}

export async function loadStylistContext(): Promise<StylistContext> {
  const { data, error } = await supabase.rpc('stylist_context');
  return check(data as unknown as StylistContext, error);
}

export async function loadStylistQueue(): Promise<StylistQueue> {
  const { data, error } = await supabase.rpc('get_stylist_queue');
  return check(data as unknown as StylistQueue, error);
}

export async function loadServiceOptions(
  salonId: string,
): Promise<ServiceOption[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('salon_id', salonId)
    .eq('is_active', true)
    .order('sort_order');
  return check(data ?? [], error);
}

/** My own figures, also for a manager who cuts hair (never the whole salon here). */
export async function loadDaySummary(
  salonId: string,
  serviceDate: string,
  memberId: string,
): Promise<DaySummary> {
  const { data, error } = await supabase.rpc('get_day_summary', {
    salon_id: salonId,
    service_date: serviceDate,
    member_id: memberId,
  });
  return check(data as unknown as DaySummary, error);
}

export type CommandOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; messageKey: string };

/** One queue command; a new `command_id` per tap, reused on an automatic retry (ADR-004). */
export async function sendCommand(
  command: string,
  payload: Record<string, unknown> = {},
  options: { salonId?: string; commandId?: string } = {},
): Promise<CommandOutcome> {
  const { data, error } = await supabase.functions.invoke('queue-command', {
    body: {
      command,
      command_id: options.commandId ?? crypto.randomUUID(),
      payload,
      ...(options.salonId ? { salon_id: options.salonId } : {}),
    },
  });
  if (!error && data?.ok) return { ok: true, data: data.data ?? {} };
  const detail = ((await readError(error)) ?? data) as {
    error?: { code?: string; messageKey?: string };
  } | null;
  return {
    ok: false,
    code: detail?.error?.code ?? 'generic.unexpected',
    messageKey: detail?.error?.messageKey ?? 'errors.generic.unexpected',
  };
}

/** Team actions of S-16, through their own Edge Functions. */
export async function sendMemberAction(
  name: 'revoke-member-sessions' | 'deactivate-member',
  memberId: string,
): Promise<CommandOutcome> {
  const { data, error } = await supabase.functions.invoke(name, {
    body: { member_id: memberId },
  });
  if (!error && data?.ok) return { ok: true, data: data.data ?? {} };
  const detail = ((await readError(error)) ?? data) as {
    error?: { code?: string; messageKey?: string };
  } | null;
  return {
    ok: false,
    code: detail?.error?.code ?? 'generic.unexpected',
    messageKey: detail?.error?.messageKey ?? 'errors.generic.unexpected',
  };
}
