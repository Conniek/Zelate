import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Banner, Button } from '@zelate/ui';
import { sendCommand } from '../lib/queue-api';
import { useErrorText } from '../lib/use-command';
import type { SetupSalon } from '../lib/setup-api';

/** S-07: test client, then publication once every point is checked (K24, K35). */
export function SetupPublish({
  salon,
  ready,
}: {
  salon: SetupSalon;
  ready: boolean;
}) {
  const { t } = useTranslation('pro-manager');
  const { t: tStylist } = useTranslation('pro-stylist');
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<'test' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testCode, setTestCode] = useState<string | null>(null);

  async function run(command: 'create_test_ticket' | 'publish_salon') {
    setBusy(command === 'create_test_ticket' ? 'test' : 'publish');
    setError(null);
    const outcome = await sendCommand(
      command,
      { salon_id: salon.id },
      { salonId: salon.id },
    );
    setBusy(null);
    if (!outcome.ok) {
      setError(errorText(outcome.messageKey));
      return;
    }
    if (command === 'create_test_ticket') {
      setTestCode(String(outcome.data.short_code ?? ''));
    }
    await queryClient.invalidateQueries({ queryKey: ['own-salon'] });
  }

  if (salon.status === 'published') return null;
  const passed = salon.setup_test_passed_at !== null;

  return (
    <section aria-labelledby="test-title" className="grid gap-3">
      <h2 className="text-h2" id="test-title">
        {t('setup.test.title')}
      </h2>
      {passed ? (
        <Banner tone="success">{t('setup.test.passed')}</Banner>
      ) : (
        <>
          <p className="text-body-sm text-text-muted">
            {t('setup.test.intro')}
          </p>
          {testCode ? (
            <p className="font-display text-h2 tabular-nums" aria-live="polite">
              {testCode}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button
              loading={busy === 'test'}
              onClick={() => void run('create_test_ticket')}
              variant="secondary"
            >
              {t('setup.test.start')}
            </Button>
            {testCode ? (
              <Link
                className="inline-flex min-h-11 items-center text-link underline"
                to="/stylist/queue"
              >
                {tStylist('menu.queue')}
              </Link>
            ) : null}
          </div>
        </>
      )}
      {error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
      <Button
        disabled={!ready}
        loading={busy === 'publish'}
        onClick={() => void run('publish_salon')}
        size="lg"
      >
        {t('setup.publish')}
      </Button>
      {!ready ? (
        <p className="text-body-sm text-text-muted">
          {t('setup.checklist.missing_hint')}
        </p>
      ) : null}
    </section>
  );
}
