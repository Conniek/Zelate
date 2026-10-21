import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import { SetupClosures } from './SetupClosures';
import { SetupHours } from './SetupHours';
import { SetupServices } from './SetupServices';
import { SetupTeam } from './SetupTeam';
import type { SetupSalon } from '../lib/setup-api';

function Page({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-5 py-8">
      {children}
    </main>
  );
}

/** F-M11: the wizard forms, reused after the setup (`/dashboard/team`). */
export function TeamPage() {
  const salon = useOutletContext<SetupSalon>();
  return (
    <Page>
      <SetupTeam salonId={salon.id} />
    </Page>
  );
}

export function ServicesPage() {
  const salon = useOutletContext<SetupSalon>();
  return (
    <Page>
      <SetupServices salonId={salon.id} />
    </Page>
  );
}

export function HoursPage() {
  const salon = useOutletContext<SetupSalon>();
  useTranslation('pro-manager');
  return (
    <Page>
      <SetupHours salonId={salon.id} />
      <SetupClosures salonId={salon.id} />
    </Page>
  );
}
