import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';
import { Banner, Button, ConnectionBanner, Skeleton } from '@zelate/ui';
import { BoardControls } from './BoardControls';
import { EndOfDay } from './EndOfDay';
import { PresenceDialog } from './PresenceDialog';
import type { PresenceAction } from './PresenceDialog';
import { TicketPanel } from './TicketPanel';
import { WalkInDialog } from './WalkInDialog';
import { boardColumns, liveColumns, ticketStylistId } from '../lib/board-api';
import type { BoardStylist, BoardTicket } from '../lib/board-api';
import { loadServiceOptions } from '../lib/queue-api';
import type { PresenceStatus } from '../lib/queue-api';
import type { SetupSalon } from '../lib/setup-api';
import { timeParts } from '../lib/stylist';
import { useBoard } from '../lib/use-board';

const BOARD_HEADING = 'board-heading';

function useBoardTitle(): void {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  useEffect(() => {
    document.title = t('board.page_title', { app: tCommon('brand.pro_name') });
  }, [t, tCommon]);
}

/**
 * One polite message, read again even when the same text comes back. The
 * outcome of the manager's own action wins: a board change seen within 2 s of
 * it (usually that same action, re-read) is not announced over it.
 */
function useAnnouncer() {
  const [message, setMessage] = useState('');
  const lastAction = useRef(0);
  const say = useCallback((text: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(text), 50);
  }, []);
  const announce = useCallback(
    (text: string) => {
      lastAction.current = Date.now();
      say(text);
    },
    [say],
  );
  const announceChange = useCallback(
    (text: string) => {
      if (Date.now() - lastAction.current < 2_000) return;
      say(text);
    },
    [say],
  );
  return { message, announce, announceChange };
}

/**
 * Changes made by others (DESIGN_SYSTEM §9): a new client, an arrival, an
 * appointment to confirm. One message per event, nothing on the first load.
 */
function useBoardEvents(
  tickets: BoardTicket[] | undefined,
  announce: (text: string) => void,
) {
  const { t } = useTranslation('pro-manager');
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!tickets) return;
    const events = tickets.flatMap((ticket) => {
      const name = { first_name: ticket.display_name };
      return [
        { key: `new:${ticket.id}`, text: t('board.announce.joined', name) },
        ...(ticket.arrived_at !== null
          ? [
              {
                key: `in:${ticket.id}`,
                text: t('board.announce.arrived', name),
              },
            ]
          : []),
        ...(ticket.status === 'pending_confirmation'
          ? [
              {
                key: `rdv:${ticket.id}`,
                text: t('board.announce.pending', name),
              },
            ]
          : []),
      ];
    });
    const first = seen.current === null;
    const known = seen.current ?? new Set<string>();
    const fresh = events.filter((e) => !known.has(e.key));
    for (const e of events) known.add(e.key);
    seen.current = known;
    if (!first && fresh.length > 0) {
      announce(fresh.map((e) => e.text).join(' '));
    }
  }, [announce, t, tickets]);
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
        data-ticket={ticket.id}
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
            // S-13 (E27): a request waiting for the client, or how it ended.
            ticket.reassignment_member_id !== null
              ? t('board.ticket.reassignment_waiting')
              : ticket.reassignment_resolved === 'refused'
                ? t('board.ticket.reassignment_refused')
                : ticket.reassignment_resolved === 'expired'
                  ? t('board.ticket.reassignment_expired')
                  : null,
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
  serviceNames,
  stylist,
  tickets,
}: {
  disabled: boolean;
  onAction: (action: PresenceAction) => void;
  onOpen: (ticket: BoardTicket) => void;
  serviceNames: Map<string, string>;
  stylist: BoardStylist;
  tickets: BoardTicket[];
}) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const status: PresenceStatus = stylist.status ?? 'offline';
  return (
    <section
      aria-labelledby={`col-${stylist.member_id}`}
      className="grid content-start gap-2 rounded-lg border border-border p-3"
    >
      <h3
        className="text-h3 focus:outline-none"
        id={`col-${stylist.member_id}`}
        tabIndex={-1}
      >
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
            aria-describedby={disabled ? 'board-offline' : undefined}
            aria-disabled={disabled || undefined}
            key={action}
            onClick={() => !disabled && onAction(action)}
            size="sm"
            variant="secondary"
          >
            {t(`presence.menu.${action}`)}
          </Button>
        ))}
      </div>
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

/** Moves the focus once the dialog has handed it back (Radix restores it first). */
function focusLater(id: string) {
  window.setTimeout(() => {
    (
      document.getElementById(id) ?? document.getElementById(BOARD_HEADING)
    )?.focus();
  }, 0);
}

