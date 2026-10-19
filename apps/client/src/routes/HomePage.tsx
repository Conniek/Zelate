import { useTranslation } from 'react-i18next';
import { Button } from '@zelate/ui';

export function HomePage() {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-5 py-10">
      <header className="grid gap-3">
        <p className="font-display text-h1 font-bold">
          {tCommon('brand.client_name')}
        </p>
        <h1 className="text-body-lg font-semibold text-text">
          {t('home.empty.message')}
        </h1>
      </header>
      <section className="grid gap-3">
        <p className="text-body text-text-muted">
          {t('home.geolocation.explanation')}
        </p>
        <Button disabled fullWidth size="lg">
          {t('home.geolocation.allow')}
        </Button>
        <Button disabled fullWidth size="lg" variant="secondary">
          {t('home.geolocation.use_address')}
        </Button>
      </section>
    </main>
  );
}
