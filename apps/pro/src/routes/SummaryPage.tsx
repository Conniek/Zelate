import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { Banner, Skeleton } from '@zelate/ui';
import { loadDaySummary } from '../lib/board-api';
import type { SetupSalon } from '../lib/setup-api';
import { todayInParis } from '../lib/stylist';

/** `/dashboard/summary` (S-14): the figures of the day. */
export function SummaryPage() {
  const salon = useOutletContext<SetupSalon>();
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  useEffect(() => {
    document.title = `${t('summary.title')} – ${tCommon('brand.pro_name')}`;
  }, [t, tCommon]);
  const summary = useQuery({
    queryKey: ['day-summary', salon.id],
    queryFn: () => loadDaySummary(salon.id, todayInParis()),
    refetchInterval: 60_000,
  });
  const data = summary.data;

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-5 py-8">
      <h1 className="text-h1">{t('summary.title')}</h1>
      {!data ? (
        summary.isError ? (
          <Banner role="alert" tone="danger">
            {tErrors('generic.unexpected')}
          </Banner>
        ) : (
          <Skeleton className="h-24 w-full" />
        )
      ) : data.served_count === 0 ? (
        <Banner>{t('summary.empty')}</Banner>
      ) : (
        <ul className="grid gap-2 rounded-lg border border-border p-4">
          <li>{t('summary.served', { count: data.served_count })}</li>
          {data.announced_wait_minutes !== null ? (
            <li>
              {t('summary.announced_wait', {
                minutes: data.announced_wait_minutes,
              })}
            </li>
          ) : null}
          {data.actual_wait_minutes !== null ? (
            <li>
              {t('summary.actual_wait', { minutes: data.actual_wait_minutes })}
            </li>
          ) : null}
          <li>{t('summary.no_shows', { count: data.no_show_count })}</li>
          <li>{t('summary.cancellations', { count: data.cancelled_count })}</li>
        </ul>
      )}
    </main>
  );
}
