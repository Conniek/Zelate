import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Banner, Button, Skeleton } from '@zelate/ui';
import { loadServiceOptions } from '../../lib/queue-api';
import type { QueueTicket } from '../../lib/queue-api';
import { useStylistQueue } from '../../lib/stylist';
import { useCommand } from '../../lib/use-command';
import { PendingAppointment } from './PendingAppointment';
import { PresenceBar } from './PresenceBar';
import { CallCard, ClientLine, ServiceCard } from './TicketCards';
import type { StylistOutlet } from './StylistLayout';

/** F-S4 · `/stylist/queue` (C-03 to C-09). */
export function StylistQueuePage() {
  const { t } = useTranslation('pro-stylist');
  const { ctx, lost } = useOutletContext<StylistOutlet>();
  const navigate = useNavigate();
  const command = useCommand();
  const queue = useStylistQueue(true);
  const services = useQuery({
    queryKey: ['services', ctx.salon_id],
    queryFn: () => loadServiceOptions(ctx.salon_id),
    staleTime: 5 * 60_000,
  });
  const me = ctx.member_id;
  const data = queue.data;

  // F-S8: a called client released by the server (no arrival in time).
  const lastCalled = useRef<QueueTicket | null>(null);
  const [released, setReleased] = useState<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const previous = lastCalled.current;
    if (
      previous &&
      !data.called &&
      data.current?.id !== previous.id &&
      command.busy === null
    ) {
      setReleased(previous.display_name);
    }
    if (data.called) setReleased(null);
    lastCalled.current = data.called;
  }, [command.busy, data]);

  if (!data) {
    return (
      <main className="grid gap-4 p-4" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const status = ctx.presence?.status ?? 'offline';
  const busyWithClient = data.current !== null || data.called !== null;
  const canCall =
    status === 'available' && !busyWithClient && data.next.length > 0;
  const upNext = busyWithClient ? data.next : data.next.slice(1);
  const nextClient = busyWithClient ? null : (data.next[0] ?? null);
  const disabled = lost;

  return (
    <>
      <main className="grid flex-1 gap-4 p-4 pb-32">
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
        {released ? (
          <Banner role="status" tone="warning">
            {t('call.released_banner', { first_name: released })}
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
            aria-labelledby="next-title"
            className="grid gap-2 rounded-xl border border-border bg-surface p-5 shadow-md"
          >
            <h2
              className="text-body-sm font-semibold uppercase text-text-muted"
              id="next-title"
            >
              {t('queue.next_client')}
            </h2>
            <ClientLine me={me} ticket={nextClient} />
          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-text-muted">
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

        <Link className="text-link underline" to="/stylist/appointments">
          {t('queue.my_appointments')}
        </Link>
      </main>

      {!busyWithClient ? (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface p-4">
          <div className="mx-auto grid max-w-xl gap-2">
            {command.error && !busyWithClient ? (
              <Banner role="alert" tone="danger">
                {command.error}
              </Banner>
            ) : null}
            <Button
              disabled={disabled || !canCall}
              fullWidth
              loading={command.busy === 'call_ticket'}
              onClick={() =>
                void command
                  .run('call_ticket', {}, ctx.salon_id)
                  .then((outcome) => {
                    if (outcome.ok) setReleased(null);
                  })
              }
              size="xl"
            >
              {t('queue.call')}
            </Button>
          </div>
        </div>
      ) : null}
      {status === 'off_duty' ? (
        <div className="px-4 pb-4">
          <Button
            onClick={() => void navigate('/stylist/summary')}
            variant="ghost"
          >
            {t('summary.title')}
          </Button>
        </div>
      ) : null}
    </>
  );
}
