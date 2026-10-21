export interface TimeRange {
  /** "HH:MM" */
  opens: string;
  closes: string;
}

export type HoursError = 'validation.hours_order' | 'validation.hours_overlap';

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Weekdays use ISO numbers: 1 = Monday … 7 = Sunday (database convention). */
export type Week = Record<number, TimeRange[]>;

export function isTime(value: string): boolean {
  return TIME.test(value);
}

/** S-03 scenarios 3 and 4: each range closes after it opens, none overlap. */
export function validateDay(ranges: TimeRange[]): HoursError | null {
  for (const range of ranges) {
    if (!isTime(range.opens) || !isTime(range.closes)) {
      return 'validation.hours_order';
    }
    if (range.closes <= range.opens) return 'validation.hours_order';
  }
  const sorted = [...ranges].sort((a, b) => a.opens.localeCompare(b.opens));
  for (let i = 1; i < sorted.length; i++) {
    // Touching ranges (12:00 then 12:00) do not overlap.
    if ((sorted[i]?.opens ?? '') < (sorted[i - 1]?.closes ?? '')) {
      return 'validation.hours_overlap';
    }
  }
  return null;
}

export function validateWeek(
  week: Week,
): HoursError | 'validation.at_least_one_open_day' | null {
  let open = false;
  for (let day = 1; day <= 7; day++) {
    const ranges = week[day] ?? [];
    const error = validateDay(ranges);
    if (error) return error;
    if (ranges.length > 0) open = true;
  }
  return open ? null : 'validation.at_least_one_open_day';
}

/** S-03 scenario 5: copies one day's ranges onto every other day. */
export function copyToWeek(week: Week, from: number): Week {
  const source = week[from] ?? [];
  const copy: Week = {};
  for (let day = 1; day <= 7; day++) {
    copy[day] = source.map((range) => ({ ...range }));
  }
  return copy;
}

/** Database `time` values come as "HH:MM:SS". */
export function toHm(time: string): string {
  return time.slice(0, 5);
}
