import { useTranslation } from 'react-i18next';

export function AdminHomePage() {
  const { t } = useTranslation('pro-manager');
  return (
    <main className="mx-auto w-full max-w-xl px-5 py-10">
      <h1 className="font-display text-h2 font-bold">
        {t('admin.salons.title')}
      </h1>
    </main>
  );
}
