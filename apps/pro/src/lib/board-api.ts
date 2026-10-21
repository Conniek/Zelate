/**
 * Manager board (F-M6): one read, `get_salon_board`, refused for anyone but
 * the manager of the salon (K9). It never carries a phone number.
 */
import { AccessLost } from './queue-api';
import type { PresenceStatus } from './queue-api';
import { supabase } from './supabase';
import type { Json } from '@zelate/db-types';

export interface BoardStylist {
  member_id: string;
  first_name: string;
  photo_path: string | null;
  role: 'manager' | 'stylist';
  is_hairdressing: boolean;
  status: PresenceStatus | null;
  status_since: string | null;
  break_type: string | null;
  expected_back_at: string | null;
  shift_end_at: string | null;
  served_today_count: number;
}

export interface BoardTicket {
  id: string;
  short_code: string;
  display_name: string;
  kind: 'queue' | 'appointment';
  scheduled_at: string | null;
  status: 'pending_confirmation' | 'waiting' | 'called' | 'in_service';
  queue_rank: number;
  service_id: string | null;
  planned_duration_minutes: number;
  requested_member_id: string | null;
  estimated_member_id: string | null;
  assigned_member_id: string | null;
  estimated_start_at: string | null;
  eta_response: 'on_time' | 'late' | null;
  declared_delay_minutes: number | null;
  arrived_at: string | null;
  called_at: string | null;
  started_at: string | null;
  stylist_change_pending_since: string | null;
  reassignment_member_id: string | null;
  reassignment_proposed_start_at: string | null;
  reassignment_resolved: Record<string, unknown> | null;
  /** H9: warned of the end-of-day risk, the client's answer, the manager's decision. */
  end_of_day_warned_at: string | null;
  end_of_day_choice: 'stay' | 'cancel' | null;
  closing_decision: 'serve' | 'cancel' | null;
}

export interface BoardIndicators {
  queue_status: 'open' | 'paused' | 'closed';
  is_full: boolean;
  waiting_count: number;
  current_wait_minutes: number | null;
  estimate_updated_at: string | null;
  queue_version: number;
  /** Last closing of today in Paris, null when the salon is closed today (F-M12). */
  last_closing_at: string | null;
  end_of_day_warning_minutes: number;
  closing_grace_minutes: number;
}

export interface SalonBoard {
  stylists: BoardStylist[];
  tickets: BoardTicket[];
  indicators: BoardIndicators;
}

export async function loadBoard(salonId: string): Promise<SalonBoard> {
  const { data, error } = await supabase.rpc('get_salon_board', {
    salon_id: salonId,
  });
  if (error) {
    if (error.code === '42501' || error.code === 'PGRST301') {
      throw new AccessLost();
    }
    throw new Error('read failed');
  }
  return data as unknown as SalonBoard;
}

/** Whoever the ticket is being served by, or will be (call time decides, ADR-015). */
export function ticketStylistId(ticket: BoardTicket): string | null {
  return (
    ticket.assigned_member_id ??
    ticket.estimated_member_id ??
    ticket.requested_member_id
  );
}

/** Who can receive clients: stylists, and the manager only when they cut hair. */
export function boardColumns(stylists: BoardStylist[]): BoardStylist[] {
  return stylists.filter((s) => s.role === 'stylist' || s.is_hairdressing);
}

/**
 * Columns of the live board: the people above, plus the manager when, without
 * cutting hair, he took a client with « Je prends le prochain » (F-M6).
 */
export function liveColumns(
  stylists: BoardStylist[],
  tickets: BoardTicket[],
): BoardStylist[] {
  return stylists.filter(
    (s) =>
      s.role === 'stylist' ||
      s.is_hairdressing ||
      tickets.some(
        (t) =>
          t.assigned_member_id === s.member_id &&
          (t.status === 'called' || t.status === 'in_service'),
      ),
  );
}

/** F-M12: the end-of-day window, from the warning until the automatic cancellation. */
export type EndOfDayPhase = 'before' | 'warning' | 'closing' | 'after';

export function endOfDayPhase(
  indicators: BoardIndicators,
  now: number,
): EndOfDayPhase {
  if (indicators.last_closing_at === null) return 'before';
  const closing = Date.parse(indicators.last_closing_at);
  const minute = 60_000;
  if (now < closing - indicators.end_of_day_warning_minutes * minute) {
    return 'before';
  }
  if (now < closing) return 'warning';
  if (now < closing + indicators.closing_grace_minutes * minute) {
    return 'closing';
  }
  return 'after';
}

export interface PresenceChange {
  member_id: string;
  status: 'absent' | 'late' | 'off_duty' | 'on_break';
  break_type: 'meal' | 'short' | 'unexpected' | null;
  until: string | null;
  shift_end_at: string | null;
}

export interface ImpactTicket {
  ticket_id: string;
  short_code: string;
  estimated_start_at_before: string | null;
  estimated_start_at_after: string | null;
  choice_required: boolean;
}

/** `preview-presence-change` (K2): the engine runs, nothing is written. */
export async function previewPresence(
  change: PresenceChange,
): Promise<ImpactTicket[]> {
  const { data, error } = await supabase.functions.invoke(
    'preview-presence-change',
    { body: change },
  );
  if (error || !data?.ok) throw new Error('preview failed');
  return (data.data as { tickets: ImpactTicket[] }).tickets;
}

export interface DaySummary {
  served_count: number;
  announced_wait_minutes: number | null;
  actual_wait_minutes: number | null;
  no_show_count: number;
  cancelled_count: number;
}

export async function loadDaySummary(
  salonId: string,
  serviceDate: string,
): Promise<DaySummary> {
  const { data, error } = await supabase.rpc('get_day_summary', {
    salon_id: salonId,
    service_date: serviceDate,
  });
  if (error || !data) throw new Error('summary failed');
  return data as unknown as DaySummary;
}

export interface AuditEvent {
  source: 'salon' | 'ticket';
  id: number;
  created_at: string;
  type: string;
  actor_type: 'client' | 'stylist' | 'manager' | 'system' | 'admin';
  actor_first_name: string | null;
  ticket_code: string | null;
  reason_code: string | null;
}

export interface AuditPage {
  events: AuditEvent[];
  next_cursor: Record<string, unknown> | null;
}

export interface AuditFilters {
  from: string;
  to: string;
  type: string;
  memberId: string;
}

export async function loadAuditLog(
  salonId: string,
  filters: AuditFilters,
  cursor: Record<string, unknown> | null,
): Promise<AuditPage> {
  const { data, error } = await supabase.rpc('get_audit_log', {
    salon_id: salonId,
    from: filters.from,
    to: filters.to,
    ...(filters.type === '' ? {} : { type: filters.type }),
    ...(filters.memberId === '' ? {} : { member_id: filters.memberId }),
    ...(cursor ? { cursor: cursor as Json } : {}),
  });
  if (error || !data) throw new Error('audit failed');
  return data as unknown as AuditPage;
}
