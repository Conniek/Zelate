import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface HoldButtonProps {
  children: ReactNode;
  disabled?: boolean | undefined;
  /** Hold duration in ms (600 for « Terminer », DESIGN_SYSTEM §7.1). */
  holdMs?: number;
  /** Visible hint, also the accessible description (« Maintenez pour terminer »). */
  hint: string;
  /** Called once the button was held long enough. */
  onHold: () => void;
  /** Keyboard (Enter or Space): the screen asks for a confirmation instead. */
  onRequestConfirm: () => void;
}

/** Long press with a progressive fill; keyboard users confirm in a dialog. */
export function HoldButton({
  children,
  disabled,
  holdMs = 600,
  hint,
  onHold,
  onRequestConfirm,
}: HoldButtonProps) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintId = useId();

  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }

  useEffect(() => stop, []);

  function start() {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      setHolding(false);
      onHold();
    }, holdMs);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!disabled) onRequestConfirm();
    }
  }

  return (
    <div className="grid gap-1">
      <button
        aria-describedby={hintId}
        className={[
          'relative min-h-14 w-full overflow-hidden rounded-lg bg-primary px-6 text-body-lg font-semibold text-text-on-primary select-none touch-none',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
        ].join(' ')}
        disabled={disabled}
        onContextMenu={(event) => event.preventDefault()}
        onKeyDown={handleKeyDown}
        onPointerCancel={stop}
        onPointerDown={start}
        onPointerLeave={stop}
        onPointerUp={stop}
        type="button"
      >
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-primary-active motion-reduce:transition-none"
          data-testid="hold-fill"
          style={{
            transitionDuration: `${holding ? holdMs : 0}ms`,
            transitionProperty: 'width',
            transitionTimingFunction: 'linear',
            width: holding ? '100%' : '0%',
          }}
        />
        <span className="relative">{children}</span>
      </button>
      <p className="text-center text-body-sm text-text-muted" id={hintId}>
        {hint}
      </p>
    </div>
  );
}
