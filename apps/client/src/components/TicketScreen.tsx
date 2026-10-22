import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Banner, Button, ConnectionBanner, Dialog } from '@zelate/ui';
import { isActive } from '../lib/client-api';
import type { ClientTicket, TicketSalon, TicketView } from '../lib/client-api';
import { useClientCommand, useNow, useOnline, useTime } from '../lib/live';

const DELAYS = [5, 10, 15, 20, 30] as const;

interface Props {
  view: TicketView;
  /** Holder of an SMS link: commands carry the token (ADR-006). */
  trackingToken?: string;
  /** Realtime is up; without it the page reads again every 30 s. */
  live: boolean;
  /** The last read failed (offline, server down). */
  stale: boolean;
}

/** Map app link: Apple Plans on iOS, `geo:` elsewhere (F-C2, F-C5). */
function directionsUrl(salon: TicketSalon): string {
  const address = `${salon.address_line}, ${salon.postal_code} ${salon.city}`;
  if (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
  }
  if (salon.latitude !== null && salon.longitude !== null) {
    return `geo:${salon.latitude},${salon.longitude}?q=${encodeURIComponent(address)}`;
  }
  return `geo:0,0?q=${encodeURIComponent(address)}`;
}

function TicketCode({ code }: { code: string }) {
  const { t } = useTranslation('client');
  return (
    <div className="grid gap-1 text-center">
      <p className="text-body-sm text-text-muted">{t('ticket.code.label')}</p>
      <p
        aria-label={t('ticket.code.aria', { code: code.split('').join(' ') })}
        className="font-display text-display font-bold tracking-[0.2em] tabular-nums"
      >
        {code}
      </p>
    </div>
  );
}

