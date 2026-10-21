import { useId } from 'react';
import type { ChangeEvent } from 'react';

export interface PhoneFieldProps {
  /**
   * `tel-national` when a client types their own number. On a staff screen,
   * where someone else's number is typed, pass `off` with a `name` of its own,
   * so that the browser keeps no client number (H6, ADR-007).
   */
  autoComplete?: 'tel-national' | 'off' | undefined;
  name?: string | undefined;
  disabled?: boolean | undefined;
  error?: string | undefined;
  helpText?: string | undefined;
  id?: string | undefined;
  label: string;
  /** Called with the national digits only, without the leading 0 (max 9). */
  onChange: (nationalDigits: string) => void;
  /** Fixed, not editable: "+33" (PRD §6, French numbers only). */
  prefix: string;
  value: string;
}

const NATIONAL_LENGTH = 9;

/** Keeps digits only, drops a pasted "+33", "0033" or leading 0, caps at 9. */
export function toNationalDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+33') || digits.startsWith('0033')) {
    digits = digits.replace(/^(?:0033|33)/, '');
  }
  return digits.replace(/^0/, '').slice(0, NATIONAL_LENGTH);
}

export function PhoneField({
  autoComplete = 'tel-national',
  name = 'phone',
  disabled,
  error,
  helpText,
  id,
  label,
  onChange,
  prefix,
  value,
}: PhoneFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? helpText;

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange(toNationalDigits(event.target.value));
  }

  return (
    <div className="grid gap-2">
      <label className="font-semibold text-body-sm" htmlFor={inputId}>
        {label}
      </label>
      <div
        className={[
          'flex min-h-12 items-center rounded-lg border bg-surface text-body text-text',
          'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus-ring',
          error ? 'border-danger' : 'border-border-strong',
          disabled ? 'cursor-not-allowed bg-surface-muted opacity-70' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span aria-hidden="true" className="select-none pl-4 text-text-muted">
          {prefix}
        </span>
        <input
          aria-describedby={description ? descriptionId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className="min-h-12 flex-1 bg-transparent px-2 outline-none"
          disabled={disabled}
          id={inputId}
          inputMode="tel"
          name={name}
          onChange={handleChange}
          type="tel"
          value={value}
        />
      </div>
      {description ? (
        <p
          className={
            error ? 'text-body-sm text-danger' : 'text-body-sm text-text-muted'
          }
          id={descriptionId}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
