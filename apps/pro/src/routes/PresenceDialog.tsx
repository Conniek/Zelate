import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { parisInstant } from '@zelate/queue-service/time';
import { Banner, Button, Dialog, TextField } from '@zelate/ui';
import { previewPresence, ticketStylistId } from '../lib/board-api';
import type {
  BoardStylist,
  BoardTicket,
  PresenceChange,
} from '../lib/board-api';
import { timeParts, todayInParis } from '../lib/stylist';
import { useCommand } from '../lib/use-command';

export type PresenceAction = 'absent' | 'late' | 'leaving_early' | 'break';

const BREAK_TYPES = ['meal', 'short', 'unexpected'] as const;
const BREAK_MINUTES = [5, 10, 15, 30, 45, 60] as const;

const TIME_FIELD = 'presence-time';

interface Props {
  announce: (message: string) => void;
  action: PresenceAction;
  /** Seen in the preview key: the impact is read again when the queue moved. */
  queueVersion: number;
  salonId: string;
  onClose: () => void;
  stylist: BoardStylist;
  tickets: BoardTicket[];
}

/** The change a form describes, or null while it is incomplete. */
function buildChange(
  action: PresenceAction,
  memberId: string,
  time: string,
  breakType: (typeof BREAK_TYPES)[number],
  breakMinutes: number,
): PresenceChange | null {
  const instant = /^\d{2}:\d{2}$/.test(time)
    ? new Date(parisInstant(todayInParis(), time)).toISOString()
    : null;
  const base = {
    member_id: memberId,
    break_type: null,
    until: null,
    shift_end_at: null,
  };
  switch (action) {
    case 'absent':
      return { ...base, status: 'absent' };
    case 'late':
      return instant && Date.parse(instant) > Date.now()
        ? { ...base, status: 'late', until: instant }
        : null;
    case 'leaving_early':
      return instant && Date.parse(instant) > Date.now()
        ? { ...base, status: 'off_duty', shift_end_at: instant }
        : null;
    case 'break':
      return {
        ...base,
        status: 'on_break',
        break_type: breakType,
        until: new Date(Date.now() + breakMinutes * 60_000).toISOString(),
      };
  }
}

