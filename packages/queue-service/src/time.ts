/**
 * The single Paris-time helper of the queue server (ADR-010): service date,
 * weekday and opening ranges are computed here, in Europe/Paris, and handed to
 * the engine as UTC instants. Uses only Intl, so it runs in Node and Deno.
 */
import type {
  Instant,
  OpeningRange,
  ServiceDay,
} from '../../queue-engine/src/index.ts';

const PARIS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

interface Parts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

function partsAt(instant: Instant): Parts {
  const out: Record<string, number> = {};
  for (const part of PARIS.formatToParts(new Date(instant))) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year!,
    month: out.month!,
    day: out.day!,
    hour: out.hour!,
    minute: out.minute!,
    second: out.second!,
  };
}

/** Paris offset from UTC at an instant, in milliseconds (+1 h or +2 h). */
function offsetAt(instant: Instant): number {
  const p = partsAt(instant);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` of an instant in Paris: the service date of a ticket. */
export function parisDate(instant: Instant): string {
  const p = partsAt(instant);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** `HH:MM` of an instant in Paris. */
export function parisTime(instant: Instant): string {
  const p = partsAt(instant);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

function splitDate(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y!, m!, d!];
}

/** ISO weekday of a Paris date: Monday = 1 … Sunday = 7 (`opening_hours.weekday`). */
export function isoWeekday(date: string): number {
  const [y, m, d] = splitDate(date);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = splitDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Instant of a Paris wall-clock time on a date. `time` is `HH:MM` or
 * `HH:MM:SS` (Postgres `time`, `24:00:00` included). Two passes settle the
 * offset on daylight-saving days.
 */
export function parisInstant(date: string, time: string): Instant {
  const [y, m, d] = splitDate(date);
  const [hh, mm, ss] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh!, mm!, ss ?? 0);
  const first = naive - offsetAt(naive);
  return naive - offsetAt(first);
}

export interface OpeningHourRow {
  readonly opens_at: string;
  readonly closes_at: string;
}

/**
 * Service day of a salon (engine `ServiceDay`): today's opening ranges, none
 * on a closure day, and the next Paris midnight (E24, invariant 9).
 */
export function serviceDayOf(
  date: string,
  hours: readonly OpeningHourRow[],
  closed: boolean,
): ServiceDay {
  const opening_ranges: OpeningRange[] = closed
    ? []
    : hours.map((h) => ({
        opens_at: parisInstant(date, h.opens_at),
        closes_at: parisInstant(date, h.closes_at),
      }));
  return {
    service_date: date,
    opening_ranges,
    ends_at: parisInstant(addDays(date, 1), '00:00'),
  };
}
