/** Map links and opening times shown by the client app (F-C2, F-C5). */
import { parisDate, isoWeekday } from '@zelate/queue-service/time';

export interface Address {
  address_line: string;
  postal_code: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
}

/** The device's map app: Apple Plans on Apple devices, `geo:` elsewhere. */
export function directionsUrl(place: Address): string {
  const address = `${place.address_line}, ${place.postal_code} ${place.city}`;
  if (/iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)) {
    return `https://maps.apple.com/?daddr=${encodeURIComponent(address)}`;
  }
  const at =
    place.latitude != null && place.longitude != null
      ? `${place.latitude},${place.longitude}`
      : '0,0';
  return `geo:${at}?q=${encodeURIComponent(address)}`;
}

export interface OpeningRange {
  weekday: number;
  opens_at: string;
  closes_at: string;
}

const minutesOf = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h! * 60 + m!;
};

/** The engine's length of a service not chosen (queue-engine `UNKNOWN_SERVICE_MINUTES`). */
export const UNKNOWN_SERVICE_MINUTES = 30;

/**
 * F-C12: today's appointment times every `step` minutes. The last one leaves
 * `duration` before closing, as `check_in_appointment` requires.
 */
export function todaySlots(
  hours: readonly OpeningRange[],
  now: number,
  step = 5,
  duration = UNKNOWN_SERVICE_MINUTES,
): string[] {
  const weekday = isoWeekday(parisDate(now));
  const out: string[] = [];
  for (const range of hours.filter((h) => h.weekday === weekday)) {
    const end = Math.min(minutesOf(range.closes_at), 24 * 60);
    for (let m = minutesOf(range.opens_at); m + duration <= end; m += step) {
      out.push(
        `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
      );
    }
  }
  return [...new Set(out)].sort();
}