/** F-M8 (S-11): the form, the impact preview, then « Confirmer » (`set_presence`). */
export function PresenceDialog({
  action,
  announce,
  onClose,
  queueVersion,
  salonId,
  stylist,
  tickets,
}: Props) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const { busy, error, run } = useCommand();
  const [time, setTime] = useState('');
  const [breakType, setBreakType] =
    useState<(typeof BREAK_TYPES)[number]>('short');
  const [breakMinutes, setBreakMinutes] = useState<number>(15);
  const [timeError, setTimeError] = useState<string | null>(null);

  const change = buildChange(
    action,
    stylist.member_id,
    time,
    breakType,
    breakMinutes,
  );
  // A break is previewed once: the instant moves every second.
  const previewKey = change
    ? [change.status, change.break_type, time, breakMinutes]
    : null;
  // Never reused: a preview read before the queue moved would be wrong.
  const preview = useQuery({
    queryKey: ['presence-preview', stylist.member_id, previewKey, queueVersion],
    queryFn: () => previewPresence(change!),
    enabled: change !== null,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });
  const names = new Map(tickets.map((ticket) => [ticket.id, ticket]));
  const impact = preview.data ?? [];
  const toConfirm = impact.filter((item) => item.choice_required).length;
  const needsTime = action === 'late' || action === 'leaving_early';
  const me = stylist.member_id;

  // F-M8 lines the engine's answer alone does not spell out (S-11).
  const reassigned = impact.filter(
    (item) =>
      item.kind === 'queue' &&
      item.member_before === me &&
      item.member_after !== null &&
      item.member_after !== me &&
      !item.choice_required,
  ).length;
  const calledBack = impact.find(
    (item) =>
      item.status_before === 'called' && item.status_after === 'waiting',
  );
  const inService =
    action === 'absent'
      ? tickets.find(
          (x) => x.status === 'in_service' && x.assigned_member_id === me,
        )
      : undefined;
  const movedByEngine = new Set(
    impact.filter((i) => i.member_after !== me).map((i) => i.ticket_id),
  );
  // Appointments are not given to another stylist by the engine: the manager does it.
  const appointmentsToReassign = change
    ? tickets.filter((x) => {
        if (
          x.kind !== 'appointment' ||
          x.status !== 'waiting' ||
          ticketStylistId(x) !== me ||
          !x.scheduled_at ||
          movedByEngine.has(x.id)
        ) {
          return false;
        }
        const at = Date.parse(x.scheduled_at);
        if (change.status === 'absent') return true;
        if (change.status === 'off_duty') {
          return (
            change.shift_end_at !== null &&
            at >= Date.parse(change.shift_end_at)
          );
        }
        return change.until !== null && at < Date.parse(change.until);
      }).length
    : 0;
  const nothing =
    impact.length === 0 &&
    inService === undefined &&
    appointmentsToReassign === 0;

  async function confirm() {
    if (!change) {
      if (needsTime) {
        setTimeError(
          time === ''
            ? tErrors('validation.required')
            : t('presence.form.time_future'),
        );
        document.getElementById(TIME_FIELD)?.focus();
      }
      return;
    }
    if (!preview.isSuccess) return;
    const outcome = await run('set_presence', { ...change }, salonId);
    if (outcome.ok) {
      announce(
        t('presence.done', {
          stylist_name: stylist.first_name,
          status: t(`presence.menu.${action}`),
        }),
      );
      onClose();
    }
  }

  return (
    <Dialog
      closeLabel={tCommon('actions.close')}
      onOpenChange={(open) => !open && onClose()}
      open
      title={t(`presence.form.title.${action}`, {
        stylist_name: stylist.first_name,
      })}
    >
      <div className="grid gap-4">
        {needsTime ? (
          <TextField
            error={timeError ?? undefined}
            id={TIME_FIELD}
            label={t(
              action === 'late'
                ? 'presence.form.expected_back_at'
                : 'presence.form.shift_end_at',
            )}
            onChange={(e) => {
              setTimeError(null);
              setTime(e.target.value);
            }}
            step={300}
            type="time"
            value={time}
          />
        ) : null}
        {action === 'break' ? (
          <>
            <fieldset className="grid gap-2">
              <legend className="font-semibold text-body-sm">
                {t('presence.form.break_type')}
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
                {t('presence.form.break_duration')}
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
          </>
        ) : null}

        <section className="grid gap-2">
          <h3 className="font-semibold">{t('presence.impact.title')}</h3>
          {/* Only the result is read out, once it is known. */}
          <p aria-live="polite" className="sr-only">
            {change !== null && preview.isSuccess
              ? t('presence.impact.summary', {
                  count: nothing ? 0 : Math.max(impact.length, 1),
                })
              : ''}
          </p>
          {change === null ? null : preview.isPending ? (
            <p className="text-body-sm text-text-muted">…</p>
          ) : preview.isError ? (
            <Banner role="alert" tone="danger">
              {tErrors('generic.unexpected')}
            </Banner>
          ) : nothing ? (
            <p className="text-body-sm">{t('presence.impact.none')}</p>
          ) : (
            <>
              {calledBack ? (
                <p className="text-body-sm">
                  {t('presence.impact.called_back_to_top', {
                    first_name:
                      names.get(calledBack.ticket_id)?.display_name ??
                      calledBack.short_code,
                  })}
                </p>
              ) : null}
              {inService ? (
                <p className="text-body-sm">
                  {t('presence.impact.service_to_complete', {
                    first_name: inService.display_name,
                  })}
                </p>
              ) : null}
              {reassigned > 0 ? (
                <p className="text-body-sm">
                  {t('presence.impact.reassigned', { count: reassigned })}
                </p>
              ) : null}
              {appointmentsToReassign > 0 ? (
                <p className="text-body-sm">
                  {t('presence.impact.appointments_to_reassign', {
                    count: appointmentsToReassign,
                  })}
                </p>
              ) : null}
              <ul className="grid gap-1 text-body-sm">
                {impact.map((item) => {
                  const ticket = names.get(item.ticket_id);
                  const old = item.estimated_start_at_before;
                  const next = item.estimated_start_at_after;
                  return (
                    <li key={item.ticket_id}>
                      <span className="font-semibold">
                        {ticket?.display_name ?? item.short_code}
                      </span>
                      {old && next && old !== next
                        ? ` : ${t('presence.impact.new_time', {
                            new_time: tCommon('formats.time', timeParts(next)),
                            old_time: tCommon('formats.time', timeParts(old)),
                          })}`
                        : null}
                    </li>
                  );
                })}
              </ul>
              {toConfirm > 0 ? (
                <p className="text-body-sm">
                  {t('presence.impact.client_to_confirm', { count: toConfirm })}
                </p>
              ) : null}
            </>
          )}
          <p className="text-body-sm text-text-muted">
            {t('presence.impact.nobody_notified_yet')}
          </p>
        </section>

        {error ? (
          <Banner role="alert" tone="danger">
            {error}
          </Banner>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} variant="secondary">
            {tCommon('actions.cancel')}
          </Button>
          <Button
            aria-disabled={(change !== null && !preview.isSuccess) || undefined}
            loading={busy !== null}
            onClick={() => void confirm()}
          >
            {t('presence.confirm')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
