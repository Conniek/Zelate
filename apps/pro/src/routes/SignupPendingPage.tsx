import { useTranslation } from 'react-i18next';

export function SignupPendingPage() {
  const { t } = useTranslation('pro-manager');
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center gap-4 px-5 py-10">
      <h1 className="font-display text-h2 font-bold">
        {t('signup.pending.title')}
      </h1>
      <p className="text-body-lg">{t('signup.pending.body')}</p>
      <p className="text-body text-text-muted">
        {t('signup.pending.setup_hint')}
      </p>
    </main>
  );
}
