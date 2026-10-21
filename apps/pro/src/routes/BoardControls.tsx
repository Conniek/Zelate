import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog } from '@zelate/ui';
import type { BoardIndicators, BoardStylist } from '../lib/board-api';
import { useCommand } from '../lib/use-command';

type QueueStatus = BoardIndicators['queue_status'];

interface Props {
  announce: (message: string) => void;
  /** « Je prends le prochain »: the manager, not cutting hair, is free and clients wait (F-M6). */
  canTakeNext: boolean;
  disabled: boolean;
  indicators: BoardIndicators;
  manager: BoardStylist | undefined;
  salonId: string;
}

/** F-M5 (open, pause, close) and the « Je coiffe » switch (S-02, F-M6). */
export function BoardControls({
  announce,
  canTakeNext,
  disabled,
  indicators,
  manager,
  salonId,
}: Props) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { busy, error, run } = useCommand();
  const [confirmClose, setConfirmClose] = useState(false);

  const blocked = disabled || busy !== null;
  const offline = disabled ? 'board-offline' : undefined;

  const setStatus = async (status: QueueStatus) => {
    const outcome = await run(
      'set_queue_status',
      { salon_id: salonId, status },
      salonId,
    );
    setConfirmClose(false);
    if (outcome.ok) announce(t(`queue_status.done.${status}`));
  };

  const setHairdressing = async (on: boolean) => {
    if (blocked) return;
    const outcome = await run(
      'set_hairdressing',
      { is_hairdressing: on },
      salonId,
    );
    if (outcome.ok)
      announce(t(on ? 'board.hairdressing.on' : 'board.hairdressing.off'));
  };

  // `call_ticket` in the manager's name: the engine lets him call while not cutting hair.
  const takeNext = async () => {
    if (blocked) return;
    const outcome = await run('call_ticket', {}, salonId);
    if (outcome.ok) announce(t('board.take_next_done'));
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
              aria-describedby={offline}
              aria-disabled={disabled || undefined}
              aria-pressed={indicators.queue_status === status}
              key={status}
              loading={busy === 'set_queue_status' && status !== 'closed'}
              onClick={() =>
                blocked || indicators.queue_status === status
                  ? undefined
                  : status === 'closed'
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
              aria-describedby={offline}
              aria-disabled={disabled || undefined}
              checked={manager.is_hairdressing}
              className="size-5"
              onChange={(event) => void setHairdressing(event.target.checked)}
              type="checkbox"
            />
            {t('board.hairdressing.label')}
          </label>
        ) : null}
        {canTakeNext ? (
          <Button
            aria-describedby={offline}
            aria-disabled={disabled || undefined}
            loading={busy === 'call_ticket'}
            onClick={() => void takeNext()}
            size="sm"
          >
            {t('board.take_next')}
          </Button>
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
            loading={busy === 'set_queue_status'}
            onClick={() => void setStatus('closed')}
          >
            {t('queue_status.close_confirm_submit')}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
