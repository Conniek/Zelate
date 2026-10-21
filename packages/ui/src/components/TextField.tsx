import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface TextFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'size'
> {
  error?: string | undefined;
  helpText?: string | undefined;
  id?: string;
  label: string;
}

export function TextField({
  error,
  helpText,
  id,
  label,
  ...props
}: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const descriptionId = `${inputId}-description`;
  const description = error ?? helpText;

  return (
    <div className="grid gap-2">
      <label className="font-semibold text-body-sm" htmlFor={inputId}>
        {label}
      </label>
      <input
        {...props}
        aria-describedby={description ? descriptionId : undefined}
        aria-invalid={error ? true : undefined}
        className={[
          'min-h-12 rounded-lg border border-border-strong bg-surface px-4 text-body text-text',
          'placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70',
          error ? 'border-danger' : '',
          props.className ?? '',
        ]
          .filter(Boolean)
          .join(' ')}
        id={inputId}
      />
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
