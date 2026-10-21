import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { parisInstant } from '@zelate/queue-service/time';
import { Banner, Button, Dialog, TextField } from '@zelate/ui';
import type { QueueTicket, StylistContext } from '../../lib/queue-api';
import { timeParts, todayInParis } from '../../lib/stylist';
import type { useCommand } from '../../lib/use-command';

const BREAK_TYPES = ['meal', 'short', 'unexpected'] as const;
const BREAK_MINUTES = [5, 10, 15, 30, 45, 60] as const;

interface Props {
  ctx: StylistContext & { member_id: string; salon_id: string };
  command: ReturnType<typeof useCommand>;
  disabled: boolean;
  /** Waiting clients who asked for me, and my remaining appointments (F-S3). */
  requestedMe: QueueTicket[];
  appointments: QueueTicket[];
}

/** F-S3 · always visible at the top of `/stylist/queue` (C-02). */
export function PresenceBar({
  ctx,
  command,
  disabled,
  requestedMe,
  appointments,
}: Props) {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [sheet, setSheet] = useState<'break' | 'end' | null>(null);
  const [breakType, setBreakType] =
    useState<(typeof BREAK_TYPES)[number]>('short');
  const [breakMinutes, setBreakMinutes] = useState<number>(15);
  const [endLater, setEndLater] = useState(false);
  const [endTime, setEndTime] = useState('');

  const presence = ctx.presence ?? null;
  const status = presence?.status ?? 'offline';
  const time = (iso: string) => tCommon('formats.time', timeParts(iso));

  async function setPresence(payload: Record<string, unknown>) {
    const outcome = await command.run(
      'set_presence',
      { member_id: ctx.member_id, ...payload },
      ctx.salon_id,
    );
    if (!outcome.ok) return;
    setSheet(null);
    // F-S9: the summary opens after « Fin de journée ».
    if (payload.status === 'off_duty') void navigate('/stylist/summary');
  }

  const shiftEnd =
    endLater && /^\d{2}:\d{2}$/.test(endTime)
      ? new Date(parisInstant(todayInParis(), endTime)).toISOString()
      : new Date().toISOString();

  return (
    <section
      aria-labelledby="presence-title"
      className="grid gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="sr-only" id="presence-title">
        {tCommon(`presence_status.${status}` as 'presence_status.available')}
      </h2>
      <p className="text-body font-semibold" aria-live="polite">
        {t('presence.current', {
          status: tCommon(
            `presence_status.${status}` as 'presence_status.available',
          ),
        })}
        {status === 'on_break' && presence?.expected_back_at ? (
          <span className="ml-2 font-normal text-text-muted">
            {t('presence.break_until', {
              time: time(presence.expected_back_at),
            })}
          </span>
        ) : null}
        {status === 'off_duty' && presence?.shift_end_at ? (
          <span className="ml-2 font-normal text-text-muted">
            {t('presence.end_of_day_until', {
              time: time(presence.shift_end_at),
            })}
          </span>
        ) : null}
      </p>
      <div className="flex flex-wrap gap-2">
        {status === 'on_break' ? (
          <Button
            disabled={disabled}
            loading={command.busy === 'set_presence'}
            onClick={() => void setPresence({ status: 'available' })}
            size="lg"
          >
            {t('presence.resume')}
          </Button>
        ) : status !== 'available' && status !== 'in_service' ? (
          <Button
            disabled={disabled}
            loading={command.busy === 'set_presence'}
            onClick={() => void setPresence({ status: 'available' })}
            size="lg"
          >
            {t('presence.ready')}
          </Button>
        ) : null}
        {status === 'available' ? (
          <Button
            disabled={disabled}
            onClick={() => setSheet('break')}
            size="lg"
            variant="secondary"
          >
            {t('presence.break')}
          </Button>
        ) : null}
        {status !== 'off_duty' ? (
          <Button
            disabled={disabled}
            onClick={() => setSheet('end')}
            size="lg"
            variant="secondary"
          >
            {t('presence.end_of_day')}
          </Button>
        ) : null}
      </div>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(open) => setSheet(open ? 'break' : null)}
        open={sheet === 'break'}
        title={t('presence.break_sheet_title')}
      >
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="font-semibold text-body-sm">
              {t('presence.break_type_label')}
            </legend>
            {BREAK_TYPES.map((type) => (
              <label className="flex min-h-11 items-center gap-3" key={type}>
                <input
                  checked={breakType === type}
                  name="break-type"
                  onChange={() => setBreakType(type)}
                  type="radio"
                />
                {tCommon(`break_type.${type}`)}
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2">
            <legend className="font-semibold text-body-sm">
              {t('presence.break_duration_label')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {BREAK_MINUTES.map((minutes) => (
                <label
                  className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3"
                  key={minutes}
                >
                  <input
                    checked={breakMinutes === minutes}
                    name="break-minutes"
                    onChange={() => setBreakMinutes(minutes)}
                    type="radio"
                  />
                  {tCommon('units.minutes', { count: minutes })}
                </label>
              ))}
            </div>
          </fieldset>
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          <Button
            disabled={disabled}
            fullWidth
            loading={command.busy === 'set_presence'}
            onClick={() =>
              void setPresence({
                status: 'on_break',
                break_type: breakType,
                until: new Date(
                  Date.now() + breakMinutes * 60_000,
                ).toISOString(),
              })
            }
            size="xl"
          >
            {t('presence.break_start')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(open) => setSheet(open ? 'end' : null)}
        open={sheet === 'end'}
        title={t('presence.end_of_day')}
      >
        <div className="grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="font-semibold text-body-sm">
              {t('presence.end_of_day_time_label')}
            </legend>
            <label className="flex min-h-11 items-center gap-3">
              <input
                checked={!endLater}
                name="end"
                onChange={() => setEndLater(false)}
                type="radio"
              />
              {t('presence.end_of_day_now')}
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input
                checked={endLater}
                name="end"
                onChange={() => setEndLater(true)}
                type="radio"
              />
              {t('presence.end_of_day_later')}
            </label>
            {endLater ? (
              <TextField
                label={t('presence.end_of_day_time_label')}
                onChange={(event) => setEndTime(event.target.value)}
                step={300}
                type="time"
                value={endTime}
              />
            ) : null}
          </fieldset>
          <p className="text-body">
            {t('presence.end_of_day_confirm', {
              count: requestedMe.length,
              first_names: requestedMe.map((c) => c.display_name).join(', '),
            })}
          </p>
          {appointments.length > 0 ? (
            <p className="text-body">
              {t('presence.end_of_day_appointments', {
                count: appointments.length,
                first_names: appointments.map((c) => c.display_name).join(', '),
              })}
            </p>
          ) : null}
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          <Button
            disabled={disabled || (endLater && endTime === '')}
            fullWidth
            loading={command.busy === 'set_presence'}
            onClick={() =>
              void setPresence({ status: 'off_duty', shift_end_at: shiftEnd })
            }
            size="xl"
          >
            {t('presence.end_of_day_submit')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
