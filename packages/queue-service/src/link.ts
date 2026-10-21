/**
 * `ticket-public` (ADR-006, ADR-018): the page `/t/:shortCode` exchanges the
 * 8-character link of the SMS for the ticket view and its tracking token,
 * kept in memory by the page for commands and realtime. Valid 24 h.
 */
import type { Instant } from '../../queue-engine/src/index.ts';
import type { StoredResponse } from './ports.ts';

export const LINK_VALIDITY_MS = 24 * 60 * 60 * 1000;

/** Same shape as `my_active_ticket()`, plus the token and the consent switch. */
export interface LinkView {
  readonly tracking_token: string;
  readonly ticket: Record<string, unknown>;
  readonly salon: Record<string, unknown>;
  readonly assigned_stylist_first_name: string | null;
}

export interface TicketLinkReader {
  byLinkCode(
    code: string,
  ): Promise<(LinkView & { created_at: Instant }) | null>;
}

/** Unknown and expired links get the same answer: a code cannot be probed. */
const EXPIRED: StoredResponse = {
  status: 410,
  body: {
    ok: false,
    error: { code: 'link_expired', messageKey: 'client.tracking.expired' },
  },
};

export async function readTicketLink(
  reader: TicketLinkReader,
  code: string,
  now: Instant,
): Promise<StoredResponse> {
  if (!/^[A-Za-z0-9]{8}$/.test(code)) return EXPIRED;
  const found = await reader.byLinkCode(code);
  if (!found || now - found.created_at > LINK_VALIDITY_MS) return EXPIRED;
  const view: LinkView = {
    tracking_token: found.tracking_token,
    ticket: found.ticket,
    salon: found.salon,
    assigned_stylist_first_name: found.assigned_stylist_first_name,
  };
  return { status: 200, body: { ok: true, data: view } };
}
