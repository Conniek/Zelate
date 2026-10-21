import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog } from '@zelate/ui';
import { fetchPoster, regeneratePoster } from '../lib/qr-api';
import type { QrOutcome } from '../lib/qr-api';

function save(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'zelate-qr.pdf';
  link.click();
  URL.revokeObjectURL(url);
}

export function SetupQr({ salonId }: { salonId: string }) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<QrOutcome>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const outcome = await action();
    setBusy(false);
    setConfirming(false);
    if (outcome.ok) {
      save(outcome.blob);
    } else {
      setError(
        tErrors(
          outcome.messageKey.replace(/^errors\./, '') as 'generic.unexpected',
        ),
      );
    }
  }

  return (
    <section aria-labelledby="qr-title" className="grid gap-3">
      <h2 className="text-h2" id="qr-title">
        {t('qr.title')}
      </h2>
      {error && <Banner tone="danger">{error}</Banner>}
      <div className="flex flex-wrap gap-3">
        <Button
          loading={busy && !confirming}
          onClick={() => void run(() => fetchPoster(salonId))}
        >
          {t('qr.download')}
        </Button>
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          {t('qr.regenerate.label')}
        </Button>
      </div>
      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={setConfirming}
        open={confirming}
        title={t('qr.regenerate.confirm_title')}
        description={t('qr.regenerate.confirm')}
      >
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            {tCommon('actions.cancel')}
          </Button>
          <Button
            loading={busy}
            variant="danger"
            onClick={() => void run(() => regeneratePoster(salonId))}
          >
            {t('qr.regenerate.confirm_submit')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
