import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router';
import { Button } from '@zelate/ui';
import { signOutHere } from '../lib/stylist';

const LINKS = [
  { to: '/dashboard', key: 'nav.board', end: true },
  { to: '/dashboard/appointments', key: 'board.appointments', end: false },
  { to: '/dashboard/summary', key: 'summary.title', end: false },
  { to: '/dashboard/audit', key: 'audit.title', end: false },
  { to: '/dashboard/team', key: 'nav.team', end: false },
  { to: '/dashboard/services', key: 'nav.services', end: false },
  { to: '/dashboard/hours', key: 'nav.hours', end: false },
  { to: '/dashboard/setup', key: 'board.setup_link', end: false },
] as const;

/** The manager's navigation, on every `/dashboard` page, with sign-out. */
export function DashboardNav() {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <nav
      aria-label={t('board.menu_label')}
      className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-5 pt-4"
    >
      {LINKS.map((link) => (
        <NavLink
          className={({ isActive }) =>
            `inline-flex min-h-11 items-center text-body-sm font-semibold ${
              isActive ? 'text-text underline' : 'text-link'
            }`
          }
          end={link.end}
          key={link.to}
          to={link.to}
        >
          {t(link.key)}
        </NavLink>
      ))}
      <Button
        className="ml-auto"
        onClick={() =>
          void signOutHere(queryClient).then(() =>
            navigate('/signin', { replace: true }),
          )
        }
        size="sm"
        variant="ghost"
      >
        {tCommon('actions.sign_out')}
      </Button>
    </nav>
  );
}
