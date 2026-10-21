import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Skeleton } from '@zelate/ui';
import { DashboardNav } from './DashboardNav';
import { loadStylistContext } from '../lib/queue-api';
import { loadOwnSalon } from '../lib/setup-api';
import type { SetupSalon } from '../lib/setup-api';
import { supabase } from '../lib/supabase';

async function loadAccess(): Promise<
  'signin' | 'signup' | 'stylist' | SetupSalon
> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return 'signin';
  // A stylist can read his salon, but the dashboard is the manager's (K9):
  // he goes to his own space instead of looping on a refused board.
  const ctx = await loadStylistContext().catch(() => null);
  if (ctx?.access === 'active' && ctx.role !== 'manager') return 'stylist';
  return (await loadOwnSalon()) ?? 'signup';
}

/** `/dashboard` guard: signed-in managers with a salon only. The database enforces the same rule. */
export function DashboardGuard() {
  const location = useLocation();
  const { data, isError, isPending } = useQuery({
    queryKey: ['own-salon'],
    queryFn: loadAccess,
  });
  if (isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <Skeleton className="h-10 w-full" />
      </main>
    );
  }
  if (isError || data === 'signin') {
    return (
      <Navigate
        replace
        to={`/signin?next=${encodeURIComponent(location.pathname)}`}
      />
    );
  }
  if (data === 'signup') return <Navigate replace to="/signup" />;
  if (data === 'stylist') return <Navigate replace to="/stylist/queue" />;
  return (
    <>
      <DashboardNav />
      <Outlet context={data} />
    </>
  );
}
