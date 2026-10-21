import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';
import { parisInstant } from '@zelate/queue-service/time';
import {
  Banner,
  Button,
  Dialog,
  PhoneField,
  Skeleton,
  TextField,
} from '@zelate/ui';
import { loadServiceOptions } from '../../lib/queue-api';
import type { QueueTicket } from '../../lib/queue-api';
import {
  timeParts,
  todayInParis,
  usePageTitle,
  useStylistQueue,
} from '../../lib/stylist';
import { useCommand } from '../../lib/use-command';
import { PendingAppointment, ReasonPicker } from './PendingAppointment';
import type { RemovalReason } from './PendingAppointment';
import type { StylistOutlet } from './StylistLayout';

interface Form {
  ticket: QueueTicket | null;
  firstName: string;
  time: string;
  serviceId: string;
  phone: string;
}

const EMPTY: Form = {
  ticket: null,
  firstName: '',
  time: '',
  serviceId: '',
  phone: '',
};

function hhmm(iso: string): string {
  const { hours, minutes } = timeParts(iso);
  return `${hours.padStart(2, '0')}:${minutes}`;
}

/** F-S10 · `/stylist/appointments` (C-11). */
export function StylistAppointmentsPage() {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const { ctx, lost, live } = useOutletContext<StylistOutlet>();
  usePageTitle(t('appointments.title'));
  const command = useCommand();
  const queue = useStylistQueue(live);
  const services = useQuery({
    queryKey: ['services', ctx.salon_id],
    queryFn: () => loadServiceOptions(ctx.salon_id),
    staleTime: 5 * 60_000,
  });
  const [form, setForm] = useState<Form | null>(null);
  const [cancelling, setCancelling] = useState<QueueTicket | null>(null);
  const [reason, setReason] = useState<RemovalReason>('other');
  const [warning, setWarning] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    time?: string;
  }>({});

  if (!queue.data) {
    return (
      <main className="p-4" aria-busy="true">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }
  const { appointments, pending_appointments: pending } = queue.data;
  const time = (iso: string) => tCommon('formats.time', timeParts(iso));
  const now = Date.now();

  async function save() {
    if (!form) return;
    // Each error next to its field (WCAG 3.3.1).
    const errors = {
      ...(form.firstName.trim() === ''
        ? { firstName: tErrors('validation.required') }
        : {}),
      ...(!/^\d{2}:\d{2}$/.test(form.time)
        ? { time: t('appointments.time_required') }
        : {}),
    };
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const scheduledAt = new Date(
      parisInstant(todayInParis(), form.time),
    ).toISOString();
    const phone = form.phone === '' ? undefined : `0${form.phone}`;
    const outcome = form.ticket
      ? await command.run(
          'update_appointment',
          {
            ticket_id: form.ticket.id,
            first_name: form.firstName,
            scheduled_at: scheduledAt,
            service_id: form.serviceId === '' ? null : form.serviceId,
            ...(phone ? { phone } : {}),
          },
          ctx.salon_id,
        )
      : await command.run(
          'create_appointment',
          {
            first_name: form.firstName,
            scheduled_at: scheduledAt,
            member_id: ctx.member_id,
            ...(form.serviceId ? { service_id: form.serviceId } : {}),
            ...(phone ? { phone } : {}),
          },
          ctx.salon_id,
        );
    if (!outcome.ok) return;
    const warnings = outcome.data.warnings;
    setWarning(Array.isArray(warnings) && warnings.includes('stylist_absent'));
    setForm(null);
  }

  async function cancel() {
    if (!cancelling) return;
    const outcome = await command.run(
      'cancel_appointment',
      { ticket_id: cancelling.id, reason_code: reason },
      ctx.salon_id,
    );
    if (outcome.ok) setCancelling(null);
  }

  return (
    <main className="grid gap-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h2">{t('appointments.title')}</h1>
        <Link className="text-link underline" to="/stylist/queue">
          {t('appointments.back_to_queue')}
        </Link>
      </div>
      {warning ? (
        <Banner tone="warning">
          {t('appointments.warning_stylist_absent')}
        </Banner>
      ) : null}
      {pending.map((ticket) => (
        <PendingAppointment
          appointments={appointments}
          command={command}
          disabled={lost}
          key={ticket.id}
          salonId={ctx.salon_id}
          ticket={ticket}
        />
      ))}
      {appointments.length === 0 && pending.length === 0 ? (
        <p className="text-text-muted">{t('appointments.empty')}</p>
      ) : null}
      <ul className="grid gap-2">
        {appointments.map((a) => {
          const late =
            a.status === 'waiting' &&
            a.scheduled_at &&
            Date.parse(a.scheduled_at) < now
              ? Math.floor((now - Date.parse(a.scheduled_at)) / 60_000)
              : 0;
          return (
            <li
              className="grid gap-2 rounded-lg border border-border p-3"
              key={a.id}
            >
              <p className="font-semibold">
                {a.scheduled_at ? time(a.scheduled_at) : ''} · {a.display_name}
              </p>
              <p className="text-body-sm text-text-muted">
                {[
                  a.service_name,
                  a.status === 'waiting'
                    ? late >= 10
                      ? t('appointments.status.late', { minutes: late })
                      : t('appointments.status.upcoming')
                    : tCommon(
                        `ticket_status.${a.status}` as 'ticket_status.called',
                      ),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {a.status === 'waiting' ? (
                <div className="flex gap-2">
                  <Button
                    aria-disabled={lost || undefined}
                    onClick={() => {
                      command.setError(null);
                      setFieldErrors({});
                      setForm({
                        ticket: a,
                        firstName: a.display_name,
                        time: a.scheduled_at ? hhmm(a.scheduled_at) : '',
                        serviceId: a.service_id ?? '',
                        phone: '',
                      });
                    }}
                    size="xl"
                    variant="secondary"
                  >
                    {t('appointments.edit')}
                  </Button>
                  <Button
                    aria-disabled={lost || undefined}
                    onClick={() => {
                      command.setError(null);
                      setCancelling(a);
                    }}
                    size="xl"
                    variant="ghost"
                  >
                    {t('appointments.cancel')}
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Button
        aria-disabled={lost || undefined}
        onClick={() => {
          command.setError(null);
          setFieldErrors({});
          setWarning(false);
          setForm(EMPTY);
        }}
        size="xl"
      >
        {t('appointments.new')}
      </Button>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(open) => !open && setForm(null)}
        open={form !== null}
        title={
          form?.ticket
            ? t('appointments.form.title_edit')
            : t('appointments.form.title_new')
        }
      >
        {form ? (
          <div className="grid gap-4">
            <TextField
              error={fieldErrors.firstName}
              label={t('appointments.form.first_name')}
              maxLength={30}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              value={form.firstName}
            />
            <TextField
              error={fieldErrors.time}
              label={t('appointments.form.time')}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              step={300}
              type="time"
              value={form.time}
            />
            <label className="grid gap-2">
              <span className="font-semibold text-body-sm">
                {t('appointments.form.service')}
              </span>
              <select
                className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
                onChange={(e) =>
                  setForm({ ...form, serviceId: e.target.value })
                }
                value={form.serviceId}
              >
                <option value="">{t('start.no_service')}</option>
                {(services.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <PhoneField
              helpText={t('appointments.form.phone_hint')}
              label={t('appointments.form.phone')}
              onChange={(digits) => setForm({ ...form, phone: digits })}
              prefix="+33"
              value={form.phone}
            />
            {command.error ? (
              <Banner role="alert" tone="danger">
                {command.error}
              </Banner>
            ) : null}
            <Button
              aria-disabled={lost || undefined}
              fullWidth
              loading={command.busy !== null}
              onClick={() => void save()}
              size="xl"
            >
              {form.ticket
                ? t('appointments.form.save')
                : t('appointments.form.submit')}
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(open) => !open && setCancelling(null)}
        open={cancelling !== null}
        title={t('appointments.cancel_submit')}
      >
        {cancelling ? (
          <div className="grid gap-4">
            <p>
              {t('appointments.cancel_confirm', {
                first_name: cancelling.display_name,
                time: cancelling.scheduled_at
                  ? time(cancelling.scheduled_at)
                  : '',
              })}
            </p>
            <ReasonPicker onChange={setReason} value={reason} />
            {command.error ? (
              <Banner role="alert" tone="danger">
                {command.error}
              </Banner>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setCancelling(null)} variant="ghost">
                {t('appointments.cancel_keep')}
              </Button>
              <Button
                aria-disabled={lost || undefined}
                loading={command.busy === 'cancel_appointment'}
                onClick={() => void cancel()}
                variant="danger"
              >
                {t('appointments.cancel_submit')}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </main>
  );
}
