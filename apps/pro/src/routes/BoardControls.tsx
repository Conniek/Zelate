import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog } from '@zelate/ui';
import type { BoardIndicators, BoardStylist } from '../lib/board-api';
import { useCommand } from '../lib/use-command';

type QueueStatus = BoardIndicators['queue_status'];

interface Props {
  disabled: boolean;
  indicators: BoardIndicators;
  manager: BoardStylist | undefined;
  salonId: string;
}

/** F-M5 (open, pause, close) and the « Je coiffe » switch (S-02, F-M6). */
export function BoardControls({
  disabled,
  indicators,
  manager,
  salonId,
}: Props) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { busy, error, run } = useCommand();
  const [confirmClose, setConfirmClose] = useState(false);

  const setStatus = async (status: QueueStatus) => {
    await run('set_queue_status', { salon_id: salonId, status });
    setConfirmClose(false);
  };
  const choices: { status: QueueStatus; label: string }[] = [
    { status: 'open', label: t('queue_status.open') },
    { status: 'paused', label: t('queue_status.pause') },
    { status: 'closed', label: t('queue_status.close') },
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div
          aria-label={t('queue_status.label')}
          className="flex gap-2"
          role="group"
        >
          {choices.map(({ label, status }) => (
            <Button
              aria-pressed={indicators.queue_status === status}
              disabled={disabled || busy !== null}
              key={status}
              onClick={() =>
                status === 'closed'
                  ? setConfirmClose(true)
                  : void setStatus(status)
              }
              size="sm"
              variant={
                indicators.queue_status === status ? 'primary' : 'secondary'
              }
            >
              {label}
            </Button>
          ))}
        </div>
        {manager ? (
          <label className="flex min-h-11 items-center gap-2 text-body-sm font-semibold">
            <input
              checked={manager.is_hairdressing}
              className="size-5"
              disabled={disabled || busy !== null}
              onChange={(event) =>
                void run('set_hairdressing', {
                  is_hairdressing: event.target.checked,
                })
              }
              type="checkbox"
            />
            {t('board.hairdressing.label')}
          </label>
        ) : null}
      </div>
      {indicators.queue_status === 'paused' ? (
        <p className="text-body-sm text-text-muted">
          {t('queue_status.pause_hint')}
        </p>
      ) : null}
      {error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
      <Dialog
        closeLabel={tCommon('actions.close')}
        description={t('queue_status.close_confirm', {
          count: indicators.waiting_count,
        })}
        onOpenChange={setConfirmClose}
        open={confirmClose}
        title={t('queue_status.close_confirm_title')}
      >
        <div className="flex justify-end gap-2">
          <Button onClick={() => setConfirmClose(false)} variant="secondary">
            {tCommon('actions.cancel')}
          </Button>
          <Button
            disabled={busy !== null}
            onClick={() => void setStatus('closed')}
          >
            {t('queue_status.close_confirm_submit')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
