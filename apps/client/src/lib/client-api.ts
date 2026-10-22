/**
 * The client app's reads and commands (F-C2 to F-C10). Reads go through the
 * public RPCs and `ticket-public`; every queue write is a `queue-command`,
 * with the session or, from an SMS link, the tracking token (ADR-006).
 * Nothing about the ticket is stored on the device: memory only.
 */
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

export type TicketStatus =
  | 'pending_confirmation'
  | 'waiting'
  | 'called'
  | 'in_service'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface ClientTicket {
  id: string;
  salon_id: string;
  short_code: string;
  kind: 'queue' | 'appointment';
  scheduled_at: string | null;
  display_name: string;
  status: TicketStatus;
  channel: string;
  service_name: string | null;
  planned_duration_minutes: number;
  requested_stylist_first_name: string | null;
  assigned_stylist_first_name: string | null;
  estimated_start_at: string | null;
  last_notified_start_at: string | null;
  eta_response: 'on_time' | 'late' | null;
  declared_delay_minutes: number | null;
  declared_arrival_at: string | null;
  turn_approaching_sent_at: string | null;
  arrived_at: string | null;
  called_at: string | null;
  release_due_at: string | null;
  call_count: number;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  removal_reason: string | null;
  no_show_at: string | null;
  notifications_consent: boolean;
  stylist_change_pending_since: string | null;
  reassignment_stylist_first_name: string | null;
  reassignment_requested_at: string | null;
  reassignment_proposed_start_at: string | null;
  end_of_day_warned_at: string | null;
  end_of_day_choice: 'stay' | 'cancel' | null;
  /** Clients before him at his stylist (E13); null for an appointment. */
  position: number | null;
}

export interface TicketSalon {
  id: string;
  slug: string;
  name: string;
  address_line: string;
  postal_code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  queue_status: 'open' | 'paused' | 'closed';
  estimate_updated_at: string | null;
}

export interface TicketView {
  ticket: ClientTicket;
  salon: TicketSalon;
}

export const ACTIVE: readonly TicketStatus[] = [
  'pending_confirmation',
  'waiting',
  'called',
  'in_service',
];

export function isActive(ticket: ClientTicket): boolean {
  return ACTIVE.includes(ticket.status);
}

/** The signed-in client's ticket of today, active or just ended; null without one. */
export async function loadMyTicket(): Promise<TicketView | null> {
  const { data, error } = await supabase.rpc('my_ticket');
  if (error) throw new Error('ticket read failed');
  return (data as TicketView | null) ?? null;
}

export class LinkExpired extends Error {}

/** `/t/:shortCode`: the view and the token, valid 24 h (F-C10). */
export async function loadLinkTicket(
  code: string,
): Promise<TicketView & { tracking_token: string }> {
  const response = await fetch(
    `${supabaseUrl}/functions/v1/ticket-public?code=${encodeURIComponent(code)}`,
    { headers: { apikey: supabaseAnonKey } },
  );
  if (response.status === 410) throw new LinkExpired();
  const body = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: TicketView & { tracking_token: string };
  } | null;
  if (!response.ok || !body?.ok || !body.data) {
    throw new Error('link read failed');
  }
  return body.data;
}

export interface PublicService {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
}

export interface PublicStylist {
  id: string;
  first_name: string;
  photo_path: string | null;
  specialties: string[];
  presence: 'available' | 'busy' | 'away';
}

export interface PublicSalon {
  salon: {
    id: string;
    slug: string;
    name: string;
    address_line: string;
    postal_code: string;
    city: string;
    queue_status: 'open' | 'paused' | 'closed';
    is_full: boolean;
    welcome_message: string | null;
    waiting_count: number;
    current_wait_minutes: number | null;
    estimate_updated_at: string | null;
    next_free_slots: { service_id: string; start_at: string }[] | null;
  };
  first_available_wait_minutes: number | null;
  waiting_count: number;
  services: PublicService[];
  opening_hours: { weekday: number; opens_at: string; closes_at: string }[];
  stylists: PublicStylist[];
}

/** F-C2: a published salon, or null. */
export async function loadSalon(slug: string): Promise<PublicSalon | null> {
  const { data, error } = await supabase.rpc('get_salon_public', { slug });
  if (error) throw new Error('salon read failed');
  return (data as PublicSalon | null) ?? null;
}

/** F-C4: the salon of a poster's QR code, or null when it was regenerated. */
export async function resolveQr(token: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('resolve_qr_token', {
    qr_token: token,
  });
  if (error) throw new Error('qr read failed');
  return data ?? null;
}

export type CommandOutcome =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; code: string; messageKey: string };

/** One client command; `trackingToken` acts for the holder of an SMS link. */
export async function sendClientCommand(
  command: string,
  payload: Record<string, unknown>,
  trackingToken?: string,
): Promise<CommandOutcome> {
  const { data, error } = await supabase.functions.invoke('queue-command', {
    body: {
      command,
      command_id: crypto.randomUUID(),
      payload,
      ...(trackingToken ? { tracking_token: trackingToken } : {}),
    },
  });
  if (!error && data?.ok) return { ok: true, data: data.data ?? {} };
  let detail = data as {
    error?: { code?: string; messageKey?: string };
  } | null;
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    detail = (await context.json().catch(() => null)) as typeof detail;
  }
  return {
    ok: false,
    code: detail?.error?.code ?? 'generic.unexpected',
    messageKey: detail?.error?.messageKey ?? 'errors.generic.unexpected',
  };
}

/** `ticket-token:{key}` (ADR-018): the first 32 hex characters of SHA-256(token). */
export async function tokenKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}
