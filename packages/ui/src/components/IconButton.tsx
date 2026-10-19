import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  'aria-label': string;
  children: ReactNode;
}

export function IconButton({ className, children, ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      className={[
        'inline-flex size-11 items-center justify-center rounded-lg text-text transition-colors hover:bg-surface-muted',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      type={props.type ?? 'button'}
    >
      {children}
    </button>
  );
}
