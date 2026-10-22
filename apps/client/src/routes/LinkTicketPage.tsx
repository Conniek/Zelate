import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Banner, Skeleton } from '@zelate/ui';
import { TicketScreen } from '../components/TicketScreen';
import { LinkExpired } from '../lib/client-api';
import { useLinkTicket, usePageTitle } from '../lib/live';

/** `/t/:shortCode` (F-C10): the ticket of an SMS link, without a session. */
export function LinkTicketPage() {
  const { t } = useTranslation('client');
  usePageTitle(t('ticket.page_title'));
  const { shortCode = '' } = useParams();
  const { query, live } = useLinkTicket(shortCode);

  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      <h1 className="font-display text-h2 font-bold">
        {t('ticket.page_title')}
      </h1>
      {query.error instanceof LinkExpired ? (
        <section className="grid gap-3">
          <h2 className="text-h3">{t('tracking.expired')}</h2>
          <p className="text-text-muted">{t('tracking.expired_hint')}</p>
          <Link className="font-semibold text-link underline" to="/">
            {t('ticket.end.rejoin')}
          </Link>
        </section>
      ) : query.data ? (
        <>
          <TicketScreen
            live={live}
            stale={query.isError}
            trackingToken={query.data.tracking_token}
            view={query.data}
          />
          <Link
            className="text-body-sm text-link underline"
            to="/signin?next=%2Fticket"
          >
            {t('tracking.create_account')}
          </Link>
        </>
      ) : query.isError ? (
        <Banner role="alert" tone="danger">
          {t('ticket.offline', { time: '' })}
        </Banner>
      ) : (
        <div aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      )}
    </main>
  );
}
