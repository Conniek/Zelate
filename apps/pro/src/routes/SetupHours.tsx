import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { copyToWeek, validateDay, validateWeek } from '@zelate/salon-setup';
import type { Week } from '@zelate/salon-setup';
import { Banner, Button, TextField } from '@zelate/ui';
import { loadHours, saveHours } from '../lib/setup-api';

const DAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export function SetupHours({ salonId }: { salonId: string }) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['hours', salonId],
    queryFn: () => loadHours(salonId),
  });
  const [week, setWeek] = useState<Week>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setWeek(data);
  }, [data]);

  function change(day: number, ranges: Week[number]) {
    setWeek({ ...week, [day]: ranges });
    setSaved(false);
  }

  async function save() {
    const code = validateWeek(week);
    if (code) {
      setError(tErrors(code));
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await saveHours(week);
    setBusy(false);
    if (failure) {
      setError(tErrors(failure as 'generic.unexpected'));
      return;
    }
    setSaved(true);
    await queryClient.invalidateQueries({ queryKey: ['hours', salonId] });
  }

  return (
    <section aria-labelledby="hours-title" className="grid gap-4">
      <h2 className="text-h2" id="hours-title">
        {t('hours.title')}
      </h2>
      {DAYS.map((name, index) => {
        const day = index + 1;
        const ranges = week[day] ?? [];
        const dayError = validateDay(ranges);
        return (
          <fieldset className="grid gap-3 rounded-lg border p-4" key={name}>
            <legend className="font-semibold">
              {tCommon(`weekdays.${name}`)}
            </legend>
            {ranges.length === 0 && (
              <p className="text-body-sm text-text-muted">
                {t('hours.day_closed')}
              </p>
            )}
            {ranges.map((range, i) => (
              <div className="flex flex-wrap items-end gap-3" key={i}>
                <TextField
                  label={t('hours.range.opens')}
                  onChange={(event) =>
                    change(
                      day,
                      ranges.map((r, j) =>
                        j === i ? { ...r, opens: event.target.value } : r,
                      ),
                    )
                  }
                  type="time"
                  value={range.opens}
                />
                <TextField
                  label={t('hours.range.closes')}
                  onChange={(event) =>
                    change(
                      day,
                      ranges.map((r, j) =>
                        j === i ? { ...r, closes: event.target.value } : r,
                      ),
                    )
                  }
                  type="time"
                  value={range.closes}
                />
                <Button
                  onClick={() =>
                    change(
                      day,
                      ranges.filter((_, j) => j !== i),
                    )
                  }
                  variant="ghost"
                >
                  {t('hours.range.remove')}
                </Button>
              </div>
            ))}
            {dayError && (
              <p className="text-body-sm text-danger" role="alert">
                {tErrors(dayError)}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() =>
                  change(day, [...ranges, { opens: '09:00', closes: '19:00' }])
                }
                variant="secondary"
              >
                {t('hours.add_range')}
              </Button>
              {day === 1 && ranges.length > 0 && (
                <Button
                  onClick={() => {
                    setWeek(copyToWeek(week, 1));
                    setSaved(false);
                  }}
                  variant="secondary"
                >
                  {t('hours.copy_to_week')}
                </Button>
              )}
            </div>
          </fieldset>
        );
      })}
      {error && (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      )}
      {saved && (
        <Banner role="status" tone="success">
          {t('hours.saved')}
        </Banner>
      )}
      <Button loading={busy} onClick={() => void save()}>
        {t('hours.save')}
      </Button>
    </section>
  );
}
