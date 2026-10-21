import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { Banner, Button, Skeleton, TextField } from '@zelate/ui';
import { boardColumns, loadAuditLog, loadBoard } from '../lib/board-api';
import type { AuditEvent, AuditFilters } from '../lib/board-api';
import type { SetupSalon } from '../lib/setup-api';
import { queryKeys, timeParts } from '../lib/stylist';

const TYPES = [
  'created',
  'assigned',
  'reassigned',
  'called',
  'service_started',
  'completed',
  'cancelled',
  'no_show',
  'queue_opened',
  'queue_paused',
  'queue_closed',
  'closing_resolved',
  'presence_changed',
  'hairdressing_toggled',
  'appointment_confirmed',
  'appointment_rejected',
  'appointment_updated',
  'member_invited',
  'member_deactivated',
  'settings_updated',
] as const;

function isoDay(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** `/dashboard/audit` (S-17): who did what and when; never a client name (K10). */
export function AuditPage() {
  const salon = useOutletContext<SetupSalon>();
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  useEffect(() => {
    document.title = `${t('audit.title')} – ${tCommon('brand.pro_name')}`;
  }, [t, tCommon]);
  const [filters, setFilters] = useState({
    from: isoDay(-7),
    to: isoDay(0),
    type: '',
    memberId: '',
  });
  const [more, setMore] = useState<AuditEvent[]>([]);
  const [cursor, setCursor] = useState<Record<string, unknown> | null>(null);
  const board = useQuery({
    queryKey: queryKeys.board,
    queryFn: () => loadBoard(salon.id),
  });
  const bounds: AuditFilters = {
    ...filters,
    from: new Date(`${filters.from}T00:00:00`).toISOString(),
    to: new Date(`${filters.to}T23:59:59`).toISOString(),
  };
  const log = useQuery({
    queryKey: ['audit', salon.id, filters],
    queryFn: () => loadAuditLog(salon.id, bounds, null),
  });
  const members = boardColumns(board.data?.stylists ?? []);

  function change(next: Partial<typeof filters>) {
    setMore([]);
    setCursor(null);
    setFilters({ ...filters, ...next });
  }

  async function loadMore() {
    const page = await loadAuditLog(
      salon.id,
      bounds,
      cursor ?? log.data?.next_cursor ?? null,
    );
    setMore([...more, ...page.events]);
    setCursor(page.next_cursor);
  }

  const events = [...(log.data?.events ?? []), ...more];
  const hasMore = more.length === 0 ? log.data?.next_cursor : cursor;
  const when = (iso: string) => {
    const date = new Date(iso);
    return `${date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })} ${tCommon('formats.time', timeParts(iso))}`;
  };

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-4 px-5 py-8">
      <h1 className="text-h1">{t('audit.title')}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TextField
          label={t('audit.filters.from')}
          onChange={(e) => change({ from: e.target.value })}
          type="date"
          value={filters.from}
        />
        <TextField
          label={t('audit.filters.to')}
          onChange={(e) => change({ to: e.target.value })}
          type="date"
          value={filters.to}
        />
        <label className="grid gap-2">
          <span className="font-semibold text-body-sm">
            {t('audit.filters.stylist')}
          </span>
          <select
            className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
            onChange={(e) => change({ memberId: e.target.value })}
            value={filters.memberId}
          >
            <option value="">{t('audit.filters.all_stylists')}</option>
            {members.map((m) => (
              <option key={m.member_id} value={m.member_id}>
                {m.first_name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="font-semibold text-body-sm">
            {t('audit.filters.type')}
          </span>
          <select
            className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
            onChange={(e) => change({ type: e.target.value })}
            value={filters.type}
          >
            <option value="">{t('audit.filters.all_types')}</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`audit.event_type.${type}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {log.isError ? (
        <Banner role="alert" tone="danger">
          {tErrors('generic.unexpected')}
        </Banner>
      ) : !log.data ? (
        <Skeleton className="h-24 w-full" />
      ) : events.length === 0 ? (
        <Banner>{t('audit.empty')}</Banner>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-body-sm">
            <thead>
              <tr>
                <th className="p-2">{t('audit.columns.date')}</th>
                <th className="p-2">{t('audit.columns.actor')}</th>
                <th className="p-2">{t('audit.columns.action')}</th>
                <th className="p-2">{t('audit.columns.reason')}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  className="border-t border-border"
                  key={`${event.source}-${event.id}`}
                >
                  <td className="p-2">{when(event.created_at)}</td>
                  <td className="p-2">
                    {event.actor_first_name ??
                      t(`audit.actor_type.${event.actor_type}`)}
                  </td>
                  <td className="p-2">
                    {t(`audit.event_type.${event.type}` as 'audit.empty', {
                      defaultValue: event.type,
                    })}
                    {event.ticket_code ? ` · ${event.ticket_code}` : ''}
                  </td>
                  <td className="p-2">
                    {event.reason_code
                      ? t(
                          `audit.reason.${event.reason_code}` as 'audit.empty',
                          {
                            defaultValue: event.reason_code,
                          },
                        )
                      : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore ? (
        <div>
          <Button onClick={() => void loadMore()} variant="secondary">
            {t('audit.load_more')}
          </Button>
        </div>
      ) : null}
    </main>
  );
}
