/**
 * Manager board (F-M6): one read, `get_salon_board`, refused for anyone but
 * the manager of the salon (K9). It never carries a phone number.
 */
import { AccessLost } from './queue-api';
import type { PresenceStatus } from './queue-api';
import { supabase } from './supabase';

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
}

export interface BoardIndicators {
  queue_status: 'open' | 'paused' | 'closed';
  is_full: boolean;
  waiting_count: number;
  current_wait_minutes: number | null;
  estimate_updated_at: string | null;
  queue_version: number;
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

/** Columns of the board: stylists, and the manager only when they cut hair. */
export function boardColumns(stylists: BoardStylist[]): BoardStylist[] {
  return stylists.filter((s) => s.role === 'stylist' || s.is_hairdressing);
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
