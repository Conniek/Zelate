import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router';
import {
  countActiveHairdressers,
  loadHours,
  loadServices,
} from '../lib/setup-api';
import type { SetupSalon } from '../lib/setup-api';
import { SetupClosures } from './SetupClosures';
import { SetupPublish } from './SetupPublish';
import { SetupQr } from './SetupQr';
import { SetupHours } from './SetupHours';
import { SetupServices } from './SetupServices';
import { SetupTeam } from './SetupTeam';

function Item({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden="true">{done ? '✓' : '○'}</span>
      <span>{label}</span>
      <span className="sr-only">{done ? '✓' : '○'}</span>
    </li>
  );
}

export function SetupPage() {
  const salon = useOutletContext<SetupSalon>();
  const { t } = useTranslation('pro-manager');
  const { data: hours } = useQuery({
    queryKey: ['hours', salon.id],
    queryFn: () => loadHours(salon.id),
  });
  const { data: services } = useQuery({
    queryKey: ['services', salon.id],
    queryFn: () => loadServices(salon.id),
  });
  const { data: hairdressers = 0 } = useQuery({
    queryKey: ['hairdressers', salon.id],
    queryFn: () => countActiveHairdressers(salon.id),
  });
  const approved = salon.status !== 'pending_review';
  const testPassed = salon.setup_test_passed_at !== null;
  const hasHours = Object.values(hours ?? {}).some((r) => r.length > 0);
  const hasService = services?.some((s) => s.is_active) ?? false;

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-8 px-5 py-10">
      <h1 className="text-h1">{t('setup.page_title')}</h1>
      <section aria-labelledby="checklist-title" className="grid gap-3">
        <h2 className="text-h2" id="checklist-title">
          {t('setup.checklist.title')}
        </h2>
        <ul className="grid gap-1">
          <Item
            done={approved}
            label={t('setup.checklist.application_approved')}
          />
          <Item done={hasHours} label={t('setup.checklist.opening_hours')} />
          <Item
            done={hairdressers > 0}
            label={t('setup.checklist.active_stylist')}
          />
          <Item done={hasService} label={t('setup.checklist.active_service')} />
          <Item done={testPassed} label={t('setup.checklist.test_passed')} />
        </ul>
        {!approved && (
          <p className="text-body-sm text-text-muted">
            {t('setup.checklist.pending_review_hint')}
          </p>
        )}
      </section>
      <SetupHours salonId={salon.id} />
      <SetupClosures salonId={salon.id} />
      <SetupServices salonId={salon.id} />
      <SetupTeam salonId={salon.id} />
      <SetupQr salonId={salon.id} />
      <SetupPublish
        ready={
          approved && hasHours && hasService && hairdressers > 0 && testPassed
        }
        salon={salon}
      />
    </main>
  );
}
