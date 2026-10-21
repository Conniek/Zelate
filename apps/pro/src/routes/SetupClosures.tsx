import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { validateClosure } from '@zelate/salon-setup';
import { Banner, Button, TextField } from '@zelate/ui';
import { addClosure, loadClosures, removeClosure } from '../lib/setup-api';

export function SetupClosures({ salonId }: { salonId: string }) {
  const { t } = useTranslation('pro-manager');
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['closures', salonId],
    queryFn: () => loadClosures(salonId),
  });
  const [startsOn, setStartsOn] = useState('');
  const [endsOn, setEndsOn] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['closures', salonId] });
  }

  async function add() {
    const code = validateClosure({ startsOn, endsOn, reason });
    if (code) {
      setError(tErrors(code));
      return;
    }
    if (!(await addClosure(salonId, { startsOn, endsOn, reason }))) {
      setError(tErrors('generic.unexpected'));
      return;
    }
    setError(null);
    setStartsOn('');
    setEndsOn('');
    setReason('');
    await refresh();
  }

  return (
    <section aria-labelledby="closures-title" className="grid gap-4">
      <h2 className="text-h2" id="closures-title">
        {t('hours.closures.title')}
      </h2>
      {data?.length === 0 && (
        <p className="text-body-sm text-text-muted">
          {t('hours.closures.empty')}
        </p>
      )}
      <ul className="grid gap-2">
        {data?.map((closure) => (
          <li className="flex flex-wrap items-center gap-3" key={closure.id}>
            <span>
              {closure.starts_on === closure.ends_on
                ? closure.starts_on
                : `${closure.starts_on} → ${closure.ends_on}`}
              {closure.reason ? ` · ${closure.reason}` : ''}
            </span>
            <Button
              onClick={() => void removeClosure(closure.id).then(refresh)}
              variant="ghost"
            >
              {t('hours.closures.remove')}
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label={t('hours.closures.from')}
          onChange={(event) => setStartsOn(event.target.value)}
          type="date"
          value={startsOn}
        />
        <TextField
          label={t('hours.closures.to')}
          onChange={(event) => setEndsOn(event.target.value)}
          type="date"
          value={endsOn}
        />
        <TextField
          label={t('hours.closures.reason')}
          maxLength={120}
          onChange={(event) => setReason(event.target.value)}
          value={reason}
        />
      </div>
      {error && (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      )}
      <Button onClick={() => void add()} variant="secondary">
        {t('hours.closures.add')}
      </Button>
    </section>
  );
}
