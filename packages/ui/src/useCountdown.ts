import { useCallback, useEffect, useState } from 'react';

/** Whole seconds left before "resend" unlocks (30 s, U-03 scenario 10). */
export function useCountdown(seconds: number) {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);

  const start = useCallback(() => {
    const current = Date.now();
    setNow(current);
    setDeadline(current + seconds * 1000);
  }, [seconds]);

  const remaining =
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / 1000));

  return { remaining, isRunning: remaining > 0, start };
}
