import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NavLink,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router';
import { Button, ConnectionBanner, Skeleton } from '@zelate/ui';
import { AccessLost } from '../../lib/queue-api';
import type { StylistContext } from '../../lib/queue-api';
import {
  signOutHere,
  useOnline,
  useSalonRealtime,
  useStylistContext,
} from '../../lib/stylist';
import type { SignInReason } from '../../lib/stylist';
import { supabase } from '../../lib/supabase';

export interface StylistOutlet {
  ctx: StylistContext & { member_id: string; salon_id: string };
  /** Connection lost: every action is blocked (F-S4). */
  lost: boolean;
}

function signInPath(reason: SignInReason | null): string {
  const query = new URLSearchParams({ next: '/stylist/queue' });
  if (reason) query.set('reason', reason);
  return `/signin?${query.toString()}`;
}

/** `/stylist/*`: active members only (F-S2, ADR-019); nothing kept on the device (ADR-007). */
export function StylistLayout() {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const session = useQuery({
    queryKey: ['session'],
    queryFn: async () =>
      (await supabase.auth.getSession()).data.session !== null,
    staleTime: Infinity,
  });
  const context = useStylistContext();
  const wasActive = useRef(false);
  // Set when this screen signs out itself, so the auth listener stays quiet.
  const leaving = useRef(false);
  const online = useOnline();
  const ctx = context.data;
  const realtime = useSalonRealtime(
    ctx?.access === 'active' ? ctx.salon_id : undefined,
  );

  // Session ended elsewhere (revoked, refresh refused): back to sign-in.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || leaving.current) return;
      queryClient.clear();
      void navigate(signInPath(wasActive.current ? 'sessions_revoked' : null), {
        replace: true,
      });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate, queryClient]);

  // Access lost while signed in: the reads are refused (ADR-019).
  const reason: SignInReason | null | undefined =
    context.error instanceof AccessLost || ctx?.access === 'none'
      ? wasActive.current
        ? 'sessions_revoked'
        : null
      : ctx?.access === 'deactivated'
        ? 'access_revoked'
        : undefined;
  useEffect(() => {
    if (ctx?.access === 'active') wasActive.current = true;
  }, [ctx?.access]);
  useEffect(() => {
    if (reason === undefined) return;
    leaving.current = true;
    void signOutHere(queryClient).then(() =>
      navigate(signInPath(reason), { replace: true }),
    );
  }, [navigate, queryClient, reason]);

  if (session.data === false) {
    return <Navigate replace to={signInPath(null)} />;
  }
  if (!ctx || ctx.access !== 'active' || !ctx.member_id || !ctx.salon_id) {
    return (
      <main className="mx-auto w-full max-w-xl px-5 py-10" aria-busy="true">
        <Skeleton className="h-10 w-full" />
      </main>
    );
  }

  const lost = !online || (!realtime && context.isError);
  const links = [
    { to: '/stylist/queue', label: t('menu.queue') },
    { to: '/stylist/appointments', label: t('menu.appointments') },
    { to: '/stylist/summary', label: t('menu.summary') },
  ];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col">
      <header className="grid gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-display text-body-lg font-bold">
            {ctx.salon_name}
          </p>
          <Button
            onClick={() => {
              leaving.current = true;
              void signOutHere(queryClient).then(() =>
                navigate(signInPath(null), { replace: true }),
              );
            }}
            size="sm"
            variant="ghost"
          >
            {tCommon('actions.sign_out')}
          </Button>
        </div>
        <nav aria-label={t('menu.label')}>
          <ul className="flex gap-2">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  aria-current={
                    location.pathname === link.to ? 'page' : undefined
                  }
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-body-sm font-semibold text-link aria-[current=page]:bg-primary-subtle"
                  to={link.to}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <ConnectionBanner lost={lost} lostLabel={t('connection.lost')} />
      </header>
      <Outlet
        context={
          {
            ctx: ctx as StylistOutlet['ctx'],
            lost,
          } satisfies StylistOutlet
        }
      />
    </div>
  );
}
