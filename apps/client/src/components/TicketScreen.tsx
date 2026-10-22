import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import {
  Banner,
  Button,
  ConnectionBanner,
  CountdownBadge,
  Dialog,
} from '@zelate/ui';
import { isActive } from '../lib/client-api';
import type { ClientTicket, TicketSalon, TicketView } from '../lib/client-api';
import {
  useClientCommand,
  useOnline,
  usePageTitle,
  useTime,
} from '../lib/live';
import { directionsUrl } from '../lib/places';
import { TicketBanners } from './TicketBanners';

const DELAYS = [5, 10, 15, 20, 30] as const;
const STAGE_HEADING = 'stage-title';

interface Props {
  view: TicketView;
  /** Holder of an SMS link: commands carry the token (ADR-006). */
  trackingToken?: string;
  /** Realtime is up; without it the page reads again every 30 s. */
  live: boolean;
  /** The last reads failed (offline, server down). */
  stale: boolean;
}

/** The code, spelled out for screen readers (« A F 2 K 9 »). */
function TicketCode({ code }: { code: string }) {
  const { t } = useTranslation('client');
  return (
    <div className="grid gap-1 text-center">
      <p className="text-body-sm text-text-muted">{t('ticket.code.label')}</p>
      <p className="font-display text-display font-bold tracking-[0.2em] tabular-nums">
        <span aria-hidden="true">{code}</span>
        <span className="sr-only">
          {t('ticket.code.aria', { code: code.split('').join(' ') })}
        </span>
      </p>
    </div>
  );
}

function Directions({ salon }: { salon: TicketSalon }) {
  const { t } = useTranslation('common');
  return (
    <a
      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 font-semibold"
      href={directionsUrl(salon)}
      rel="noreferrer"
      target="_blank"
    >
      {t('actions.directions')}
    </a>
  );
}

function EndScreen({
  ticket,
  salon,
}: {
  ticket: ClientTicket;
  salon: TicketSalon;
}) {
  const { t } = useTranslation('client');
  const status = ticket.status as 'completed' | 'cancelled' | 'no_show';
  const cancelReason =
    (
      [
        'client_cancelled',
        'end_of_day',
        'appointment_rejected',
        'removed_by_salon',
        'stylist_unavailable',
      ] as const
    ).find((r) => r === ticket.cancel_reason) ?? 'removed_by_salon';
  const reason =
    status === 'completed'
      ? t('ticket.end.reason.completed', { salon_name: salon.name })
      : status === 'no_show'
        ? t('ticket.end.reason.no_show')
        : cancelReason === 'appointment_rejected'
          ? t('ticket.end.reason.appointment_rejected', {
              reason: t(
                `ticket.end.removal_reasons.${(ticket.removal_reason ?? 'other') as 'other'}`,
              ),
            })
          : t(`ticket.end.reason.${cancelReason}`);
  const rejected =
    cancelReason === 'appointment_rejected' && status === 'cancelled';
  return (
    <section aria-labelledby={STAGE_HEADING} className="grid gap-4 text-center">
      <h2
        className="font-display text-h1 font-bold focus:outline-none"
        id={STAGE_HEADING}
        tabIndex={-1}
      >
        {t(`ticket.end.title.${status}`)}
      </h2>
      <p className="text-body-lg">{reason}</p>
      {ticket.removal_reason && !rejected ? (
        <p className="text-body-sm text-text-muted">
          {t('ticket.end.removal_reason', {
            reason: t(
              `ticket.end.removal_reasons.${ticket.removal_reason as 'other'}`,
            ),
          })}
        </p>
      ) : null}
      {rejected ? (
        // F-C12: the appointment was not found, the queue stays open to him.
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-text-on-primary"
          to={`/salons/${salon.slug}/join`}
        >
          {t('qr.choice.join_queue')}
        </Link>
      ) : (
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-text-on-primary"
          to="/"
        >
          {t('ticket.end.rejoin')}
        </Link>
      )}
    </section>
  );
}

/** One polite line when the position or the time really changes (DESIGN_SYSTEM §9). */
function useChangeAnnouncement(ticket: ClientTicket): string {
  const { t } = useTranslation('client');
  const time = useTime();
  const previous = useRef<{
    position: number | null;
    start: string | null;
  } | null>(null);
  const [text, setText] = useState('');
  const start = ticket.estimated_start_at;
  const position = ticket.position;
  useEffect(() => {
    const before = previous.current;
    previous.current = { position, start };
    if (!before || ticket.status !== 'waiting') return;
    const parts: string[] = [];
    if (position !== null && position !== before.position) {
      parts.push(t('ticket.position', { count: position }));
    }
    if (start && start !== before.start) {
      parts.push(t('ticket.estimated_time', { time: time(start) }));
    }
    if (parts.length > 0) setText(parts.join('. '));
  }, [position, start, t, ticket.status, time]);
  return text;
}

