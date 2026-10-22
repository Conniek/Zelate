import { useTranslation } from 'react-i18next';
import { Link, Navigate, useLocation } from 'react-router';
import { Banner, Skeleton } from '@zelate/ui';
import { TicketScreen } from '../components/TicketScreen';
import { useMyTicket, usePageTitle, useSession } from '../lib/live';

/** `/ticket` (F-C5): my place of today, live. */
export function TicketPage() {
  const { t } = useTranslation('client');
  usePageTitle(t('ticket.page_title'));
  const location = useLocation();
  const session = useSession();
  const signedIn = session.data === true;
  const { query, live } = useMyTicket(signedIn);
  // F-C3 guard: sent here because a place already exists.
  const already = (location.state as { already?: boolean } | null)?.already;

  if (session.data === false) {
    return <Navigate replace to="/signin?next=%2Fticket" />;
  }
  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      <h1 className="font-display text-h2 font-bold">
        {t('ticket.page_title')}
      </h1>
      {already ? (
        <Banner tone="info">{t('join.guard.already_has_ticket')}</Banner>
      ) : null}
      {query.data === undefined && !query.isError ? (
        <div aria-busy="true" className="grid gap-3">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : query.data ? (
        <TicketScreen live={live} stale={query.isError} view={query.data} />
      ) : query.isError ? (
        <Banner role="alert" tone="danger">
          {t('ticket.offline', { time: '' })}
        </Banner>
      ) : (
        <section className="grid gap-3">
          <h2 className="text-h3">{t('ticket.none.title')}</h2>
          <p className="text-text-muted">{t('ticket.none.body')}</p>
          <Link className="font-semibold text-link underline" to="/">
            {t('ticket.none.find')}
          </Link>
        </section>
      )}
    </main>
  );
}
