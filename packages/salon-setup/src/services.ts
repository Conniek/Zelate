export interface ServiceInput {
  name: string;
  durationMinutes: number;
  priceCents: number;
}

export type ServiceError =
  | 'validation.service_name'
  | 'validation.service_duration'
  | 'validation.service_price';

/** S-05 scenarios 3 to 8: a price of 0 is accepted. */
export function validateService(input: ServiceInput): ServiceError | null {
  const length = input.name.trim().length;
  if (length < 2 || length > 60) return 'validation.service_name';
  const d = input.durationMinutes;
  if (!Number.isInteger(d) || d < 15 || d > 180 || d % 5 !== 0) {
    return 'validation.service_duration';
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 0) {
    return 'validation.service_price';
  }
  return null;
}

/** "12,50" or "12.5" to 1250; null when it is not a price. */
export function priceToCents(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function centsToPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** S-05 scenario 11: a salon keeps at least one active service. */
export function canDeactivate(
  services: { id: string; isActive: boolean }[],
  id: string,
): boolean {
  return services.some((s) => s.isActive && s.id !== id);
}

/** Default durations offered with the suggestions (editable). */
export const SUGGESTION_DEFAULTS: Record<
  string,
  { durationMinutes: number; priceCents: number }
> = {
  women_cut: { durationMinutes: 45, priceCents: 4500 },
  men_cut: { durationMinutes: 30, priceCents: 2500 },
  kids_cut: { durationMinutes: 30, priceCents: 1800 },
  beard: { durationMinutes: 20, priceCents: 1500 },
  color: { durationMinutes: 90, priceCents: 6000 },
  highlights: { durationMinutes: 120, priceCents: 8000 },
  braids: { durationMinutes: 120, priceCents: 7000 },
  curly_hair: { durationMinutes: 60, priceCents: 5500 },
  styling: { durationMinutes: 30, priceCents: 2500 },
  treatment: { durationMinutes: 30, priceCents: 2000 },
};
