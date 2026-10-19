import type { HTMLAttributes } from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden="true"
      className={[
        'animate-pulse rounded-md bg-surface-muted motion-reduce:animate-none',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
