import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button } from '@zelate/ui';
import type { ClientTicket } from '../lib/client-api';
import { useNow, useTime } from '../lib/live';
import type { useClientCommand } from '../lib/live';

/** A reassignment request expires after 10 min (E9). */
const REASSIGNMENT_MS = 10 * 60_000;
/** U-10: the last change stays on screen for 30 min. */
const CHANGE_SHOWN_MS = 30 * 60_000;
/** U-15 (R5): the salon is late from 10 min after the appointment time. */
const SALON_LATE_MS = 10 * 60_000;

type Command = ReturnType<typeof useClientCommand>;

/** The request waiting for the client's answer, one at a time on screen (F-C5). */
type Request = 'reassignment' | 'stylist_change' | 'end_of_day' | null;

function requestOf(ticket: ClientTicket): { kind: Request; since: string } {
  if (ticket.status !== 'waiting') return { kind: null, since: '' };
  if (
    ticket.reassignment_requested_at &&
    ticket.reassignment_proposed_start_at
  ) {
    return { kind: 'reassignment', since: ticket.reassignment_requested_at };
  }
  if (ticket.stylist_change_pending_since) {
    return {
      kind: 'stylist_change',
      since: ticket.stylist_change_pending_since,
    };
  }
  if (ticket.end_of_day_warned_at && ticket.end_of_day_choice === null) {
    return { kind: 'end_of_day', since: ticket.end_of_day_warned_at };
  }
  return { kind: null, since: '' };
}

const offersWait = (
  ticket: ClientTicket,
): ticket is ClientTicket & {
  requested_stylist_first_name: string;
} =>
  ticket.wait_offered === true && ticket.requested_stylist_first_name !== null;

/**
 * The polite line said when a request arrives (DESIGN_SYSTEM §7.3): the
 * focus stays where it is, the client may be typing elsewhere (WCAG 3.2).
 */
export function useRequestAnnouncement(ticket: ClientTicket): string {
  const { t } = useTranslation('client');
  const time = useTime();
  const { kind, since } = requestOf(ticket);
  const key = `${kind ?? ''}|${since}`;
  const previous = useRef<string | null>(null);
  const [text, setText] = useState('');
  useEffect(() => {
    const before = previous.current;
    previous.current = key;
    if (before === null || before === key || kind === null) return;
    if (kind === 'reassignment') {
      setText(
        [
          t('ticket.reassignment.banner'),
          reassignmentLine(t, ticket, time),
          t('ticket.reassignment.no_answer_hint'),
        ].join('. '),
      );
    } else if (kind === 'stylist_change') {
      setText(
        [
          t('ticket.stylist_change.banner'),
          offersWait(ticket)
            ? t('ticket.stylist_change.no_answer_wait', {
                first_name: ticket.requested_stylist_first_name,
              })
            : t('ticket.stylist_change.no_answer_first_available'),
        ].join('. '),
      );
    } else {
      setText(
        `${t('ticket.end_of_day.banner')}. ${t('ticket.end_of_day.hint')}`,
      );
    }
    // Said once, when the request arrives.
  }, [key]);
  return text;
}

function reassignmentLine(
  t: ReturnType<typeof useTranslation<'client'>>['t'],
  ticket: ClientTicket,
  time: (iso: string) => string,
): string {
  const at = time(ticket.reassignment_proposed_start_at ?? '');
  return ticket.reassignment_stylist_first_name
    ? t('ticket.reassignment.new_time', {
        first_name: ticket.reassignment_stylist_first_name,
        time: at,
      })
    : t('ticket.reassignment.new_time_unnamed', { time: at });
}

interface RequestProps {
  ticket: ClientTicket;
  command: Command;
  /** After a successful answer: what was decided, said politely, focus on the stage. */
  onAnswered: (message: string) => void;
  /** « J'annule » is confirmed first (DESIGN_SYSTEM §7.1, danger). */
  onCancelEndOfDay: () => void;
}