/** `/dashboard` (F-M6 to F-M10, F-M12): the live board of the salon. */
export function DashboardPage() {
  const salon = useOutletContext<SetupSalon>();
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  useBoardTitle();
  const { message, announce, announceChange } = useAnnouncer();
  const [presence, setPresence] = useState<{
    action: PresenceAction;
    memberId: string;
  } | null>(null);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const { board, live, lost } = useBoard(salon.id);
  const services = useQuery({
    queryKey: ['service-options', salon.id],
    queryFn: () => loadServiceOptions(salon.id),
  });
  useBoardEvents(board.data?.tickets, announceChange);

  // The open ticket left the board (served, cancelled elsewhere): say why the panel closed.
  const openTicket =
    board.data?.tickets.find((x) => x.id === openTicketId) ?? null;
  const lastOpen = useRef<BoardTicket | null>(null);
  useEffect(() => {
    if (openTicket) {
      lastOpen.current = openTicket;
      return;
    }
    if (openTicketId && board.data && lastOpen.current) {
      announce(
        t('board.announce.panel_closed', {
          first_name: lastOpen.current.display_name,
        }),
      );
      setOpenTicketId(null);
      focusLater(BOARD_HEADING);
    }
  }, [announce, board.data, openTicket, openTicketId, t]);

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
  const cutters = boardColumns(stylists);
  const columns = liveColumns(stylists, tickets);
  const manager = stylists.find((s) => s.role === 'manager');
  const managerBusy = tickets.some(
    (x) =>
      x.assigned_member_id === manager?.member_id &&
      (x.status === 'called' || x.status === 'in_service'),
  );
  const canTakeNext =
    manager !== undefined &&
    !manager.is_hairdressing &&
    !managerBusy &&
    tickets.some((x) => x.status === 'waiting' && x.kind === 'queue');
  const pendingCount = tickets.filter(
    (x) => x.status === 'pending_confirmation',
  ).length;
  const unassigned = tickets.filter((ticket) => {
    const id = ticketStylistId(ticket);
    return id === null || !columns.some((c) => c.member_id === id);
  });
  const presenceStylist = presence
    ? columns.find((c) => c.member_id === presence.memberId)
    : undefined;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8">
      <header className="grid gap-2">
        <h1
          className="text-h1 focus:outline-none"
          id={BOARD_HEADING}
          tabIndex={-1}
        >
          {salon.name}
        </h1>
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
        {lost ? (
          <p className="sr-only" id="board-offline">
            {t('board.offline_banner')}
          </p>
        ) : null}
        <BoardControls
          announce={announce}
          canTakeNext={canTakeNext}
          disabled={lost}
          indicators={indicators}
          manager={manager}
          salonId={salon.id}
        />
        <div>
          <WalkInDialog
            announce={announce}
            disabled={lost}
            salonId={salon.id}
            services={services.data ?? []}
            stylists={cutters}
          />
        </div>
        <p aria-live="polite" className="sr-only" role="status">
          {message}
        </p>
        {pendingCount > 0 ? (
          <Banner tone="warning">
            <Link
              className="font-semibold underline"
              to="/dashboard/appointments"
            >
              {t('board.pending_appointments.banner', { count: pendingCount })}
            </Link>
          </Banner>
        ) : null}
      </header>

      <EndOfDay
        announce={announce}
        disabled={lost}
        indicators={indicators}
        salonId={salon.id}
        tickets={tickets}
      />

      {tickets.length === 0 ? <Banner>{t('board.empty')}</Banner> : null}

      <section aria-labelledby="columns-title" className="grid gap-3">
        <h2 className="sr-only" id="columns-title">
          {t('board.columns_label')}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {columns.map((stylist) => (
            <StylistColumn
              disabled={lost}
              key={stylist.member_id}
              onAction={(action) =>
                setPresence({ action, memberId: stylist.member_id })
              }
              onOpen={(ticket) => setOpenTicketId(ticket.id)}
              serviceNames={serviceNames}
              stylist={stylist}
              tickets={tickets.filter(
                (ticket) => ticketStylistId(ticket) === stylist.member_id,
              )}
            />
          ))}
        </div>
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
      {openTicket ? (
        <TicketPanel
          onClose={() => setOpenTicketId(null)}
          onDone={(text, memberId) => {
            lastOpen.current = null;
            setOpenTicketId(null);
            announce(text);
            focusLater(memberId ? `col-${memberId}` : BOARD_HEADING);
          }}
          salonId={salon.id}
          stylists={cutters}
          ticket={openTicket}
        />
      ) : null}
      {presence && presenceStylist ? (
        <PresenceDialog
          action={presence.action}
          announce={announce}
          onClose={() => setPresence(null)}
          queueVersion={indicators.queue_version}
          salonId={salon.id}
          stylist={presenceStylist}
          tickets={tickets}
        />
      ) : null}
    </main>
  );
}
