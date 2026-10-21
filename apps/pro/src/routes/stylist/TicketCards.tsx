import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Banner,
  Button,
  CodeField,
  CountdownBadge,
  Dialog,
  HoldButton,
} from '@zelate/ui';
import type { QueueTicket, ServiceOption } from '../../lib/queue-api';
import { minutesBetween, timeParts } from '../../lib/stylist';
import type { useCommand } from '../../lib/use-command';

type Command = ReturnType<typeof useCommand>;

/** Re-renders every 30 s for elapsed times (announced once a minute at most). */
function useNow(stepMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(timer);
  }, [stepMs]);
  return now;
}

function ErrorBanner({ text }: { text: string | null }) {
  return text ? (
    <Banner role="alert" tone="danger">
      {text}
    </Banner>
  ) : null;
}

export function ClientLine({
  ticket,
  me,
}: {
  ticket: QueueTicket;
  me: string;
}) {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const approach = ticket.arrived_at
    ? tCommon('approach_status.arrived')
    : ticket.eta_response === 'late'
      ? tCommon('approach_status.late', {
          minutes: ticket.declared_delay_minutes ?? 0,
        })
      : ticket.eta_response === 'on_time'
        ? tCommon('approach_status.confirmed')
        : null;
  return (
    <div className="grid gap-1">
      <h3 className="text-h3 font-semibold">{ticket.display_name}</h3>
      <p className="text-body-sm text-text-muted">
        {[
          ticket.service_name,
          tCommon('units.minutes', { count: ticket.planned_duration_minutes }),
          approach,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <p className="flex flex-wrap gap-2 text-body-sm">
        {ticket.kind === 'appointment' && ticket.scheduled_at ? (
          <span className="rounded-full bg-primary-subtle px-2 py-0.5 font-semibold">
            {tCommon('appointment.badge', {
              time: tCommon('formats.time', timeParts(ticket.scheduled_at)),
            })}
          </span>
        ) : null}
        {ticket.requested_member_id === me ? (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold">
            {t('queue.requested_you')}
          </span>
        ) : null}
      </p>
    </div>
  );
}

interface CallProps {
  ticket: QueueTicket;
  me: string;
  salonId: string;
  waitingAfter: number;
  services: ServiceOption[];
  command: Command;
  disabled: boolean;
}

/** F-S5 and F-S8 (C-04, C-05, C-06, C-09). */
export function CallCard({
  ticket,
  me,
  salonId,
  waitingAfter,
  services,
  command,
  disabled,
}: CallProps) {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const [code, setCode] = useState('');
  const [sheet, setSheet] = useState<'start' | 'take_next' | null>(null);
  const [serviceId, setServiceId] = useState(ticket.service_id ?? '');
  const [duration, setDuration] = useState(ticket.planned_duration_minutes);

  async function confirmArrival(value: string) {
    const outcome = await command.run(
      'confirm_arrival',
      { short_code: value },
      salonId,
    );
    if (!outcome.ok) setCode('');
  }

  async function start() {
    const outcome = await command.run(
      'start_service',
      {
        ticket_id: ticket.id,
        service_id: serviceId === '' ? null : serviceId,
        planned_duration_minutes: duration,
      },
      salonId,
    );
    if (outcome.ok) setSheet(null);
  }

  async function takeNext() {
    const outcome = await command.run(
      'take_next',
      { ticket_id: ticket.id },
      salonId,
    );
    if (outcome.ok) setSheet(null);
  }

  return (
    <section
      aria-labelledby="call-title"
      className="grid gap-4 rounded-xl border-2 border-primary bg-surface p-5 shadow-md"
    >
      <h2
        className="text-body-sm font-semibold uppercase text-primary"
        id="call-title"
      >
        {t('call.title')}
      </h2>
      <ClientLine me={me} ticket={ticket} />
      <div className="flex flex-wrap items-center gap-2">
        {ticket.release_due_at && !ticket.arrived_at ? (
          <CountdownBadge
            announce={(minutes) => t('call.minutes_left', { minutes })}
            deadline={Date.parse(ticket.release_due_at)}
            label={t('call.release_in')}
          />
        ) : null}
        {ticket.reminder_sent_at ? (
          <span className="text-body-sm text-text-muted">
            {t('call.reminder_sent')}
          </span>
        ) : null}
        {ticket.eta_response === 'late' && ticket.declared_delay_minutes ? (
          <span className="text-body-sm text-warning-text">
            {t('call.declared_delay', {
              minutes: ticket.declared_delay_minutes,
            })}
          </span>
        ) : null}
      </div>

      {ticket.arrived_at ? (
        <>
          <p className="font-semibold text-success-text">
            {t('arrival.arrived')}
          </p>
          <Button
            disabled={disabled}
            fullWidth
            onClick={() => {
              command.setError(null);
              setSheet('start');
            }}
            size="xl"
          >
            {t('start.open')}
          </Button>
        </>
      ) : (
        <>
          <CodeField
            charLabel={(index) => t('arrival.char_label', { index, count: 5 })}
            disabled={disabled || command.busy !== null}
            hint={t('arrival.code_hint')}
            label={t('arrival.enter_code')}
            onChange={setCode}
            onComplete={(value) => void confirmArrival(value)}
            value={code}
          />
          <ErrorBanner text={sheet === null ? command.error : null} />
          {ticket.eta_response === 'late' ? (
            <Button
              disabled={disabled}
              onClick={() => {
                command.setError(null);
                setSheet('take_next');
              }}
              size="lg"
              variant="secondary"
            >
              {t('take_next.button')}
            </Button>
          ) : null}
        </>
      )}

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(open) => setSheet(open ? 'start' : null)}
        open={sheet === 'start'}
        title={t('start.sheet_title')}
      >
        <div className="grid gap-4">
          <label className="grid gap-2">
            <span className="font-semibold text-body-sm">
              {t('start.service_label')}
            </span>
            <select
              className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
              onChange={(event) => {
                setServiceId(event.target.value);
                const picked = services.find(
                  (s) => s.id === event.target.value,
                );
                if (picked) setDuration(picked.duration_minutes);
              }}
              value={serviceId}
            >
              <option value="">{t('start.no_service')}</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-2">
            <span className="font-semibold text-body-sm" id="duration-label">
              {t('start.duration_label')}
            </span>
            <div
              aria-labelledby="duration-label"
              className="flex items-center gap-3"
              role="group"
            >
              <Button
                aria-label={t('start.duration_decrease')}
                disabled={duration <= 5}
                onClick={() => setDuration((d) => Math.max(5, d - 5))}
                size="lg"
                variant="secondary"
              >
                {t('start.decrease_short')}
              </Button>
              <output
                aria-live="polite"
                className="min-w-20 text-center text-h3 tabular-nums"
              >
                {tCommon('units.minutes', { count: duration })}
              </output>
              <Button
                aria-label={t('start.duration_increase')}
                disabled={duration >= 240}
                onClick={() => setDuration((d) => Math.min(240, d + 5))}
                size="lg"
                variant="secondary"
              >
                {t('start.increase_short')}
              </Button>
            </div>
          </div>
          <ErrorBanner text={command.error} />
          <Button
            disabled={disabled}
            fullWidth
            loading={command.busy === 'start_service'}
            onClick={() => void start()}
            size="xl"
          >
            {t('start.confirm')}
          </Button>
        </div>
      </Dialog>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(open) => setSheet(open ? 'take_next' : null)}
        open={sheet === 'take_next'}
        title={t('take_next.button')}
      >
        <div className="grid gap-4">
          <p>
            {t('take_next.confirm', {
              first_name: ticket.display_name,
              count: Math.max(1, Math.min(2, waitingAfter)),
            })}
          </p>
          <ErrorBanner text={command.error} />
          <Button
            disabled={disabled}
            fullWidth
            loading={command.busy === 'take_next'}
            onClick={() => void takeNext()}
            size="xl"
          >
            {t('take_next.button')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}

interface ServiceProps {
  ticket: QueueTicket;
  me: string;
  salonId: string;
  command: Command;
  disabled: boolean;
}

/** F-S7 (C-07, C-08). */
export function ServiceCard({
  ticket,
  me,
  salonId,
  command,
  disabled,
}: ServiceProps) {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const now = useNow();
  const [confirm, setConfirm] = useState(false);
  const started = ticket.started_at ?? new Date(now).toISOString();
  const end = new Date(
    Date.parse(started) + ticket.planned_duration_minutes * 60_000,
  );

  async function complete() {
    const outcome = await command.run(
      'complete_service',
      { ticket_id: ticket.id },
      salonId,
    );
    if (outcome.ok) setConfirm(false);
  }

  return (
    <section
      aria-labelledby="service-title"
      className="grid gap-4 rounded-xl border-2 border-success bg-surface p-5 shadow-md"
    >
      <h2
        className="text-body-sm font-semibold uppercase text-success-text"
        id="service-title"
      >
        {t('service.in_progress')}
      </h2>
      <ClientLine me={me} ticket={ticket} />
      <p className="text-body tabular-nums">
        {t('service.elapsed_planned', {
          elapsed_minutes: minutesBetween(started, now),
          planned_minutes: ticket.planned_duration_minutes,
        })}
        {' · '}
        {t('service.estimated_end', {
          time: tCommon('formats.time', timeParts(end.toISOString())),
        })}
      </p>
      <div className="grid grid-cols-4 gap-2">
        {([5, 15, 30, 45] as const).map((minutes) => (
          <Button
            aria-label={t('service.adjust_label', { minutes })}
            disabled={disabled || command.busy !== null}
            key={minutes}
            onClick={() =>
              void command.run(
                'adjust_duration',
                { ticket_id: ticket.id, delta_minutes: minutes },
                salonId,
              )
            }
            size="xl"
            variant="secondary"
          >
            {t(`service.adjust_${minutes}`)}
          </Button>
        ))}
      </div>
      <ErrorBanner text={confirm ? null : command.error} />
      <HoldButton
        disabled={disabled || command.busy !== null}
        hint={t('service.complete_hint')}
        onHold={() => void complete()}
        onRequestConfirm={() => setConfirm(true)}
      >
        {t('service.complete')}
      </HoldButton>
      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={setConfirm}
        open={confirm}
        title={t('service.complete_confirm', {
          first_name: ticket.display_name,
        })}
      >
        <div className="grid gap-4">
          <ErrorBanner text={command.error} />
          <Button
            disabled={disabled}
            fullWidth
            loading={command.busy === 'complete_service'}
            onClick={() => void complete()}
            size="xl"
          >
            {t('service.complete')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
