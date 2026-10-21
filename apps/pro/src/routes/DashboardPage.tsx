import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useOutletContext } from 'react-router';
import { Banner, Button, ConnectionBanner, Skeleton } from '@zelate/ui';
import { BoardControls } from './BoardControls';
import { PresenceDialog } from './PresenceDialog';
import type { PresenceAction } from './PresenceDialog';
import { TicketPanel } from './TicketPanel';
import { WalkInDialog } from './WalkInDialog';
import { boardColumns, loadBoard, ticketStylistId } from '../lib/board-api';
import type { BoardStylist, BoardTicket } from '../lib/board-api';
import { useCommand } from '../lib/use-command';
import { AccessLost, loadServiceOptions } from '../lib/queue-api';
import type { PresenceStatus } from '../lib/queue-api';
import type { SetupSalon } from '../lib/setup-api';
import {
  LIVE_POLL_MS,
  POLL_MS,
  queryKeys,
  timeParts,
  useOnline,
  useSalonRealtime,
} from '../lib/stylist';

function useBoardTitle(): void {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  useEffect(() => {
    document.title = t('board.page_title', { app: tCommon('brand.pro_name') });
  }, [t, tCommon]);
}

function TicketLine({
  onOpen,
  serviceName,
  ticket,
}: {
  onOpen: (ticket: BoardTicket) => void;
  serviceName: string | undefined;
  ticket: BoardTicket;
}) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const time = (iso: string) => tCommon('formats.time', timeParts(iso));
  const approach =
    ticket.arrived_at !== null
      ? tCommon('approach_status.arrived')
      : ticket.eta_response === 'late'
        ? tCommon('approach_status.late', {
            minutes: ticket.declared_delay_minutes ?? 0,
          })
        : ticket.eta_response === 'on_time'
          ? tCommon('approach_status.confirmed')
          : null;
  return (
    <li>
      <button
        className="grid min-h-11 w-full gap-0.5 rounded-lg border border-border px-3 py-2 text-left"
        onClick={() => onOpen(ticket)}
        type="button"
      >
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{ticket.display_name}</span>
          <span className="text-body-sm text-text-muted">
            {tCommon(`ticket_status.${ticket.status}`)}
          </span>
        </span>
        <span className="block text-body-sm text-text-muted">
          {[
            serviceName,
            ticket.kind === 'appointment' && ticket.scheduled_at
              ? t('board.ticket.appointment_time', {
                  time: time(ticket.scheduled_at),
                })
              : ticket.estimated_start_at
                ? time(ticket.estimated_start_at)
                : null,
            approach,
          ]
            .filter((part): part is string => Boolean(part))
            .join(' · ')}
        </span>
      </button>
    </li>
  );
}

const ACTIONS: PresenceAction[] = ['absent', 'late', 'leaving_early', 'break'];

function StylistColumn({
  disabled,
  onAction,
  onOpen,
  onTakeNext,
  serviceNames,
  stylist,
  tickets,
}: {
  disabled: boolean;
  onAction: (action: PresenceAction) => void;
  onOpen: (ticket: BoardTicket) => void;
  onTakeNext: (ticket: BoardTicket) => void;
  serviceNames: Map<string, string>;
  stylist: BoardStylist;
  tickets: BoardTicket[];
}) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const status: PresenceStatus = stylist.status ?? 'offline';
  const next =
    stylist.role === 'manager' &&
    stylist.is_hairdressing &&
    !tickets.some((x) => x.status === 'called' || x.status === 'in_service')
      ? tickets
          .filter((x) => x.status === 'waiting' && x.kind === 'queue')
          .sort((a, b) => a.queue_rank - b.queue_rank)[0]
      : undefined;
  return (
    <section
      aria-labelledby={`col-${stylist.member_id}`}
      className="grid content-start gap-2 rounded-lg border border-border p-3"
    >
      <h3 className="text-h3" id={`col-${stylist.member_id}`}>
        {stylist.first_name}
      </h3>
      <p className="text-body-sm text-text-muted">
        {tCommon(`presence_status.${status}`)}
      </p>
      <div
        aria-label={t('presence.menu.label', {
          stylist_name: stylist.first_name,
        })}
        className="flex flex-wrap gap-1"
        role="group"
      >
        {ACTIONS.map((action) => (
          <Button
            disabled={disabled}
            key={action}
            onClick={() => onAction(action)}
            size="sm"
            variant="secondary"
          >
            {t(`presence.menu.${action}`)}
          </Button>
        ))}
      </div>
      {next ? (
        <Button disabled={disabled} onClick={() => onTakeNext(next)} size="sm">
          {t('board.take_next')}
        </Button>
      ) : null}
      <ul className="grid gap-2">
        {tickets.map((ticket) => (
          <TicketLine
            key={ticket.id}
            onOpen={onOpen}
            serviceName={
              ticket.service_id
                ? serviceNames.get(ticket.service_id)
                : undefined
            }
            ticket={ticket}
          />
        ))}
      </ul>
    </section>
  );
}

