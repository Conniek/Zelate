import { useEffect, useState } from 'react';

export interface CountdownBadgeProps {
  /** Release time (epoch ms): 10 min after the call, or the announced arrival (E2). */
  deadline: number;
  /** Text read by screen readers at 5 min and at 1 min only (DESIGN_SYSTEM §7.3). */
  announce: (minutesLeft: number) => string;
  /** Visible label next to the time, e.g. « Place libérée dans ». */
  label: string;
  now?: () => number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** mm:ss until the release; `warning` from 5 min. */
export function CountdownBadge({
  deadline,
  announce,
  label,
  now = Date.now,
}: CountdownBadgeProps) {
  const [current, setCurrent] = useState(now);
  useEffect(() => {
    const timer = setInterval(() => setCurrent(now()), 1000);
    return () => clearInterval(timer);
  }, [now]);

  const left = Math.max(0, Math.ceil((deadline - current) / 1000));
  const minutes = Math.floor(left / 60);
  const warning = left <= 5 * 60;
  // Only two announcements, so that a screen reader is not flooded.
  const announced = left <= 60 ? 1 : left <= 5 * 60 ? 5 : null;

  return (
    <div
      className={[
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-body-sm font-semibold tabular-nums',
        warning
          ? 'bg-warning-subtle text-warning-text'
          : 'bg-surface-muted text-text',
      ].join(' ')}
    >
      <span>{label}</span>
      <time aria-hidden="true">{`${pad(minutes)}:${pad(left % 60)}`}</time>
      <span aria-live="polite" className="sr-only">
        {announced === null ? '' : announce(announced)}
      </span>
    </div>
  );
}
