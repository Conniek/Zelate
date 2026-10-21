import { useId, useRef } from 'react';
import type { ChangeEvent, ClipboardEvent, KeyboardEvent } from 'react';

export interface OtpFieldProps {
  disabled?: boolean | undefined;
  /** Accessible name of each box, e.g. "Chiffre 3 sur 6". */
  digitLabel: (index: number) => string;
  error?: string | undefined;
  label: string;
  length?: number;
  onChange: (value: string) => void;
  /** Called once, when the last digit makes the code complete (U-03 scenario 2). */
  onComplete: (code: string) => void;
  value: string;
}

export function OtpField({
  disabled,
  digitLabel,
  error,
  label,
  length = 6,
  onChange,
  onComplete,
  value,
}: OtpFieldProps) {
  const groupId = useId();
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function focus(index: number) {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  // Typing, pasting and the SMS autofill of the first box all end up here.
  function write(index: number, raw: string) {
    const digits = raw.replace(/\D/g, '');
    const chars = value.padEnd(length, ' ').split('');
    if (digits === '') {
      chars[index] = ' ';
      onChange(chars.join('').trimEnd().replace(/ /g, ''));
      return;
    }
    const taken = digits.slice(0, length - index);
    for (let i = 0; i < taken.length; i += 1)
      chars[index + i] = taken[i] ?? ' ';
    const next = chars.join('').replace(/ /g, '');
    onChange(next);
    focus(index + taken.length);
    if (next.length === length && value.length < length) onComplete(next);
  }

  function handleChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    write(index, event.target.value);
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    write(index, event.clipboardData.getData('text'));
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

  return (
    <fieldset
      aria-describedby={error ? `${groupId}-error` : undefined}
      className="grid gap-2"
      disabled={disabled}
    >
      <legend className="mb-2 font-semibold text-body-sm">{label}</legend>
      <div className="flex gap-2">
        {Array.from({ length }, (_, index) => (
          <input
            aria-invalid={error ? true : undefined}
            aria-label={digitLabel(index + 1)}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            className={[
              'h-14 w-12 rounded-lg border bg-surface text-center text-h3 text-text',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
              error ? 'border-danger' : 'border-border-strong',
            ].join(' ')}
            inputMode="numeric"
            key={index}
            onChange={(event) => handleChange(index, event)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={(event) => handlePaste(index, event)}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="text"
            value={value[index] ?? ''}
          />
        ))}
      </div>
      {error ? (
        <p
          className="text-body-sm text-danger"
          id={`${groupId}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
