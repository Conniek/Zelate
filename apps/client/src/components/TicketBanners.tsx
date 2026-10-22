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

interface Props {
  ticket: ClientTicket;
  command: ReturnType<typeof useClientCommand>;
}

/** The requests and explanations of F-C5 (U-10, U-11, U-12, U-15, U-17). */
export function TicketBanners({ ticket, command }: Props) {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const time = useTime();
  const now = useNow(30_000);
  const busy = command.busy !== null;
  const waiting = ticket.status === 'waiting';

  // U-17 (E9): the salon offers another stylist, the time moves back.
  const reassignment =
    waiting &&
    ticket.reassignment_requested_at &&
    ticket.reassignment_proposed_start_at
      ? {
          left: Math.max(
            0,
            Math.floor(
              (Date.parse(ticket.reassignment_requested_at) +
                REASSIGNMENT_MS -
                now) /
                60_000,
            ),
          ),
          at: ticket.reassignment_proposed_start_at,
        }
      : null;

  // U-10 (E11): the last change, with its reason.
  const change =
    waiting &&
    ticket.last_change &&
    now - Date.parse(ticket.last_change.at) < CHANGE_SHOWN_MS
      ? ticket.last_change
      : null;
  const reason = change?.reason
    ? tCommon(`change_reason.${change.reason as 'service_longer'}`, {
        defaultValue: '',
      })
    : '';

  // U-15 (R5): an appointment the salon runs late on.
  const salonLate =
    waiting &&
    ticket.kind === 'appointment' &&
    ticket.scheduled_at &&
    ticket.estimated_start_at &&
    Date.parse(ticket.estimated_start_at) - Date.parse(ticket.scheduled_at) >=
      SALON_LATE_MS
      ? ticket.estimated_start_at
      : null;

  return (
    <>
      {reassignment ? (
        <section
          aria-labelledby="reassignment-title"
          className="grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4"
        >
          <h2 className="font-semibold" id="reassignment-title">
            {t('ticket.reassignment.banner')}
          </h2>
          <p>
            {t('ticket.reassignment.new_time', {
              first_name: ticket.reassignment_stylist_first_name ?? '',
              time: time(reassignment.at),
            })}
          </p>
          <p className="text-body-sm">
            {t('ticket.reassignment.time_left', { minutes: reassignment.left })}
          </p>
          <p className="text-body-sm text-text-muted">
            {t('ticket.reassignment.no_answer_hint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={command.busy === 'respond_reassignment'}
              onClick={() =>
                !busy &&
                void command.run('respond_reassignment', {
                  ticket_id: ticket.id,
                  choice: 'accept',
                })
              }
            >
              {t('ticket.reassignment.accept')}
            </Button>
            <Button
              onClick={() =>
                !busy &&
                void command.run('respond_reassignment', {
                  ticket_id: ticket.id,
                  choice: 'refuse',
                })
              }
              variant="secondary"
            >
              {t('ticket.reassignment.refuse')}
            </Button>
          </div>
        </section>
      ) : null}

      {waiting && ticket.stylist_change_pending_since ? (
        // U-12 (E7, E8, E25): « Attendre » only while the stylist still cuts hair today.
        <section
          aria-labelledby="stylist-change-title"
          className="grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4"
        >
          <h2 className="font-semibold" id="stylist-change-title">
            {t('ticket.stylist_change.banner')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {ticket.wait_offered && ticket.requested_stylist_first_name ? (
              <Button
                loading={command.busy === 'resolve_stylist_change'}
                onClick={() =>
                  !busy &&
                  void command.run('resolve_stylist_change', {
                    ticket_id: ticket.id,
                    choice: 'wait',
                  })
                }
                variant="secondary"
              >
                {t('ticket.stylist_change.wait', {
                  first_name: ticket.requested_stylist_first_name,
                })}
              </Button>
            ) : null}
            <Button
              onClick={() =>
                !busy &&
                void command.run('resolve_stylist_change', {
                  ticket_id: ticket.id,
                  choice: 'first_available',
                })
              }
            >
              {t('ticket.stylist_change.first_available')}
            </Button>
          </div>
          <p className="text-body-sm text-text-muted">
            {ticket.wait_offered && ticket.requested_stylist_first_name
              ? t('ticket.stylist_change.no_answer_wait', {
                  first_name: ticket.requested_stylist_first_name,
                })
              : t('ticket.stylist_change.no_answer_first_available')}
          </p>
        </section>
      ) : null}

      {ticket.end_of_day_warned_at &&
      ticket.end_of_day_choice === null &&
      waiting ? (
        // U-11 (H9): one warning, the client stays or cancels.
        <section
          aria-labelledby="end-of-day-title"
          className="grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4"
        >
          <h2 className="font-semibold" id="end-of-day-title">
            {t('ticket.end_of_day.banner')}
          </h2>
          <p className="text-body-sm">{t('ticket.end_of_day.hint')}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={command.busy === 'respond_end_of_day'}
              onClick={() =>
                !busy &&
                void command.run('respond_end_of_day', {
                  ticket_id: ticket.id,
                  choice: 'stay',
                })
              }
            >
              {t('ticket.end_of_day.stay')}
            </Button>
            <Button
              onClick={() =>
                !busy &&
                void command.run('respond_end_of_day', {
                  ticket_id: ticket.id,
                  choice: 'cancel',
                })
              }
              variant="danger"
            >
              {t('ticket.end_of_day.cancel')}
            </Button>
          </div>
        </section>
      ) : null}

      {salonLate ? (
        <Banner tone="warning">
          {t('ticket.appointment.salon_late', { time: time(salonLate) })}
        </Banner>
      ) : null}

      {change ? (
        <Banner tone="info">
          {change.type === 'postponed' && ticket.position !== null
            ? t('ticket.change_banner.postponed', {
                position: ticket.position,
                reason,
              })
            : ticket.estimated_start_at
              ? t('ticket.change_banner.estimate', {
                  time: time(ticket.estimated_start_at),
                  reason,
                })
              : null}
        </Banner>
      ) : null}
    </>
  );
}
