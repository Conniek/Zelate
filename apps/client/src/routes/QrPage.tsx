import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Skeleton } from '@zelate/ui';
import { loadSalon, resolveQr } from '../lib/client-api';
import { usePageTitle } from '../lib/live';

/** `/q/:qrToken` (F-C4, U-05): the poster in the salon, no install, no account yet. */
export function QrPage() {
  const { t } = useTranslation('client');
  usePageTitle(t('qr.page_title'));
  const { qrToken = '' } = useParams();
  const salon = useQuery({
    queryKey: ['qr', qrToken],
    queryFn: async () => {
      const slug = await resolveQr(qrToken);
      return slug ? loadSalon(slug) : null;
    },
  });

  if (salon.isPending) {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-xl px-5 py-8">
        <Skeleton className="h-32 w-full" />
      </main>
    );
  }
  if (!salon.data) {
    return (
      <main className="mx-auto grid w-full max-w-xl gap-3 px-5 py-8">
        <h1 className="font-display text-h2 font-bold">{t('qr.invalid')}</h1>
      </main>
    );
  }
  const { slug, name } = salon.data.salon;
  return (
    <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
      <h1 className="font-display text-h1 font-bold">
        {t('qr.header', { salon_name: name })}
      </h1>
      <Link
        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-text-on-primary"
        to={`/salons/${slug}/join?via=qr`}
      >
        {t('qr.choice.join_queue')}
      </Link>
      {/* F-C12: the token rides in the navigation state, never in the URL. */}
      <Link
        className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border-strong px-5 font-semibold"
        state={{ qrToken }}
        to={`/salons/${slug}/check-in`}
      >
        {t('qr.choice.have_appointment')}
      </Link>
    </main>
  );
}
