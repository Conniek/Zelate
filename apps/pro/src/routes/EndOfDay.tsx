import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog } from '@zelate/ui';
import { endOfDayPhase } from '../lib/board-api';
import type { BoardIndicators, BoardTicket } from '../lib/board-api';
import { timeParts } from '../lib/stylist';
import { useNow } from '../lib/use-board';
import { useCommand } from '../lib/use-command';

interface Props {
  announce: (message: string) => void;
  disabled: boolean;
  indicators: BoardIndicators;
  salonId: string;
  tickets: BoardTicket[];
}

/**
 * F-M12 (S-15, H9): from the warning until the closing, the clients at risk and
 * their answer; at the closing, « Servir » or « Annuler avec excuses » for each
 * client still waiting, until the automatic cancellation.
 */
export function EndOfDay({
  announce,
  disabled,
  indicators,
  salonId,
  tickets,
}: Props) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { busy, error, run } = useCommand();
  const [confirmAll, setConfirmAll] = useState(false);
  const now = useNow();
  const phase = endOfDayPhase(indicators, now);
  if (phase === 'before' || phase === 'after' || !indicators.last_closing_at) {
    return null;
  }

  const closing = Date.parse(indicators.last_closing_at);
  const time = (instant: number) =>
    tCommon('formats.time', timeParts(new Date(instant).toISOString()));
  const answer = (ticket: BoardTicket) =>
    t(`end_of_day.response.${ticket.end_of_day_choice ?? 'none'}`);
  const offline = disabled ? 'board-offline' : undefined;

  async function resolve(ids: string[], decision: 'serve' | 'cancel') {
    if (disabled || busy !== null || ids.length === 0) return;
    const outcome = await run(
      'resolve_closing',
      { ticket_ids: ids, decision },
      salonId,
    );
    setConfirmAll(false);
    if (outcome.ok) {
      announce(t(`end_of_day.done.${decision}`, { count: ids.length }));
    }
  }

  if (phase === 'warning') {
    const atRisk = tickets.filter(
      (x) =>
        x.status === 'waiting' &&
        x.end_of_day_warned_at !== null &&
        x.closing_decision === null,
    );
    return (
      <section
        aria-labelledby="end-of-day-title"
        className="grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4"
      >
        <h2 className="text-h3" id="end-of-day-title">
          {t('end_of_day.banner.title')}
        </h2>
        <p>
          {t('end_of_day.banner.body', {
            count: atRisk.length,
            time: time(closing),
          })}
        </p>
        {atRisk.length > 0 ? (
          <ul className="grid gap-1 text-body-sm">
            {atRisk.map((ticket) => (
              <li key={ticket.id}>
                <span className="font-semibold">{ticket.display_name}</span>
                {' · '}
                {answer(ticket)}
              </li>
            ))}
          </ul>
        ) : null}
        {indicators.queue_status !== 'closed' ? (
          <div>
            <Button
              aria-describedby={offline}
              aria-disabled={disabled || undefined}
              loading={busy === 'set_queue_status'}
              onClick={async () => {
                if (disabled || busy !== null) return;
                const outcome = await run(
                  'set_queue_status',
                  { salon_id: salonId, status: 'closed' },
                  salonId,
                );
                if (outcome.ok) announce(t('queue_status.done.closed'));
              }}
              variant="secondary"
            >
              {t('end_of_day.close_now')}
            </Button>
          </div>
        ) : null}
        {error ? (
          <Banner role="alert" tone="danger">
            {error}
          </Banner>
        ) : null}
      </section>
    );
  }

  // At the closing: every client still waiting, without a decision yet.
  const remaining = tickets.filter(
    (x) => x.status === 'waiting' && x.closing_decision === null,
  );
  if (remaining.length === 0) return null;
  const ids = remaining.map((x) => x.id);
  const autoCancel = closing + indicators.closing_grace_minutes * 60_000;

  return (
    <section
      aria-labelledby="closing-title"
      className="grid gap-3 rounded-xl border border-danger bg-surface p-4"
    >
      <h2 className="text-h3" id="closing-title">
        {t('end_of_day.closing.title', { count: remaining.length })}
      </h2>
      <p>{t('end_of_day.closing.body', { time: time(autoCancel) })}</p>
      <p className="text-body-sm text-text-muted">
        {t('end_of_day.closing.serve_hint')}
      </p>
      <ul className="grid gap-2">
        {remaining.map((ticket) => (
          <li
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
            key={ticket.id}
          >
            <span>
              <span className="font-semibold">{ticket.display_name}</span>
              {ticket.end_of_day_warned_at !== null ? (
                <span className="text-body-sm text-text-muted">
                  {' · '}
                  {answer(ticket)}
                </span>
              ) : null}
            </span>
            <span
              aria-label={ticket.display_name}
              className="flex flex-wrap gap-2"
              role="group"
            >
              <Button
                aria-describedby={offline}
                aria-disabled={disabled || undefined}
                onClick={() => void resolve([ticket.id], 'serve')}
                size="sm"
                variant="secondary"
              >
                {t('end_of_day.closing.serve')}
              </Button>
              <Button
                aria-describedby={offline}
                aria-disabled={disabled || undefined}
                onClick={() => void resolve([ticket.id], 'cancel')}
                size="sm"
                variant="danger"
              >
                {t('end_of_day.closing.cancel')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {remaining.length > 1 ? (
        <div
          aria-label={t('end_of_day.closing.all')}
          className="flex flex-wrap items-center gap-2"
          role="group"
        >
          <span className="font-semibold">{t('end_of_day.closing.all')}</span>
          <Button
            aria-describedby={offline}
            aria-disabled={disabled || undefined}
            loading={busy === 'resolve_closing'}
            onClick={() => void resolve(ids, 'serve')}
            size="sm"
            variant="secondary"
          >
            {t('end_of_day.closing.serve')}
          </Button>
          <Button
            aria-describedby={offline}
            aria-disabled={disabled || undefined}
            onClick={() => !disabled && setConfirmAll(true)}
            size="sm"
            variant="danger"
          >
            {t('end_of_day.closing.cancel')}
          </Button>
        </div>
      ) : null}
      {error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
      <Dialog
        closeLabel={tCommon('actions.close')}
        description={t('end_of_day.closing.cancel_all_confirm', {
          count: remaining.length,
        })}
        onOpenChange={setConfirmAll}
        open={confirmAll}
        title={t('end_of_day.closing.cancel')}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => setConfirmAll(false)} variant="ghost">
            {tCommon('actions.cancel')}
          </Button>
          <Button
            loading={busy === 'resolve_closing'}
            onClick={() => void resolve(ids, 'cancel')}
            variant="danger"
          >
            {t('end_of_day.closing.cancel')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
