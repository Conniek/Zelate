import { useTranslation } from 'react-i18next';
import { Button } from '@zelate/ui';

export function HomePage() {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-8 px-5 py-10">
      <header className="grid gap-3">
        <p className="font-display text-h1 font-bold">
          {tCommon('brand.pro_name')}
        </p>
        <h1 className="text-body-lg font-semibold text-text">
          {t('queue.title')}
        </h1>
      </header>
      <section className="grid gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <p className="text-body text-text-muted">{t('queue.empty')}</p>
        <Button disabled fullWidth size="lg" variant="secondary">
          {t('queue.call')}
        </Button>
      </section>
    </main>
  );
}