/** The requests of F-C5, before the ticket card (U-11, U-12, U-17). */
export function TicketRequests({
  ticket,
  command,
  onAnswered,
  onCancelEndOfDay,
}: RequestProps) {
  const { t } = useTranslation('client');
  const time = useTime();
  const now = useNow(30_000);
  const [pending, setPending] = useState<string | null>(null);
  const busy = command.busy !== null;
  const { kind } = requestOf(ticket);

  async function answer(
    name: string,
    choice: string,
    message: string,
  ): Promise<void> {
    if (busy) return;
    setPending(`${name}:${choice}`);
    const outcome = await command.run(name, { ticket_id: ticket.id, choice });
    setPending(null);
    if (outcome.ok) onAnswered(message);
  }
  const button = (
    name: string,
    choice: string,
    label: string,
    message: string,
    extra: { variant?: 'secondary'; describedBy?: string } = {},
  ) => (
    <Button
      aria-describedby={extra.describedBy}
      aria-disabled={busy || undefined}
      loading={pending === `${name}:${choice}`}
      onClick={() => void answer(name, choice, message)}
      {...(extra.variant ? { variant: extra.variant } : {})}
    >
      {label}
    </Button>
  );
  const box =
    'grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4';

  if (kind === 'reassignment') {
    const left = Math.max(
      0,
      Math.floor(
        (Date.parse(ticket.reassignment_requested_at!) +
          REASSIGNMENT_MS -
          now) /
          60_000,
      ),
    );
    const name = ticket.reassignment_stylist_first_name;
    return (
      <section aria-labelledby="reassignment-title" className={box}>
        <h2 className="font-semibold" id="reassignment-title">
          {t('ticket.reassignment.banner')}
        </h2>
        <p id="reassignment-detail">{reassignmentLine(t, ticket, time)}</p>
        <p className="text-body-sm">
          {t('ticket.reassignment.time_left', { minutes: left })}
        </p>
        <p className="text-body-sm text-text-muted">
          {t('ticket.reassignment.no_answer_hint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {button(
            'respond_reassignment',
            'accept',
            t('ticket.reassignment.accept'),
            name
              ? t('ticket.reassignment.answered_accept', { first_name: name })
              : t('ticket.reassignment.answered_accept_unnamed'),
            { describedBy: 'reassignment-detail' },
          )}
          {button(
            'respond_reassignment',
            'refuse',
            t('ticket.reassignment.refuse'),
            t('ticket.reassignment.answered_refuse'),
            { variant: 'secondary', describedBy: 'reassignment-detail' },
          )}
        </div>
      </section>
    );
  }

  if (kind === 'stylist_change') {
    // E7, E8, E25: « Attendre » only while the stylist still cuts hair today.
    const wait = offersWait(ticket);
    return (
      <section aria-labelledby="stylist-change-title" className={box}>
        <h2 className="font-semibold" id="stylist-change-title">
          {t('ticket.stylist_change.banner')}
        </h2>
        <p className="text-body-sm text-text-muted">
          {wait
            ? t('ticket.stylist_change.no_answer_wait', {
                first_name: ticket.requested_stylist_first_name,
              })
            : t('ticket.stylist_change.no_answer_first_available')}
        </p>
        <div className="flex flex-wrap gap-2">
          {wait
            ? button(
                'resolve_stylist_change',
                'wait',
                t('ticket.stylist_change.wait', {
                  first_name: ticket.requested_stylist_first_name,
                }),
                t('ticket.stylist_change.answered_wait', {
                  first_name: ticket.requested_stylist_first_name,
                }),
                { variant: 'secondary' },
              )
            : null}
          {button(
            'resolve_stylist_change',
            'first_available',
            t('ticket.stylist_change.first_available'),
            t('ticket.stylist_change.answered_first_available'),
          )}
        </div>
      </section>
    );
  }

  if (kind === 'end_of_day') {
    // U-11 (H9): one warning, the client stays or cancels.
    return (
      <section aria-labelledby="end-of-day-title" className={box}>
        <h2 className="font-semibold" id="end-of-day-title">
          {t('ticket.end_of_day.banner')}
        </h2>
        <p className="text-body-sm" id="end-of-day-hint">
          {t('ticket.end_of_day.hint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {button(
            'respond_end_of_day',
            'stay',
            t('ticket.end_of_day.stay'),
            t('ticket.end_of_day.answered_stay'),
            { describedBy: 'end-of-day-hint' },
          )}
          <Button
            aria-describedby="end-of-day-hint"
            aria-disabled={busy || undefined}
            onClick={() => !busy && onCancelEndOfDay()}
            variant="danger"
          >
            {t('ticket.end_of_day.cancel')}
          </Button>
        </div>
      </section>
    );
  }
  return null;
}

/** U-10 and U-15: what moved his time, once it is still true (silent: the screen announces the time). */
export function TicketNotes({ ticket }: { ticket: ClientTicket }) {
  const { t } = useTranslation('client');
  const time = useTime();
  const now = useNow(30_000);
  const changeReason = useChangeReason();
  if (ticket.status !== 'waiting') return null;

  // U-15 (R5): an appointment the salon runs late on.
  const salonLate =
    ticket.kind === 'appointment' &&
    ticket.scheduled_at &&
    ticket.estimated_start_at &&
    Date.parse(ticket.estimated_start_at) - Date.parse(ticket.scheduled_at) >=
      SALON_LATE_MS
      ? t('ticket.appointment.salon_late', {
          time: time(ticket.estimated_start_at),
        })
      : null;

  // U-10 (E11): the last change, with its reason.
  const change =
    ticket.last_change &&
    now - Date.parse(ticket.last_change.at) < CHANGE_SHOWN_MS
      ? ticket.last_change
      : null;
  const reason = changeReason(change?.reason ?? null);
  const changeText = !change
    ? null
    : change.type === 'postponed' && ticket.position !== null
      ? t('ticket.change_banner.postponed', {
          position: ticket.position,
          reason,
        })
      : ticket.estimated_start_at
        ? t('ticket.change_banner.estimate', {
            time: time(ticket.estimated_start_at),
            reason,
          })
        : null;

  return (
    <>
      {salonLate ? (
        <Banner silent tone="warning">
          {salonLate}
        </Banner>
      ) : null}
      {changeText ? (
        <Banner silent tone="info">
          {changeText}
        </Banner>
      ) : null}
    </>
  );
}

/** The client-facing text of a change reason (K26); empty when unknown. */
export function useChangeReason(): (reason: string | null) => string {
  const { t } = useTranslation('common');
  return (reason) =>
    reason
      ? t(`change_reason.${reason as 'service_longer'}`, { defaultValue: '' })
      : '';
}
