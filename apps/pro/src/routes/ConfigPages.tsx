import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { SetupClosures } from './SetupClosures';
import { SetupHours } from './SetupHours';
import { SetupServices } from './SetupServices';
import { SetupTeam } from './SetupTeam';
import type { SetupSalon } from '../lib/setup-api';

/** One config page: its own title and `h1`, the forms below as `h2` (WCAG 2.4.2). */
function Page({
  children,
  title,
}: {
  children: ReactNode;
  title: 'nav.team' | 'nav.services' | 'nav.hours';
}) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  useEffect(() => {
    document.title = `${t(title)} – ${tCommon('brand.pro_name')}`;
  }, [t, tCommon, title]);
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-5 py-8">
      <h1 className="text-h1">{t(title)}</h1>
      {children}
    </main>
  );
}

/** F-M11: the wizard forms, reused after the setup (`/dashboard/team`). */
export function TeamPage() {
  const salon = useOutletContext<SetupSalon>();
  return (
    <Page title="nav.team">
      <SetupTeam salonId={salon.id} />
    </Page>
  );
}

export function ServicesPage() {
  const salon = useOutletContext<SetupSalon>();
  return (
    <Page title="nav.services">
      <SetupServices salonId={salon.id} />
    </Page>
  );
}

export function HoursPage() {
  const salon = useOutletContext<SetupSalon>();
  return (
    <Page title="nav.hours">
      <SetupHours salonId={salon.id} />
      <SetupClosures salonId={salon.id} />
    </Page>
  );
}
