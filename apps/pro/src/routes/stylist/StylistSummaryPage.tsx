import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';
import { Skeleton } from '@zelate/ui';
import { loadDaySummary } from '../../lib/queue-api';
import { todayInParis } from '../../lib/stylist';
import type { StylistOutlet } from './StylistLayout';

/** F-S9 · `/stylist/summary`: my figures of the day (C-10). */
export function StylistSummaryPage() {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const { ctx } = useOutletContext<StylistOutlet>();
  const date = ctx.service_date ?? todayInParis();
  const summary = useQuery({
    queryKey: ['stylist-summary', ctx.salon_id, date],
    queryFn: () => loadDaySummary(ctx.salon_id, date),
  });

  return (
    <main className="grid gap-4 p-4">
      <h1 className="text-h2">{t('summary.title')}</h1>
      {!summary.data ? (
        <Skeleton className="h-32 w-full" />
      ) : summary.data.served_count === 0 ? (
        <p className="text-text-muted">{t('summary.empty')}</p>
      ) : (
        <dl className="grid gap-3">
          <div className="rounded-lg border border-border p-4">
            <dt className="text-body-sm text-text-muted">
              {t('summary.clients_served')}
            </dt>
            <dd className="text-h2 tabular-nums">
              {tCommon('units.clients', { count: summary.data.served_count })}
            </dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dt className="text-body-sm text-text-muted">
              {t('summary.planned_vs_actual')}
            </dt>
            <dd className="text-body tabular-nums">
              {t('summary.wait_values', {
                announced: summary.data.announced_wait_minutes ?? 0,
                actual: summary.data.actual_wait_minutes ?? 0,
              })}
            </dd>
          </div>
          <div className="rounded-lg border border-border p-4">
            <dd className="text-body">
              {t('summary.no_show', { count: summary.data.no_show_count })}
            </dd>
          </div>
        </dl>
      )}
      <Link className="text-link underline" to="/stylist/queue">
        {t('summary.back_to_queue')}
      </Link>
    </main>
  );
}
