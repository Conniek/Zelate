import { Banner } from './Banner';

export interface ConnectionBannerProps {
  /** The connection is lost: the screen blocks its actions while it shows. */
  lost: boolean;
  lostLabel: string;
}

/** Stylist space and dashboard (DESIGN_SYSTEM §7.4): announced at once. */
export function ConnectionBanner({ lost, lostLabel }: ConnectionBannerProps) {
  if (!lost) return null;
  return (
    <Banner role="alert" tone="danger">
      {lostLabel}
    </Banner>
  );
}
