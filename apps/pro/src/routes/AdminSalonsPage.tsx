import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Banner, Skeleton } from '@zelate/ui';
import { listSalons } from '../lib/admin-api';
import type { SiretResult } from '../lib/admin-api';

export function siretBadge(result: SiretResult): '✓' | '⚠' | '✗' {
  if (result === 'valid') return '✓';
  return result === 'inactive' || result === 'not_found' ? '✗' : '⚠';
}

export function AdminSalonsPage() {
  const { t } = useTranslation('pro-manager');
  const [filter, setFilter] = useState<'to_review' | 'all'>('to_review');
  const { data, isError, isPending } = useQuery({
    queryKey: ['admin-salons', filter],
    queryFn: () => listSalons(filter),
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10">
      <h1 className="font-display text-h2 font-bold">
        {t('admin.salons.title')}
      </h1>
      <div className="my-4 flex gap-2" role="group">
        {(['to_review', 'all'] as const).map((value) => (
          <button
            aria-pressed={filter === value}
            className={`min-h-11 rounded-lg border px-4 text-body-sm font-semibold ${
              filter === value
                ? 'border-ink-900 bg-surface-muted'
                : 'border-border-strong'
            }`}
            key={value}
            onClick={() => setFilter(value)}
            type="button"
          >
            {t(`admin.salons.filters.${value}`)}
          </button>
        ))}
      </div>
      {isPending ? <Skeleton className="h-32 w-full" /> : null}
      {isError ? (
        <Banner role="alert" tone="danger">
          {t('admin.salons.load_error')}
        </Banner>
      ) : null}
      {data && data.length === 0 ? <p>{t('admin.salons.empty')}</p> : null}
      {data && data.length > 0 ? (
        <table className="w-full text-left text-body">
          <thead>
            <tr className="text-body-sm text-text-muted">
              <th className="py-2">{t('admin.salons.columns.name')}</th>
              <th>{t('admin.salons.columns.city')}</th>
              <th>{t('admin.salons.columns.submitted_at')}</th>
              <th>{t('admin.salons.columns.siret')}</th>
              <th>{t('admin.salons.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr className="border-t border-border-strong" key={row.salon_id}>
                <td className="py-3">
                  <Link
                    className="font-semibold underline"
                    to={`/admin/salons/${row.salon_id}`}
                  >
                    {row.name}
                  </Link>
                </td>
                <td>{row.city}</td>
                <td>
                  {new Date(row.submitted_at).toLocaleDateString('fr-FR')}
                </td>
                <td>
                  <span aria-hidden="true">
                    {siretBadge(row.siret_check_result)}{' '}
                  </span>
                  {t(
                    row.siret_check_result === 'valid'
                      ? 'admin.salons.siret.valid'
                      : row.siret_check_result === 'inactive' ||
                          row.siret_check_result === 'not_found'
                        ? 'admin.salons.siret.invalid'
                        : 'admin.salons.siret.to_check',
                  )}
                </td>
                <td>{t(`admin.salons.decision.${row.decision}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
