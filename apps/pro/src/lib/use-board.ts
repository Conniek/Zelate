/**
 * The manager's live board (F-M6): one read of `get_salon_board`, kept fresh
 * by the salon channel and a fallback poll. A refused read signs out here and
 * forgets the clients shown (ADR-007).
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { loadBoard } from './board-api';
import { AccessLost } from './queue-api';
import {
  LIVE_POLL_MS,
  POLL_MS,
  queryKeys,
  signOutHere,
  useOnline,
  useSalonRealtime,
} from './stylist';

export function useBoard(salonId: string) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [live, setLive] = useState(false);
  const realtime = useSalonRealtime(salonId);
  useEffect(() => setLive(realtime), [realtime]);
  const online = useOnline();
  const board = useQuery({
    queryKey: queryKeys.board,
    queryFn: () => loadBoard(salonId),
    refetchInterval: live ? LIVE_POLL_MS : POLL_MS,
    refetchOnWindowFocus: true,
    retry: (count, error) => !(error instanceof AccessLost) && count < 2,
  });
  const accessLost = board.error instanceof AccessLost;
  useEffect(() => {
    if (!accessLost) return;
    void signOutHere(queryClient).then(() =>
      navigate('/signin?reason=sessions_revoked', { replace: true }),
    );
  }, [accessLost, navigate, queryClient]);

  return {
    board,
    live,
    lost: !online || (!live && board.isError),
    accessLost,
  };
}

/** Re-renders every `stepMs` for clocks on screen. */
export function useNow(stepMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(timer);
  }, [stepMs]);
  return now;
}
