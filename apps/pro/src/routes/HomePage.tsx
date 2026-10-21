import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router';
import { Skeleton } from '@zelate/ui';
import { loadStylistContext } from '../lib/queue-api';
import { supabase } from '../lib/supabase';

/** Where `/` leads: the dashboard for a manager, the queue for a stylist. */
async function landing(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return '/signin';
  const ctx = await loadStylistContext().catch(() => null);
  if (ctx?.access === 'active') {
    return ctx.role === 'manager' ? '/dashboard/setup' : '/stylist/queue';
  }
  if (ctx?.access === 'deactivated') return '/signin?reason=access_revoked';
  // Signed in without a salon: a manager finishing his sign-up.
  return '/dashboard/setup';
}

export function HomePage() {
  const { data } = useQuery({
    queryKey: ['landing'],
    queryFn: landing,
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
