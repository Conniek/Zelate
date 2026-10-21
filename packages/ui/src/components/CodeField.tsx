import { useId, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';

/** Ticket code alphabet (H7): no 0/O, no 1/I. */
const ALPHABET = /[A-HJ-NP-Z2-9]/;

export function cleanTicketCode(raw: string, length = 5): string {
  return raw
    .toUpperCase()
    .split('')
    .filter((c) => ALPHABET.test(c))
    .join('')
    .slice(0, length);
}

export interface CodeFieldProps {
  /** Accessible name of each box, e.g. « Caractère 2 sur 5 ». */
  charLabel: (index: number) => string;
  disabled?: boolean | undefined;
  error?: string | undefined;
  /** Shown under the label, e.g. « Demandez son code au client ». */
  hint?: string | undefined;
  label: string;
  length?: number;
  onChange: (value: string) => void;
  /** Called when the last character makes the code complete. */
  onComplete?: ((code: string) => void) | undefined;
  value: string;
}

/** Ticket code typed by the stylist (C-05, DESIGN_SYSTEM §7.2). */
export function CodeField({
  charLabel,
  disabled,
  error,
  hint,
  label,
  length = 5,
  onChange,
  onComplete,
  value,
}: CodeFieldProps) {
  const id = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function focus(index: number) {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  function write(index: number, raw: string) {
    const typed = cleanTicketCode(raw, length - index);
    const head = value.slice(0, index);
    if (typed === '') {
      onChange(head);
      return;
    }
    const next = (head + typed).slice(0, length);
    onChange(next);
    focus(next.length);
    if (next.length === length && value.length < length) onComplete?.(next);
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'Backspace' && !value[index]) {
      event.preventDefault();
      if (index > 0) {
        onChange(value.slice(0, index - 1));
        focus(index - 1);
      }
    } else if (event.key === 'ArrowLeft') {
      focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      focus(index + 1);
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    write(index, event.clipboardData.getData('text'));
  }

  const describedBy =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <fieldset
      aria-describedby={describedBy}
      className="grid gap-2"
      disabled={disabled}
    >
      <legend className="mb-1 font-semibold text-body-sm">{label}</legend>
      {hint ? (
        <p className="text-body-sm text-text-muted" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      <div className="flex w-full gap-2">
        {Array.from({ length }, (_, index) => (
          <input
            aria-invalid={error ? true : undefined}
            aria-label={charLabel(index + 1)}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            className={[
              // Shrinks to fit 320 px and 200 % zoom (DEV-6 accessibility review).
              'h-16 min-w-0 max-w-14 flex-1 rounded-lg border bg-surface text-center font-display text-h2 uppercase tabular-nums text-text',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              error ? 'border-danger' : 'border-border-strong',
            ].join(' ')}
            inputMode="text"
            key={index}
            onChange={(event) => write(index, event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            ref={(element) => {
              refs.current[index] = element;
            }}
            spellCheck={false}
            type="text"
            value={value[index] ?? ''}
          />
        ))}
      </div>
      {error ? (
        <p className="text-body-sm text-danger" id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