/** F-C5 « C'est votre tour » with the 10-min countdown (H4). */
function CalledScreen({
  ticket,
  salon,
}: {
  ticket: ClientTicket;
  salon: TicketSalon;
}) {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const now = useNow();
  const due = ticket.release_due_at ? Date.parse(ticket.release_due_at) : null;
  const left = due === null ? null : Math.max(0, due - now);
  const minutes = left === null ? null : Math.floor(left / 60_000);
  const seconds = left === null ? 0 : Math.floor((left % 60_000) / 1000);
  // Announced once a minute, not every second.
  const [spoken, setSpoken] = useState('');
  useEffect(() => {
    if (minutes === null) return;
    setSpoken(
      t('ticket.called.countdown_aria', { minutes: Math.max(1, minutes + 1) }),
    );
  }, [minutes, t]);
  return (
    <section
      aria-labelledby="called-title"
      className="grid gap-5 rounded-xl bg-primary p-6 text-center text-text-on-primary"
    >
      <h2
        className="font-display text-h1 font-bold"
        id="called-title"
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
      <div className="rounded-lg bg-surface p-4 text-text">
        <TicketCode code={ticket.short_code} />
        <p className="text-body-sm text-text-muted">
          {t('ticket.called.code_hint')}
        </p>
      </div>
      {left !== null ? (
        <p aria-hidden="true" className="font-display text-h2 tabular-nums">
          {t('ticket.called.countdown', {
            remaining: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
          })}
        </p>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {spoken}
      </p>
      <a
        className="inline-flex min-h-11 items-center justify-center rounded-lg bg-surface px-4 font-semibold text-text"
        href={directionsUrl(salon)}
        rel="noreferrer"
        target="_blank"
      >
        {tCommon('actions.directions')}
      </a>
    </section>
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
        'removed_by_salon',
        'stylist_unavailable',
      ] as const
    ).find((r) => r === ticket.cancel_reason) ?? 'removed_by_salon';
  const reason =
    status === 'completed'
      ? t('ticket.end.reason.completed', { salon_name: salon.name })
      : status === 'no_show'
        ? t('ticket.end.reason.no_show')
        : t(`ticket.end.reason.${cancelReason}`);
  return (
    <section aria-labelledby="end-title" className="grid gap-4 text-center">
      <h2
        className="font-display text-h1 font-bold"
        id="end-title"
        tabIndex={-1}
      >
        {t(`ticket.end.title.${status}`)}
      </h2>
      <p className="text-body-lg">{reason}</p>
      {ticket.removal_reason ? (
        <p className="text-body-sm text-text-muted">
          {t('ticket.end.removal_reason', {
            reason: t(
              `ticket.end.removal_reasons.${ticket.removal_reason as 'other'}`,
            ),
          })}
        </p>
      ) : null}
      <Link
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-text-on-primary"
        to="/"
      >
        {t('ticket.end.rejoin')}
      </Link>
    </section>
  );
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

  // The stage changes (called, arrived, ended): the focus follows (WCAG 2.4.3).
  const stage = `${ticket.status}|${ticket.arrived_at ?? ''}`;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById('stage-title')?.focus();
    document.getElementById('called-title')?.focus();
    document.getElementById('end-title')?.focus();
  }, [stage]);

  const lost = !online || (stale && !live);
  const updated = salon.estimate_updated_at ?? ticket.estimated_start_at;

  async function answerEta(
    response: 'on_time' | 'late' | 'cancel',
    delay?: number,
  ) {
    const outcome = await command.run('respond_eta', {
      ticket_id: ticket.id,
      response,
      ...(delay ? { delay_minutes: delay } : {}),
    });
    if (outcome.ok) {
      setDialog(null);
      if (response === 'late') setNotice(t('ticket.late.sent'));
    }
  }

  async function cancel() {
    const outcome = await command.run('cancel_ticket', {
      ticket_id: ticket.id,
    });
    if (outcome.ok) setDialog(null);
  }

  if (!isActive(ticket)) {
    return <EndScreen salon={salon} ticket={ticket} />;
  }

  const called = ticket.status === 'called' && ticket.arrived_at === null;
  const seated =
    ticket.status === 'in_service' ||
    (ticket.status === 'called' && ticket.arrived_at !== null);
  const askEta =
    ticket.status === 'waiting' &&
    ticket.turn_approaching_sent_at !== null &&
    ticket.eta_response === null;

  return (
    <div className="grid gap-5">
      <ConnectionBanner
        lost={lost}
        lostLabel={t('ticket.offline', { time: updated ? time(updated) : '' })}
      />
      <p aria-live="polite" className="sr-only" role="status">
        {notice}
      </p>

      {called ? <CalledScreen salon={salon} ticket={ticket} /> : null}

      {seated ? (
        <section
          aria-labelledby="stage-title"
          className="grid gap-3 rounded-xl border border-border p-5"
        >
          <h2
            className="font-display text-h2 font-bold"
            id="stage-title"
            tabIndex={-1}
          >
            {t('ticket.arrived.title')}
          </h2>
          <p>{t('ticket.arrived.body')}</p>
        </section>
      ) : null}

      {ticket.status === 'pending_confirmation' ? (
        <section
          aria-labelledby="stage-title"
          className="grid gap-3 rounded-xl border border-border p-5"
        >
          <h2
            className="font-display text-h2 font-bold"
            id="stage-title"
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
          aria-labelledby="stage-title"
          className="grid gap-4 rounded-xl border border-border bg-surface p-5 shadow-md"
        >
          <h2 className="sr-only" id="stage-title" tabIndex={-1}>
            {salon.name}
          </h2>
          <p className="text-center font-semibold">{salon.name}</p>
          <TicketCode code={ticket.short_code} />
          <dl className="grid gap-2">
            {ticket.kind === 'appointment' && ticket.scheduled_at ? (
              <div>
                <dt className="sr-only">
                  {t('ticket.estimated_time', { time: '' })}
                </dt>
                <dd className="text-body-lg font-semibold">
                  {t('ticket.appointment.times', {
                    appointment_time: time(ticket.scheduled_at),
                    start_time: ticket.estimated_start_at
                      ? time(ticket.estimated_start_at)
                      : '',
                  })}
                </dd>
              </div>
            ) : (
              <>
                {ticket.position !== null ? (
                  <div>
                    <dt className="sr-only">
                      {t('ticket.position', { count: ticket.position })}
                    </dt>
                    <dd className="text-h3 font-semibold">
                      {t('ticket.position', { count: ticket.position })}
                    </dd>
                  </div>
                ) : null}
                {ticket.estimated_start_at ? (
                  <div>
                    <dt className="sr-only">
                      {t('ticket.estimated_time', { time: '' })}
                    </dt>
                    <dd className="text-body-lg">
                      {t('ticket.estimated_time', {
                        time: time(ticket.estimated_start_at),
                      })}
                    </dd>
                  </div>
                ) : null}
              </>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">{t('ticket.stylist.label')}</dt>
              <dd>
                {ticket.requested_stylist_first_name ??
                  t('ticket.stylist.first_available')}
              </dd>
            </div>
          </dl>
          {updated ? (
            <p className="text-body-sm text-text-muted">
              {t('ticket.updated_at', { time: time(updated) })}
            </p>
          ) : null}
        </section>
      ) : null}

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

      <div className="grid gap-2">
        {ticket.status === 'waiting' && ticket.kind === 'queue' && !askEta ? (
          <Button onClick={() => setDialog('late')} variant="secondary">
            {t('ticket.actions.late')}
          </Button>
        ) : null}
        {!called ? (
          <a
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-strong px-4 font-semibold"
            href={directionsUrl(salon)}
            rel="noreferrer"
            target="_blank"
          >
            {tCommon('actions.directions')}
          </a>
        ) : null}
        {ticket.status !== 'in_service' ? (
          <Button onClick={() => setDialog('cancel')} variant="ghost">
            {t('ticket.actions.cancel')}
          </Button>
        ) : null}
      </div>

      <Dialog
        closeLabel={tCommon('actions.close')}
        description={t('ticket.late.hint')}
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
