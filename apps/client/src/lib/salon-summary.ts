/**
 * What a salon of the home list says, the same on the list and on the map
 * (F-C1, U-01, U-16): its badge, queue state, next free slot, freshness.
 * Opening hours win over the queue button: after closing, a salon left
 * « open » reads « Fermé · ouvre demain à 9h00 ».
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isoWeekday, parisDate } from '@zelate/queue-service/time';
import type { SalonResult } from './client-api';
import { useTime } from './live';

const DAY_MS = 24 * 60 * 60_000;
const HOUR_MS = 60 * 60_000;
const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type BadgeTone = 'wait' | 'free' | 'full' | 'off';

/** Badge colours: wait in the brand colour, free in green, full in light red, closed greyed. */
export const BADGE_CLASSES: Record<BadgeTone, string> = {
  wait: 'bg-primary-subtle text-link',
  free: 'bg-success-subtle text-success-text',
  full: 'bg-danger-subtle text-danger-text',
  off: 'bg-surface-muted text-text-muted',
};

export interface SalonSummary {
  /** « ~25 min », « Aucune attente », « Complet aujourd'hui », « Fermé », « En pause ». */
  badge: { text: string; tone: BadgeTone } | null;
  /** « Fermé · ouvre demain à 9h00 », « File en pause »; null when the badge says it all. */
  state: string | null;
  /** « Créneau libre à 15h20 · Coupe », or « maintenant » once its time has come. */
  slot: string | null;
  /** « mis à jour il y a 3 min », « mis à jour à 14h05 ». */
  freshness: string | null;
}

type Openness = 'open' | 'paused' | 'closed';

/** Shared by the list, the map and the salon page. */
export function openness(
  queueStatus: 'open' | 'paused' | 'closed',
  closesAt: string | null,
  now: number,
): Openness {
  const withinHours = closesAt !== null && now < Date.parse(closesAt);
  if (!withinHours || queueStatus === 'closed') return 'closed';
  return queueStatus;
}

/** True when the next client would start after closing (« Complet aujourd'hui »). */
export function fullToday(
  isFull: boolean,
  waitMinutes: number | null,
  closesAt: string | null,
  now: number,
): boolean {
  if (isFull) return true;
  return (
    waitMinutes !== null &&
    closesAt !== null &&
    now + waitMinutes * 60_000 >= Date.parse(closesAt)
  );
}

export function useOpeningDay(): (at: string, now: number) => string {
  const { t: tCommon } = useTranslation('common');
  return useCallback(
    (at, now) => {
      const instant = Date.parse(at);
      const days = Math.round(
        (Date.parse(`${parisDate(instant)}T12:00:00Z`) -
          Date.parse(`${parisDate(now)}T12:00:00Z`)) /
          DAY_MS,
      );
      return days === 0
        ? tCommon('days.today')
        : days === 1
          ? tCommon('days.tomorrow')
          : tCommon(
              `weekdays.${WEEKDAYS[isoWeekday(parisDate(instant)) - 1]!}`,
            );
    },
    [tCommon],
  );
}

export function useSalonSummary(): (
  salon: SalonResult,
  now: number,
) => SalonSummary {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const time = useTime();
  const openingDay = useOpeningDay();
  return useCallback(
    (salon, now) => {
      const state = openness(salon.queue_status, salon.closes_at, now);
      if (state === 'closed') {
        return {
          badge: { text: t('home.queue_state.closed'), tone: 'off' },
          state: salon.next_opening_at
            ? tCommon('queue.closed_with_next_opening', {
                day: openingDay(salon.next_opening_at, now),
                time: time(salon.next_opening_at),
              })
            : null,
          slot: null,
          freshness: null,
        };
      }
      if (state === 'paused') {
        return {
          badge: { text: t('home.queue_state.paused_badge'), tone: 'off' },
          state: t('home.queue_state.paused'),
          slot: null,
          freshness: null,
        };
      }
      const wait = salon.current_wait_minutes;
      const full = fullToday(salon.is_full, wait, salon.closes_at, now);
      const badge: SalonSummary['badge'] = full
        ? { text: t('home.queue_state.full'), tone: 'full' }
        : wait === 0
          ? { text: t('home.no_wait'), tone: 'free' }
          : wait !== null
            ? { text: t('home.wait_badge', { minutes: wait }), tone: 'wait' }
            : null;
      const slot =
        !full && salon.next_free_slot
          ? Date.parse(salon.next_free_slot.start_at) <= now
            ? t('home.next_free_slot_now', {
                service_name: salon.next_free_slot.service_name,
              })
            : t('home.next_free_slot', {
                time: time(salon.next_free_slot.start_at),
                service_name: salon.next_free_slot.service_name,
              })
          : null;
      const updated = salon.estimate_updated_at;
      const freshness =
        updated === null
          ? null
          : now - Date.parse(updated) < HOUR_MS
            ? t('home.freshness', {
                minutes: Math.max(
                  0,
                  Math.floor((now - Date.parse(updated)) / 60_000),
                ),
              })
            : t('home.freshness_at', { time: time(updated) });
      return { badge, state: null, slot, freshness };
    },
    [openingDay, t, tCommon, time],
  );
}
