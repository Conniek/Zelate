/**
 * Live reads of the client app (F-C5, F-C10, ADR-018): a realtime channel
 * when it is up, a read every 30 s and on return to the app otherwise.
 * Everything stays in memory (no ticket data in browser storage).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parisTime } from '@zelate/queue-service/time';
import {
  LinkExpired,
  loadLinkTicket,
  loadMyTicket,
  loadSalon,
  sendClientCommand,
  tokenKey,
} from './client-api';
import type { CommandOutcome } from './client-api';
import { supabase } from './supabase';

/** PRD §6: the client page reads again every 30 s without realtime. */
export const POLL_MS = 30_000;

export const keys = {
  myTicket: ['my-ticket'] as const,
  link: (code: string) => ['link-ticket', code] as const,
  salon: (slug: string) => ['salon', slug] as const,
  session: ['session'] as const,
};

export function timeParts(iso: string): { hours: string; minutes: string } {
  const [hours, minutes] = parisTime(Date.parse(iso)).split(':');
  return { hours: hours!, minutes: minutes! };
}

/** « 14h32 » from an ISO instant. */
export function useTime(): (iso: string) => string {
  const { t } = useTranslation('common');
  return useCallback((iso: string) => t('formats.time', timeParts(iso)), [t]);
}

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

/** Re-renders every `stepMs` for clocks and countdowns on screen. */
export function useNow(stepMs = 1_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(timer);
  }, [stepMs]);
  return now;
}

export function useSession() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void queryClient.invalidateQueries({ queryKey: keys.session });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);
  return useQuery({
    queryKey: keys.session,
    queryFn: async () =>
      (await supabase.auth.getSession()).data.session !== null,
    staleTime: 0,
  });
}

/**
 * Listens to one channel; a message with a newer `version` means « read
 * again », at most once per 300 ms. Every channel is private: the server
 * sends private broadcasts only, and RLS lets anon read the public topics
 * (`salon-public:*`, `ticket-token:*`), so nobody can broadcast on them.
 */
function useChannel(topic: string | null, onMessage: () => void): boolean {
  const [subscribed, setSubscribed] = useState(false);
  useEffect(() => {
    if (!topic) return undefined;
    let cancelled = false;
    let last = 0;
    let timer: number | undefined;
    const channel = supabase.channel(topic, { config: { private: true } });
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel
        .on('broadcast', { event: '*' }, ({ payload }) => {
          const version = Number((payload as { version?: unknown })?.version);
          if (Number.isFinite(version)) {
            if (version <= last) return;
            last = version;
          }
          window.clearTimeout(timer);
          timer = window.setTimeout(onMessage, 300);
        })
        .subscribe((status) => setSubscribed(status === 'SUBSCRIBED'));
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setSubscribed(false);
      void supabase.removeChannel(channel);
    };
  }, [onMessage, topic]);
  return subscribed;
}

/** F-C5: my ticket, on the private channel `ticket:{id}` and `salon-public:{id}`. */
export function useMyTicket(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: keys.myTicket,
    queryFn: loadMyTicket,
    enabled,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    // ADR-007 spirit for clients: nothing kept once the page is left.
    gcTime: 60_000,
  });
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.myTicket });
  }, [queryClient]);
  const view = query.data ?? null;
  const ticketLive = useChannel(
    view ? `ticket:${view.ticket.id}` : null,
    refresh,
  );
  // Times move with the whole queue: the public salon channel says when.
  useChannel(view ? `salon-public:${view.ticket.salon_id}` : null, refresh);
  return { query, live: ticketLive, refresh };
}

/** F-C10: the ticket of an SMS link, on `ticket-token:{key}`. */
export function useLinkTicket(code: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: keys.link(code),
    queryFn: () => loadLinkTicket(code),
    refetchInterval: (q) =>
      q.state.error instanceof LinkExpired ? false : POLL_MS,
    refetchOnWindowFocus: true,
    retry: (count, error) => !(error instanceof LinkExpired) && count < 2,
    gcTime: 60_000,
  });
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.link(code) });
  }, [code, queryClient]);
  const token = query.data?.tracking_token ?? null;
  const [topic, setTopic] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void tokenKey(token).then((key) => {
      if (!cancelled) setTopic(`ticket-token:${key}`);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);
  const live = useChannel(topic, refresh);
  useChannel(
    query.data ? `salon-public:${query.data.ticket.salon_id}` : null,
    refresh,
  );
  return { query, live, refresh };
}

/** F-C2: the salon page, kept fresh by `salon-public:{id}` (ADR-018). */
export function useSalon(slug: string) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: keys.salon(slug),
    queryFn: () => loadSalon(slug),
    refetchInterval: POLL_MS,
  });
  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.salon(slug) });
  }, [queryClient, slug]);
  useChannel(
    query.data ? `salon-public:${query.data.salon.id}` : null,
    refresh,
  );
  return query;
}

/** One client command at a time; reads the ticket again after it. */
export function useClientCommand(trackingToken?: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation('errors');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async (
      command: string,
      payload: Record<string, unknown>,
    ): Promise<CommandOutcome> => {
      setBusy(command);
      setError(null);
      const outcome = await sendClientCommand(command, payload, trackingToken);
      setBusy(null);
      if (!outcome.ok) {
        const key = outcome.messageKey.replace(/^errors\./, '');
        const text = t(key as 'generic.unexpected', { defaultValue: '' });
        setError(text === '' ? t('generic.unexpected') : text);
      }
      await queryClient.invalidateQueries({ queryKey: keys.myTicket });
      await queryClient.invalidateQueries({ queryKey: ['link-ticket'] });
      return outcome;
    },
    [queryClient, t, trackingToken],
  );
  return { run, busy, error, setError };
}

export function usePageTitle(title: string) {
  const { t } = useTranslation('common');
  useEffect(() => {
    document.title = `${title} – ${t('brand.client_name')}`;
  }, [t, title]);
}
