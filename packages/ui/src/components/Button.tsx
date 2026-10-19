import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-text-on-primary hover:bg-primary-hover active:bg-primary-active',
  secondary:
    'border border-border-strong bg-surface text-text hover:bg-surface-muted',
  ghost: 'text-link hover:bg-primary-subtle',
  success: 'bg-success text-text-on-primary hover:bg-success-text',
  danger: 'bg-danger text-text-on-primary hover:bg-danger-text',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-body-sm after:absolute after:inset-[-4px] after:content-['']",
  md: 'min-h-11 px-4 text-body',
  lg: 'min-h-[52px] px-5 text-body-lg',
  xl: 'min-h-14 px-6 text-body-lg',
};

export function Button({
  children,
  className,
  fullWidth = false,
  loading = false,
  size = 'md',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const classes = [
    'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150 ease-standard',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
    'disabled:cursor-not-allowed disabled:opacity-50',
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? 'w-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={classes}
      disabled={props.disabled || loading}
      type={type}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </button>
  );
}
