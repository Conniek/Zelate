/**
 * Stylist space session (F-S2, ADR-007, ADR-009, ADR-019): who is signed in,
 * what to read again, and whether the connection is up. Everything stays in
 * memory; signing out clears the query cache.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parisDate, parisTime } from '@zelate/queue-service/time';
import { AccessLost, loadStylistContext, loadStylistQueue } from './queue-api';
import { supabase } from './supabase';

/** Fallback reading while realtime is down (TRD §6.4). */
export const POLL_MS = 10_000;
/** Safety net while realtime is up: light on a low-end phone. */
export const LIVE_POLL_MS = 60_000;

export const queryKeys = {
  context: ['stylist-context'] as const,
  queue: ['stylist-queue'] as const,
};

export type SignInReason = 'sessions_revoked' | 'access_revoked';

/**
 * « This device was used by a staff member »: a plain flag, no client data
 * (ADR-007). It lets a reopened app explain a cut session (F-S2).
 */
const STAFF_FLAG = 'zelate-pro-staff';

export function rememberStaff(on: boolean): void {
  try {
    if (on) localStorage.setItem(STAFF_FLAG, '1');
    else localStorage.removeItem(STAFF_FLAG);
  } catch {
    // Private browsing: the message is simply less precise.
  }
}

export function wasStaff(): boolean {
  try {
    return localStorage.getItem(STAFF_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Ends the session on this device and forgets every client shown (ADR-007). */
export async function signOutHere(queryClient: QueryClient): Promise<void> {
  queryClient.clear();
  await supabase.auth.signOut({ scope: 'local' });
}

export function useStylistContext(live: boolean) {
  return useQuery({
    queryKey: queryKeys.context,
    queryFn: loadStylistContext,
    refetchInterval: live ? LIVE_POLL_MS : POLL_MS,
    retry: (count, error) => !(error instanceof AccessLost) && count < 2,
  });
}

export function useStylistQueue(live: boolean) {
  return useQuery({
    queryKey: queryKeys.queue,
    queryFn: loadStylistQueue,
    refetchInterval: live ? LIVE_POLL_MS : POLL_MS,
    refetchOnWindowFocus: true,
    retry: (count, error) => !(error instanceof AccessLost) && count < 2,
  });
}

/**
 * `salon:{id}` carries only `{ version }`: any message means « read again ».
 * Returns false while the channel is not subscribed.
 */
export function useSalonRealtime(salonId: string | undefined): boolean {
  const queryClient = useQueryClient();
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!salonId) return undefined;
    let cancelled = false;
    const channel = supabase.channel(`salon:${salonId}`, {
      config: { private: true },
    });
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel
        .on('broadcast', { event: '*' }, () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.queue });
          void queryClient.invalidateQueries({ queryKey: queryKeys.context });
        })
        .subscribe((status) => setSubscribed(status === 'SUBSCRIBED'));
    });
    return () => {
      cancelled = true;
      setSubscribed(false);
      void supabase.removeChannel(channel);
    };
  }, [queryClient, salonId]);
  return subscribed;
}

/** Browser connectivity; actions are blocked while it is off (F-S4). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

/** `{hours}h{minutes}` parts of an instant in Paris, for `common:formats.time`. */
export function timeParts(iso: string): { hours: string; minutes: string } {
  const [hours, minutes] = parisTime(Date.parse(iso)).split(':');
  return { hours: hours!, minutes: minutes! };
}

export function todayInParis(): string {
  return parisDate(Date.now());
}

export function minutesBetween(fromIso: string, to: number): number {
  return Math.max(0, Math.floor((to - Date.parse(fromIso)) / 60_000));
}

/** One title per screen (WCAG 2.4.2): « Ma file – Zelaté Pro ». */
export function usePageTitle(page: string): void {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  useEffect(() => {
    document.title = t('page_title', { page, app: tCommon('brand.pro_name') });
  }, [page, t, tCommon]);
}
