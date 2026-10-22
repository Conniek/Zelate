/**
 * What a salon of the home list says, the same on the list and on the map
 * (F-C1, U-01, U-16): wait, queue state, next free slot, freshness.
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isoWeekday, parisDate } from '@zelate/queue-service/time';
import type { SalonResult } from './client-api';
import { useTime } from './live';

/** « à vérifier » once 5 min have passed without an update (F-C1). */
const STALE_MS = 5 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export interface SalonSummary {
  /** « ~25 min », open and not full only. */
  wait: string | null;
  /** « File en pause », « Fermé · ouvre demain à 9h00 », « Complet aujourd'hui ». */
  state: string | null;
  /** « Créneau libre à 15h20 · Coupe », or « maintenant » once its time has come. */
  slot: string | null;
  freshness: string | null;
}

export function useSalonSummary(): (
  salon: SalonResult,
  now: number,
) => SalonSummary {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const time = useTime();
  return useCallback(
    (salon, now) => {
      const open = salon.queue_status === 'open';
      let state: string | null = null;
      if (open && salon.is_full) state = t('home.queue_state.full');
      if (salon.queue_status === 'paused') state = t('home.queue_state.paused');
      if (salon.queue_status === 'closed') {
        state = t('home.queue_state.closed');
        if (salon.next_opening_at) {
          const at = Date.parse(salon.next_opening_at);
          const days = Math.round(
            (Date.parse(`${parisDate(at)}T12:00:00Z`) -
              Date.parse(`${parisDate(now)}T12:00:00Z`)) /
              DAY_MS,
          );
          const day =
            days === 0
              ? tCommon('days.today')
              : days === 1
                ? tCommon('days.tomorrow')
                : tCommon(
                    `weekdays.${WEEKDAYS[isoWeekday(parisDate(at)) - 1]!}`,
                  );
          state = tCommon('queue.closed_with_next_opening', {
            day,
            time: time(salon.next_opening_at),
          });
        }
      }
      const slot = salon.next_free_slot
        ? Date.parse(salon.next_free_slot.start_at) <= now
          ? t('home.next_free_slot_now', {
              service_name: salon.next_free_slot.service_name,
            })
          : t('home.next_free_slot', {
              time: time(salon.next_free_slot.start_at),
              service_name: salon.next_free_slot.service_name,
            })
        : null;
      const updated = salon.estimate_updated_at
        ? Date.parse(salon.estimate_updated_at)
        : null;
      const freshness =
        open && updated !== null
          ? now - updated > STALE_MS
            ? t('home.freshness_stale')
            : t('home.freshness', {
                minutes: Math.max(0, Math.floor((now - updated) / 60_000)),
              })
          : null;
      const wait =
        open && !salon.is_full && salon.current_wait_minutes !== null
          ? t('home.wait_badge', { minutes: salon.current_wait_minutes })
          : null;
      return { wait, state, slot, freshness };
    },
    [t, tCommon, time],
  );
}