/** F-C5 to F-C8 and F-C10: the tracking screen of one ticket. */
export function TicketScreen({ view, trackingToken, live, stale }: Props) {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const time = useTime();
  const online = useOnline();
  const command = useClientCommand(trackingToken);
  const { ticket, salon } = view;
  const [dialog, setDialog] = useState<'late' | 'cancel' | null>(null);
  const [notice, setNotice] = useState('');
  const change = useChangeAnnouncement(ticket);

  const called = ticket.status === 'called' && ticket.arrived_at === null;
  const seated =
    ticket.status === 'in_service' ||
    (ticket.status === 'called' && ticket.arrived_at !== null);
  usePageTitle(called ? t('ticket.called.title') : t('ticket.page_title'));

  // The stage changes (called, arrived, ended): any dialog closes and the
  // focus goes to the new heading (WCAG 2.4.3).
  const stage = `${ticket.status}|${ticket.arrived_at ?? ''}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setDialog(null);
    window.setTimeout(() => document.getElementById(STAGE_HEADING)?.focus(), 0);
  }, [stage]);

  // The button that opened a dialog may be gone: the focus goes to the stage.
  const focusStage = (event: Event) => {
    event.preventDefault();
    document.getElementById(STAGE_HEADING)?.focus();
  };

  const lost = !online || (stale && !live);
  const updated = salon.estimate_updated_at;

  async function answerEta(
    response: 'on_time' | 'late' | 'cancel',
    delay?: number,
  ) {
    const outcome = await command.run('respond_eta', {
      ticket_id: ticket.id,
      response,
      ...(delay ? { delay_minutes: delay } : {}),
    });
    if (!outcome.ok) return;
    setDialog(null);
    if (response === 'late') setNotice(t('ticket.late.sent'));
  }

  async function cancel() {
    const outcome = await command.run('cancel_ticket', {
      ticket_id: ticket.id,
    });
    if (outcome.ok) setDialog(null);
  }

  async function setConsent(consent: boolean) {
    await command.run('set_notifications_consent', {
      ticket_id: ticket.id,
      consent,
    });
  }

  if (!isActive(ticket)) {
    return <EndScreen salon={salon} ticket={ticket} />;
  }

  const askEta =
    ticket.status === 'waiting' &&
    ticket.turn_approaching_sent_at !== null &&
    ticket.eta_response === null;

  return (
    <div className="grid gap-5">
      <ConnectionBanner
        lost={lost}
        lostLabel={
          updated
            ? t('ticket.offline', { time: time(updated) })
            : t('ticket.offline_unknown')
        }
      />
      <p aria-live="polite" className="sr-only" role="status">
        {notice || change}
      </p>

      {called ? (
        <section
          aria-labelledby={STAGE_HEADING}
          className="grid gap-5 rounded-xl border-2 border-success bg-success-subtle p-6 text-center"
        >
          <h2
            className="font-display text-h1 font-bold text-success-text focus:outline-none"
            id={STAGE_HEADING}
            tabIndex={-1}
          >
            {t('ticket.called.title')}
          </h2>
          <p className="text-body-lg">
            {t('ticket.called.stylist', {
              first_name: ticket.assigned_stylist_first_name ?? '',
              salon_name: salon.name,
            })}
          </p>
          <p className="text-body-sm">
            {salon.address_line}, {salon.postal_code} {salon.city}
          </p>
          <div className="rounded-lg bg-surface p-4">
            <TicketCode code={ticket.short_code} />
            <p className="text-body-sm text-text-muted">
              {t('ticket.called.code_hint')}
            </p>
          </div>
          {ticket.release_due_at ? (
            <div className="flex justify-center">
              {/* Read at 5 min and at 1 min only (DESIGN_SYSTEM §7.3). */}
              <CountdownBadge
                announce={(minutes) =>
                  t('ticket.called.countdown_aria', { minutes })
                }
                deadline={Date.parse(ticket.release_due_at)}
                label={t('ticket.called.countdown_label')}
              />
            </div>
          ) : null}
          <Directions salon={salon} />
        </section>
      ) : null}

      {seated ? (
        <section
          aria-labelledby={STAGE_HEADING}
          className="grid gap-3 rounded-xl border border-border p-5"
        >
          <h2
            className="font-display text-h2 font-bold focus:outline-none"
            id={STAGE_HEADING}
            tabIndex={-1}
          >
            {t('ticket.arrived.title')}
          </h2>
          <p>{t('ticket.arrived.body')}</p>
        </section>
      ) : null}

      {ticket.status === 'pending_confirmation' ? (
        <section
          aria-labelledby={STAGE_HEADING}
          className="grid gap-3 rounded-xl border border-border p-5"
        >
          <h2
            className="font-display text-h2 font-bold focus:outline-none"
            id={STAGE_HEADING}
            tabIndex={-1}
          >
            {t('ticket.appointment.pending')}
          </h2>
          <p className="text-text-muted">
            {t('ticket.appointment.pending_hint')}
          </p>
        </section>
      ) : null}

      {ticket.status === 'waiting' ? (
        <section
          aria-labelledby={STAGE_HEADING}
          className="grid gap-4 rounded-xl border border-border bg-surface p-5 shadow-md"
        >
          <h2
            className="text-center font-semibold focus:outline-none"
            id={STAGE_HEADING}
            tabIndex={-1}
          >
            {salon.name}
          </h2>
          <TicketCode code={ticket.short_code} />
          {ticket.kind === 'appointment' && ticket.scheduled_at ? (
            <p className="text-body-lg font-semibold">
              {t('ticket.appointment.times', {
                appointment_time: time(ticket.scheduled_at),
                start_time: ticket.estimated_start_at
                  ? time(ticket.estimated_start_at)
                  : '',
              })}
            </p>
          ) : (
            <>
              {ticket.position !== null ? (
                <p className="text-h3 font-semibold">
                  {t('ticket.position', { count: ticket.position })}
                </p>
              ) : null}
              {ticket.estimated_start_at ? (
                <p className="text-body-lg">
                  {t('ticket.estimated_time', {
                    time: time(ticket.estimated_start_at),
                  })}
                </p>
              ) : null}
            </>
          )}
          <p>
            <span className="text-text-muted">
              {t('ticket.stylist.label')} :{' '}
            </span>
            {ticket.requested_stylist_first_name ??
              t('ticket.stylist.first_available')}
          </p>
          {updated ? (
            <p className="text-body-sm text-text-muted">
              {t('ticket.updated_at', { time: time(updated) })}
            </p>
          ) : null}
        </section>
      ) : null}

      <TicketBanners command={command} ticket={ticket} />

      {askEta ? (
        <section
          aria-labelledby="eta-title"
          className="grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4"
        >
          <h2 className="font-semibold" id="eta-title">
            {t('ticket.turn_approaching.banner')}
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button
              loading={command.busy === 'respond_eta'}
              onClick={() => void answerEta('on_time')}
            >
              {t('ticket.turn_approaching.on_time')}
            </Button>
            <Button onClick={() => setDialog('late')} variant="secondary">
              {t('ticket.turn_approaching.late')}
            </Button>
            <Button onClick={() => setDialog('cancel')} variant="ghost">
              {t('ticket.turn_approaching.cancel')}
            </Button>
          </div>
        </section>
      ) : null}

      {command.error && dialog === null ? (
        <Banner role="alert" tone="danger">
          {command.error}
        </Banner>
      ) : null}

      {ticket.status === 'waiting' ||
      ticket.status === 'pending_confirmation' ? (
        // E17, K34: the anticipation messages, for this place only.
        <div className="flex min-h-11 items-start gap-3">
          <input
            aria-describedby="consent-hint"
            checked={ticket.notifications_consent}
            className="mt-1 size-6"
            id="ticket-consent"
            onChange={(e) => void setConsent(e.target.checked)}
            type="checkbox"
          />
          <div className="grid gap-1">
            <label className="font-semibold" htmlFor="ticket-consent">
              {t('join.summary.consent')}
            </label>
            <p className="text-body-sm text-text-muted" id="consent-hint">
              {t('join.summary.consent_hint')}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        {ticket.status === 'waiting' && ticket.kind === 'queue' && !askEta ? (
          <Button onClick={() => setDialog('late')} variant="secondary">
            {t('ticket.actions.late')}
          </Button>
        ) : null}
        {!called ? <Directions salon={salon} /> : null}
        {ticket.status !== 'in_service' ? (
          <Button onClick={() => setDialog('cancel')} variant="ghost">
            {t('ticket.actions.cancel')}
          </Button>
        ) : null}
      </div>

      <Dialog
        closeLabel={tCommon('actions.close')}
        description={t('ticket.late.hint')}
        onCloseAutoFocus={focusStage}
        onOpenChange={(open) => setDialog(open ? 'late' : null)}
        open={dialog === 'late'}
        title={t('ticket.late.title')}
      >
        <div className="grid gap-3">
          <div className="grid grid-cols-3 gap-2">
            {DELAYS.map((minutes) => (
              <Button
                key={minutes}
                loading={command.busy === 'respond_eta'}
                onClick={() => void answerEta('late', minutes)}
                variant="secondary"
              >
                {t('ticket.late.option', { minutes })}
              </Button>
            ))}
          </div>
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        closeLabel={tCommon('actions.close')}
        description={t('cancel_dialog.body')}
        onCloseAutoFocus={focusStage}
        onOpenChange={(open) => setDialog(open ? 'cancel' : null)}
        open={dialog === 'cancel'}
        title={t('cancel_dialog.title')}
      >
        <div className="grid gap-3">
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setDialog(null)} variant="ghost">
              {t('cancel_dialog.keep')}
            </Button>
            <Button
              loading={command.busy !== null}
              onClick={() => void (askEta ? answerEta('cancel') : cancel())}
              variant="danger"
            >
              {t('cancel_dialog.confirm')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