/** `/dashboard` (F-M6): the live board of the salon, read-only for now. */
export function DashboardPage() {
  const salon = useOutletContext<SetupSalon>();
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  useBoardTitle();
  const [live, setLive] = useState(false);
  const [message, setMessage] = useState('');
  const [presence, setPresence] = useState<{
    action: PresenceAction;
    memberId: string;
  } | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const command = useCommand();
  const realtime = useSalonRealtime(salon.id);
  useEffect(() => setLive(realtime), [realtime]);
  const online = useOnline();
  const board = useQuery({
    queryKey: queryKeys.board,
    queryFn: () => loadBoard(salon.id),
    refetchInterval: live ? LIVE_POLL_MS : POLL_MS,
    refetchOnWindowFocus: true,
    retry: (count, error) => !(error instanceof AccessLost) && count < 2,
  });
  const services = useQuery({
    queryKey: ['service-options', salon.id],
    queryFn: () => loadServiceOptions(salon.id),
  });

  async function takeNext(ticket: BoardTicket) {
    const outcome = await command.run('take_next', { ticket_id: ticket.id });
    if (outcome.ok) setMessage(t('board.take_next'));
  }

  if (board.error instanceof AccessLost) {
    return <Navigate replace to="/signin?next=%2Fdashboard" />;
  }
  if (!board.data) {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-5xl px-5 py-10">
        <Skeleton className="h-10 w-full" />
      </main>
    );
  }

  const { indicators, stylists, tickets } = board.data;
  const serviceNames = new Map(
    (services.data ?? []).map((service) => [service.id, service.name]),
  );
  const lost = !online || (!live && board.isError);
  const columns = boardColumns(stylists);
  const unassigned = tickets.filter((ticket) => {
    const id = ticketStylistId(ticket);
    return id === null || !columns.some((c) => c.member_id === id);
  });

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8">
      <header className="grid gap-2">
        <h1 className="text-h1">{salon.name}</h1>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm">
          <span>
            {tCommon(
              `queue_status.${indicators.is_full ? 'full' : indicators.queue_status}`,
            )}
          </span>
          <span>
            {t('board.header.waiting_count', {
              count: indicators.waiting_count,
            })}
          </span>
          {indicators.current_wait_minutes !== null ? (
            <span>
              {t('board.header.average_wait', {
                minutes: indicators.current_wait_minutes,
              })}
            </span>
          ) : null}
          {live && !lost ? (
            <span className="text-text-muted">{t('board.header.synced')}</span>
          ) : null}
        </p>
        <ConnectionBanner lost={lost} lostLabel={t('board.offline_banner')} />
        <BoardControls
          disabled={lost}
          indicators={indicators}
          manager={stylists.find((s) => s.role === 'manager')}
          salonId={salon.id}
        />
        <div>
          <WalkInDialog
            announce={setMessage}
            disabled={lost}
            salonId={salon.id}
            services={services.data ?? []}
            stylists={columns}
          />
        </div>
        <p aria-live="polite" className="sr-only" role="status">
          {message}
        </p>
        <nav aria-label={t('board.menu_label')}>
          <Link
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-link"
            to="/dashboard/setup"
          >
            {t('board.setup_link')}
          </Link>
        </nav>
      </header>

      {tickets.length === 0 ? <Banner>{t('board.empty')}</Banner> : null}

      <section
        aria-label={t('board.columns_label')}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {columns.map((stylist) => (
          <StylistColumn
            disabled={lost}
            key={stylist.member_id}
            onAction={(action) =>
              setPresence({ action, memberId: stylist.member_id })
            }
            onOpen={(ticket) => setOpenTicketId(ticket.id)}
            onTakeNext={(ticket) => void takeNext(ticket)}
            serviceNames={serviceNames}
            stylist={stylist}
            tickets={tickets.filter(
              (ticket) => ticketStylistId(ticket) === stylist.member_id,
            )}
          />
        ))}
      </section>

      {unassigned.length > 0 ? (
        <section aria-labelledby="first-available" className="grid gap-2">
          <h2 className="text-h2" id="first-available">
            {tCommon('first_available')}
          </h2>
          <ul className="grid gap-2">
            {unassigned.map((ticket) => (
              <TicketLine
                key={ticket.id}
                onOpen={(ticket) => setOpenTicketId(ticket.id)}
                serviceName={
                  ticket.service_id
                    ? serviceNames.get(ticket.service_id)
                    : undefined
                }
                ticket={ticket}
              />
            ))}
          </ul>
        </section>
      ) : null}
      {command.error ? (
        <Banner role="alert" tone="danger">
          {command.error}
        </Banner>
      ) : null}
      {openTicketId && tickets.find((x) => x.id === openTicketId) ? (
        <TicketPanel
          announce={setMessage}
          onClose={() => setOpenTicketId(null)}
          stylists={columns}
          ticket={tickets.find((x) => x.id === openTicketId)!}
        />
      ) : null}
      {presence && columns.find((c) => c.member_id === presence.memberId) ? (
        <PresenceDialog
          action={presence.action}
          onClose={() => setPresence(null)}
          stylist={columns.find((c) => c.member_id === presence.memberId)!}
          tickets={tickets}
        />
      ) : null}
    </main>
  );
}
