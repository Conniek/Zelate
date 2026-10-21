import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';
import { Banner, Button, Skeleton } from '@zelate/ui';
import { loadServiceOptions } from '../../lib/queue-api';
import { timeParts, usePageTitle, useStylistQueue } from '../../lib/stylist';
import { useCommand } from '../../lib/use-command';
import { PendingAppointment } from './PendingAppointment';
import { PRESENCE_HEADING, PresenceBar } from './PresenceBar';
import {
  CallCard,
  ClientLine,
  STAGE_HEADING,
  ServiceCard,
} from './TicketCards';
import type { StylistOutlet } from './StylistLayout';

/** Moves the focus to a heading when `key` changes (not on the first render). */
function useFocusOnChange(key: string | null, id: string) {
  const first = useRef(true);
  useEffect(() => {
    if (key === null) return;
    if (first.current) {
      first.current = false;
      return;
    }
    document.getElementById(id)?.focus();
  }, [id, key]);
}

/** F-S4 · `/stylist/queue` (C-03 to C-09). */
export function StylistQueuePage() {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const { ctx, lost, live, announce } = useOutletContext<StylistOutlet>();
  usePageTitle(t('queue.title'));
  const command = useCommand();
  const queue = useStylistQueue(live);
  const services = useQuery({
    queryKey: ['services', ctx.salon_id],
    queryFn: () => loadServiceOptions(ctx.salon_id),
    staleTime: 5 * 60_000,
  });
  const me = ctx.member_id;
  const data = queue.data;
  const status = ctx.presence?.status ?? 'offline';

  // After each step the card changes: the focus follows it (WCAG 2.4.3).
  const stage = data
    ? `${data.current?.id ?? ''}|${data.called?.id ?? ''}|${data.called?.arrived_at ?? ''}`
    : null;
  useFocusOnChange(stage, STAGE_HEADING);
  useFocusOnChange(data ? status : null, PRESENCE_HEADING);

  // F-S8 and F-S10: one announcement per event, not the whole card.
  const released = data?.released ?? null;
  const announced = useRef(new Set<string>());
  useEffect(() => {
    if (!data) return;
    const events = [
      ...(released
        ? [
            {
              key: `released:${released.id}`,
              text: t('call.released_banner', {
                first_name: released.display_name,
              }),
            },
          ]
        : []),
      ...data.pending_appointments.map((ticket) => ({
        key: `pending:${ticket.id}`,
        text: t('queue.pending_appointment.banner', {
          first_name: ticket.display_name,
          time: ticket.scheduled_at
            ? tCommon('formats.time', timeParts(ticket.scheduled_at))
            : '',
        }),
      })),
    ];
    const fresh = events.filter((e) => !announced.current.has(e.key));
    // The first load only remembers what is already there.
    const firstLoad = !announced.current.has('loaded');
    for (const e of events) announced.current.add(e.key);
    announced.current.add('loaded');
    if (!firstLoad && fresh.length > 0)
      announce(fresh.map((e) => e.text).join(' '));
  }, [announce, data, released, t, tCommon]);

  if (!data) {
    return (
      <main aria-busy="true" className="grid gap-4 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const busyWithClient = data.current !== null || data.called !== null;
  const blockedReason =
    status !== 'available'
      ? t('queue.call_unavailable')
      : data.next.length === 0
        ? t('queue.call_no_client')
        : null;
  const upNext = busyWithClient ? data.next : data.next.slice(1);
  const nextClient = busyWithClient ? null : (data.next[0] ?? null);
  const disabled = lost;
  const showReleased =
    released !== null && !busyWithClient && data.called === null;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4">
      <h1 className="sr-only">{t('queue.title')}</h1>
      <PresenceBar
        appointments={data.appointments}
        command={command}
        ctx={ctx}
        disabled={disabled}
        requestedMe={data.next.filter((c) => c.requested_member_id === me)}
      />
      {data.pending_appointments.map((ticket) => (
        <PendingAppointment
          appointments={data.appointments}
          command={command}
          disabled={disabled}
          key={ticket.id}
          salonId={ctx.salon_id}
          ticket={ticket}
        />
      ))}
      {showReleased ? (
        <Banner tone="warning">
          {t('call.released_banner', { first_name: released.display_name })}
        </Banner>
      ) : null}

      {data.current ? (
        <ServiceCard
          command={command}
          disabled={disabled}
          me={me}
          salonId={ctx.salon_id}
          ticket={data.current}
        />
      ) : data.called ? (
        <CallCard
          command={command}
          disabled={disabled}
          key={`${data.called.id}:${data.called.call_count}`}
          me={me}
          salonId={ctx.salon_id}
          services={services.data ?? []}
          ticket={data.called}
          waitingAfter={data.next.length}
        />
      ) : nextClient ? (
        <section
          aria-labelledby={STAGE_HEADING}
          className="grid gap-2 rounded-xl border border-border bg-surface p-4 shadow-md"
        >
          <h2
            className="text-body font-semibold text-text-muted focus:outline-none"
            id={STAGE_HEADING}
            tabIndex={-1}
          >
            {t('queue.next_client')}
          </h2>
          <ClientLine me={me} ticket={nextClient} />
        </section>
      ) : (
        <p
          className="rounded-xl border border-dashed border-border p-6 text-center text-text-muted focus:outline-none"
          id={STAGE_HEADING}
          tabIndex={-1}
        >
          {t('queue.empty')}
        </p>
      )}

      {upNext.length > 0 ? (
        <section aria-labelledby="up-next-title" className="grid gap-2">
          <h2 className="text-h3" id="up-next-title">
            {t('queue.up_next')}
          </h2>
          <ol className="grid gap-2">
            {upNext.map((ticket) => (
              <li
                className="min-h-[72px] rounded-lg border border-border p-3"
                key={ticket.id}
              >
                <ClientLine me={me} ticket={ticket} />
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-4">
        <Link
          className="inline-flex min-h-11 items-center text-link underline"
          to="/stylist/appointments"
        >
          {t('queue.my_appointments')}
        </Link>
        {status === 'off_duty' ? (
          <Link
            className="inline-flex min-h-11 items-center text-link underline"
            to="/stylist/summary"
          >
            {t('summary.title')}
          </Link>
        ) : null}
      </div>

      {/* Inside <main> and sticky: never hides the content or the focus (WCAG 2.4.11). */}
      {!busyWithClient ? (
        <div className="sticky bottom-0 -mx-4 mt-auto grid gap-2 border-t border-border bg-surface p-4">
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          {blockedReason ? (
            <p className="text-body-sm text-text-muted" id="call-reason">
              {blockedReason}
            </p>
          ) : null}
          <Button
            aria-describedby={blockedReason ? 'call-reason' : undefined}
            aria-disabled={disabled || blockedReason !== null || undefined}
            fullWidth
            loading={command.busy === 'call_ticket'}
            onClick={() => void command.run('call_ticket', {}, ctx.salon_id)}
            size="xl"
          >
            {t('queue.call')}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
