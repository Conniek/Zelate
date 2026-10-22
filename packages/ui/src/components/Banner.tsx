import type { ReactNode } from 'react';

type BannerTone = 'info' | 'success' | 'warning' | 'danger';
type BannerRole = 'status' | 'alert';

export interface BannerProps {
  children: ReactNode;
  role?: BannerRole;
  /** A plain note, no live role: another live region already says it. */
  silent?: boolean;
  tone?: BannerTone;
}

const toneClasses: Record<BannerTone, string> = {
  info: 'border-info bg-surface text-text',
  success: 'border-success bg-success-subtle text-success-text',
  warning: 'border-warning bg-warning-subtle text-warning-text',
  danger: 'border-danger bg-danger-subtle text-danger-text',
};

export function Banner({
  children,
  role = 'status',
  silent = false,
  tone = 'info',
}: BannerProps) {
  return (
    <div
      className={`rounded-lg border-l-4 px-4 py-3 ${toneClasses[tone]}`}
      role={silent ? undefined : role}
    >
      {children}
    </div>
  );
}
