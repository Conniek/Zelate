import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { Skeleton } from '@zelate/ui';
import { loadStylistContext } from '../lib/queue-api';
import { rememberStaff, signOutHere, wasStaff } from '../lib/stylist';
import { supabase } from '../lib/supabase';

/** Where `/` leads: the dashboard for a manager, the queue for a stylist. */
async function landing(queryClient: QueryClient): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    // A session cut while the app was closed (F-S2).
    return wasStaff() ? '/signin?reason=sessions_revoked' : '/signin';
  }
  const ctx = await loadStylistContext().catch(() => null);
  if (ctx?.access === 'active') {
    return ctx.role === 'manager' ? '/dashboard/setup' : '/stylist/queue';
  }
  if (ctx?.access === 'deactivated' || (ctx?.access === 'none' && wasStaff())) {
    const reason =
      ctx?.access === 'deactivated' ? 'access_revoked' : 'sessions_revoked';
    rememberStaff(false);
    await signOutHere(queryClient);
    return `/signin?reason=${reason}`;
  }
  // Signed in without a salon: a manager finishing his sign-up.
  return '/dashboard/setup';
}

export function HomePage() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['landing'],
    queryFn: () => landing(queryClient),
    gcTime: 0,
  });
  if (!data) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10" aria-busy="true">
        <Skeleton className="h-10 w-full" />
      </main>
    );
  }
  return <Navigate replace to={data} />;
}
