import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useOutletContext } from 'react-router';
import { parisInstant } from '@zelate/queue-service/time';
import {
  Banner,
  Button,
  ConnectionBanner,
  Dialog,
  PhoneField,
  Skeleton,
  TextField,
} from '@zelate/ui';
import { boardColumns, ticketStylistId } from '../lib/board-api';
import type { BoardTicket } from '../lib/board-api';
import { loadServiceOptions } from '../lib/queue-api';
import type { SetupSalon } from '../lib/setup-api';
import { timeParts, todayInParis } from '../lib/stylist';
import { useBoard } from '../lib/use-board';
import { useCommand } from '../lib/use-command';
import { REMOVAL_REASONS } from './stylist/PendingAppointment';
import type { RemovalReason } from './stylist/PendingAppointment';

interface Form {
  ticket: BoardTicket | null;
  firstName: string;
  time: string;
  memberId: string;
  serviceId: string;
  phone: string;
}

const LATE_AFTER_MINUTES = 10;
const FIELD_IDS = {
  firstName: 'appointment-first-name',
  time: 'appointment-time',
  memberId: 'appointment-stylist',
} as const;

function hhmm(iso: string): string {
  const { hours, minutes } = timeParts(iso);
  return `${hours.padStart(2, '0')}:${minutes}`;
}

function ReasonPicker({
  onChange,
  value,
}: {
  onChange: (reason: RemovalReason) => void;
  value: RemovalReason;
}) {
  const { t } = useTranslation('pro-manager');
  return (
    <fieldset className="grid gap-2">
      <legend className="font-semibold text-body-sm">
        {t('remove.reason.label')}
      </legend>
      {REMOVAL_REASONS.map((reason) => (
        <label className="flex min-h-11 items-center gap-3" key={reason}>
          <input
            checked={value === reason}
            name="appointment-reason"
            onChange={() => onChange(reason)}
            type="radio"
          />
          {t(`remove.reason.${reason}`)}
        </label>
      ))}
    </fieldset>
  );
}

/** F-M13 · `/dashboard/appointments`: the appointments of the day (S-18, S-19). */
export function AppointmentsPage() {
  const salon = useOutletContext<SetupSalon>();
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const command = useCommand();
  const { board, lost } = useBoard(salon.id);
  const [message, setMessage] = useState('');
  const announce = useCallback((text: string) => {
    setMessage('');
    window.setTimeout(() => setMessage(text), 50);
  }, []);
  useEffect(() => {
    document.title = `${t('appointments.title')} – ${tCommon('brand.pro_name')}`;
  }, [t, tCommon]);
  const services = useQuery({
    queryKey: ['service-options', salon.id],
    queryFn: () => loadServiceOptions(salon.id),
  });
  const [form, setForm] = useState<Form | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    time?: string;
    memberId?: string;
  }>({});
  const [warning, setWarning] = useState(false);
  const [cancelling, setCancelling] = useState<BoardTicket | null>(null);
  const [rejecting, setRejecting] = useState<BoardTicket | null>(null);
  const [reason, setReason] = useState<RemovalReason>('other');
  // Stylist chosen on a pending card when the client named nobody (E29).
  const [chosen, setChosen] = useState<Record<string, string>>({});

  if (!board.data) {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-5xl px-5 py-10">
        <Skeleton className="h-10 w-full" />
      </main>
    );
  }

  const columns = boardColumns(board.data.stylists);
  const stylistName = (ticket: BoardTicket) =>
    columns.find((c) => c.member_id === ticketStylistId(ticket))?.first_name;
  const all = board.data.tickets.filter(
    (ticket) => ticket.kind === 'appointment',
  );
  const pending = all.filter((x) => x.status === 'pending_confirmation');
  const planned = all
    .filter((x) => x.status !== 'pending_confirmation')
    .sort((a, b) => (a.scheduled_at ?? '').localeCompare(b.scheduled_at ?? ''));
  const time = (iso: string) => tCommon('formats.time', timeParts(iso));
  const serviceNames = new Map(
    (services.data ?? []).map((service) => [service.id, service.name]),
  );
  const now = Date.now();

  function open(next: Form) {
    command.setError(null);
    setFieldErrors({});
    setWarning(false);
    setForm(next);
  }

  async function save() {
    if (!form) return;
    const errors = {
      ...(form.firstName.trim() === ''
        ? { firstName: tErrors('validation.required') }
        : {}),
      ...(!/^\d{2}:\d{2}$/.test(form.time)
        ? { time: t('appointments.form.time_hint') }
        : {}),
      ...(form.memberId === ''
        ? { memberId: tErrors('validation.required') }
        : {}),
    };
    setFieldErrors(errors);
    const firstInvalid = (['firstName', 'time', 'memberId'] as const).find(
      (key) => errors[key] !== undefined,
    );
    if (firstInvalid) {
      document.getElementById(FIELD_IDS[firstInvalid])?.focus();
      return;
    }
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
            member_id: form.memberId,
            service_id: form.serviceId === '' ? null : form.serviceId,
            ...(phone ? { phone } : {}),
          },
          salon.id,
        )
      : await command.run(
          'create_appointment',
          {
            first_name: form.firstName,
            scheduled_at: scheduledAt,
            member_id: form.memberId,
            ...(form.serviceId ? { service_id: form.serviceId } : {}),
            ...(phone ? { phone } : {}),
          },
          salon.id,
        );
    if (!outcome.ok) return;
    const warnings = outcome.data.warnings;
    setWarning(Array.isArray(warnings) && warnings.includes('stylist_absent'));
    announce(
      t(
        form.ticket ? 'appointments.done.updated' : 'appointments.done.created',
        {
          first_name: form.firstName.trim(),
        },
      ),
    );
    setForm(null);
  }

  async function cancel() {
    if (!cancelling) return;
    const outcome = await command.run(
      'cancel_appointment',
      { ticket_id: cancelling.id, reason_code: reason },
      salon.id,
    );
    if (outcome.ok) {
      announce(
        t('appointments.done.cancelled', {
          first_name: cancelling.display_name,
        }),
      );
      setCancelling(null);
    }
  }

  async function decide(ticket: BoardTicket, payload: Record<string, unknown>) {
    if (lost || command.busy !== null) return;
    const outcome = await command.run(
      'confirm_appointment',
      { ticket_id: ticket.id, ...payload },
      salon.id,
    );
    if (!outcome.ok) return;
    announce(
      t(
        payload.decision === 'reject'
          ? 'appointments.done.rejected'
          : 'appointments.done.confirmed',
        { first_name: ticket.display_name },
      ),
    );
    setRejecting(null);
  }

  function openReason(ticket: BoardTicket, kind: 'cancel' | 'reject') {
    if (lost) return;
    command.setError(null);
    // Never the reason of the previous dialog: it is sent to the client.
    setReason('other');
    if (kind === 'cancel') setCancelling(ticket);
    else setRejecting(ticket);
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-h1">{t('appointments.title')}</h1>
          <Link
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-link"
            to="/dashboard"
          >
            {t('appointments.back_to_board')}
          </Link>
        </div>
        <ConnectionBanner lost={lost} lostLabel={t('board.offline_banner')} />
        {lost ? (
          <p className="sr-only" id="board-offline">
            {t('board.offline_banner')}
          </p>
        ) : null}
        <p aria-live="polite" className="sr-only" role="status">
          {message}
        </p>
        {warning ? (
          <Banner tone="warning">
            {t('appointments.warning_stylist_absent')}
          </Banner>
        ) : null}
        <div>
          <Button
            aria-describedby={lost ? 'board-offline' : undefined}
            aria-disabled={lost || undefined}
            onClick={() =>
              !lost &&
              open({
                ticket: null,
                firstName: '',
                time: '',
                memberId: columns[0]?.member_id ?? '',
                serviceId: '',
                phone: '',
              })
            }
          >
            {t('appointments.new')}
          </Button>
        </div>
      </header>

      {pending.length > 0 ? (
        <section aria-labelledby="pending-title" className="grid gap-3">
          <h2 className="text-h2" id="pending-title">
            {t('appointments.pending.title')}
          </h2>
          {pending.map((ticket) => {
            // Only an appointment still to come can absorb this one (engine: invalid_merge_target).
            const twin = planned.find(
              (x) =>
                x.status === 'waiting' &&
                x.scheduled_at === ticket.scheduled_at &&
                ticketStylistId(x) === ticketStylistId(ticket),
            );
            const name = stylistName(ticket);
            const needsStylist = ticket.requested_member_id === null;
            const memberId = chosen[ticket.id] ?? columns[0]?.member_id ?? '';
            const confirmPayload = {
              decision: 'confirm',
              ...(needsStylist && memberId !== ''
                ? { member_id: memberId }
                : {}),
            };
            return (
              <article
                className="grid gap-2 rounded-xl border border-warning bg-warning-subtle p-4"
                key={ticket.id}
              >
                <p className="font-semibold">{ticket.display_name}</p>
                <p className="text-body-sm">
                  {[
                    ticket.scheduled_at
                      ? t('appointments.pending.announced_time', {
                          time: time(ticket.scheduled_at),
                        })
                      : null,
                    name ?? t('appointments.pending.unknown_stylist'),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {twin ? (
                  <p className="text-body-sm">
                    {t('appointments.pending.merge_suggestion', {
                      first_name: twin.display_name,
                      stylist_name: stylistName(twin) ?? '',
                      time: twin.scheduled_at ? time(twin.scheduled_at) : '',
                    })}
                  </p>
                ) : null}
                {needsStylist ? (
                  <label className="grid gap-2">
                    <span className="font-semibold text-body-sm">
                      {t('appointments.form.stylist')}
                    </span>
                    <select
                      className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
                      onChange={(e) =>
                        setChosen({ ...chosen, [ticket.id]: e.target.value })
                      }
                      value={memberId}
                    >
                      {columns.map((c) => (
                        <option key={c.member_id} value={c.member_id}>
                          {c.first_name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {twin ? (
                    <Button
                      aria-describedby={lost ? 'board-offline' : undefined}
                      aria-disabled={lost || undefined}
                      loading={command.busy === 'confirm_appointment'}
                      onClick={() =>
                        void decide(ticket, {
                          ...confirmPayload,
                          merge_into_ticket_id: twin.id,
                        })
                      }
                      variant="success"
                    >
                      {t('appointments.pending.confirm_merge')}
                    </Button>
                  ) : null}
                  <Button
                    aria-describedby={lost ? 'board-offline' : undefined}
                    aria-disabled={lost || undefined}
                    loading={!twin && command.busy === 'confirm_appointment'}
                    onClick={() => void decide(ticket, confirmPayload)}
                    variant={twin ? 'secondary' : 'success'}
                  >
                    {twin
                      ? t('appointments.pending.confirm_alone')
                      : tCommon('actions.confirm')}
                  </Button>
                  <Button
                    aria-describedby={lost ? 'board-offline' : undefined}
                    aria-disabled={lost || undefined}
                    onClick={() => openReason(ticket, 'reject')}
                    variant="secondary"
                  >
                    {t('appointments.pending.reject')}
                  </Button>
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {command.error && !form && !cancelling && !rejecting ? (
        <Banner role="alert" tone="danger">
          {command.error}
        </Banner>
      ) : null}

      {planned.length === 0 && pending.length === 0 ? (
        <Banner>{t('appointments.empty')}</Banner>
      ) : null}
      <ul className="grid gap-2">
        {planned.map((ticket) => {
          const late =
            ticket.status === 'waiting' &&
            ticket.scheduled_at &&
            Date.parse(ticket.scheduled_at) < now
              ? Math.floor((now - Date.parse(ticket.scheduled_at)) / 60_000)
              : 0;
          const status =
            ticket.arrived_at !== null
              ? t('appointments.status.arrived')
              : ticket.status === 'waiting'
                ? late >= LATE_AFTER_MINUTES
                  ? t('appointments.status.late', { minutes: late })
                  : t('appointments.status.upcoming')
                : tCommon(`ticket_status.${ticket.status}`);
          return (
            <li
              className="grid gap-2 rounded-lg border border-border p-3"
              key={ticket.id}
            >
              <p className="font-semibold">
                {ticket.scheduled_at ? time(ticket.scheduled_at) : ''} ·{' '}
                {ticket.display_name}
              </p>
              <p className="text-body-sm text-text-muted">
                {[
                  stylistName(ticket),
                  ticket.service_id
                    ? serviceNames.get(ticket.service_id)
                    : null,
                  status,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {ticket.status === 'waiting' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    aria-describedby={lost ? 'board-offline' : undefined}
                    aria-disabled={lost || undefined}
                    onClick={() =>
                      !lost &&
                      open({
                        ticket,
                        firstName: ticket.display_name,
                        time: ticket.scheduled_at
                          ? hhmm(ticket.scheduled_at)
                          : '',
                        memberId: ticketStylistId(ticket) ?? '',
                        serviceId: ticket.service_id ?? '',
                        phone: '',
                      })
                    }
                    size="sm"
                    variant="secondary"
                  >
                    {t('appointments.edit')}
                  </Button>
                  <Button
                    aria-describedby={lost ? 'board-offline' : undefined}
                    aria-disabled={lost || undefined}
                    onClick={() => openReason(ticket, 'cancel')}
                    size="sm"
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

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(isOpen) => !isOpen && setForm(null)}
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
              autoComplete="off"
              error={fieldErrors.firstName}
              id={FIELD_IDS.firstName}
              label={t('appointments.form.first_name')}
              maxLength={30}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              value={form.firstName}
            />
            <TextField
              error={fieldErrors.time}
              helpText={t('appointments.form.time_hint')}
              id={FIELD_IDS.time}
              label={t('appointments.form.time')}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              step={300}
              type="time"
              value={form.time}
            />
            <label className="grid gap-2">
              <span className="font-semibold text-body-sm">
                {t('appointments.form.stylist')}
              </span>
              <select
                aria-describedby={
                  fieldErrors.memberId ? 'appointment-stylist-error' : undefined
                }
                aria-invalid={fieldErrors.memberId ? true : undefined}
                className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
                id={FIELD_IDS.memberId}
                onChange={(e) => setForm({ ...form, memberId: e.target.value })}
                value={form.memberId}
              >
                {columns.map((c) => (
                  <option key={c.member_id} value={c.member_id}>
                    {c.first_name}
                  </option>
                ))}
              </select>
              {fieldErrors.memberId ? (
                <span
                  className="text-body-sm text-danger-text"
                  id="appointment-stylist-error"
                >
                  {fieldErrors.memberId}
                </span>
              ) : null}
            </label>
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
                <option value="">{t('appointments.form.no_service')}</option>
                {(services.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {/* Someone else's number: the browser must not keep it (H6, ADR-007). */}
            <PhoneField
              autoComplete="off"
              helpText={t('appointments.form.phone_hint')}
              name="appointment-contact"
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
              aria-describedby={lost ? 'board-offline' : undefined}
              aria-disabled={lost || undefined}
              fullWidth
              loading={command.busy !== null}
              onClick={() => !lost && void save()}
            >
              {form.ticket
                ? t('appointments.form.submit_edit')
                : t('appointments.form.submit')}
            </Button>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(isOpen) => !isOpen && setCancelling(null)}
        open={cancelling !== null}
        title={t('appointments.cancel_dialog.title')}
      >
        {cancelling ? (
          <div className="grid gap-4">
            <p>
              {t('appointments.cancel_dialog.summary', {
                first_name: cancelling.display_name,
                stylist_name: stylistName(cancelling) ?? '',
                time: cancelling.scheduled_at
                  ? time(cancelling.scheduled_at)
                  : '',
              })}
            </p>
            <ReasonPicker onChange={setReason} value={reason} />
            <p className="text-body-sm text-text-muted">
              {t('appointments.cancel_dialog.client_notice')}
            </p>
            {command.error ? (
              <Banner role="alert" tone="danger">
                {command.error}
              </Banner>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setCancelling(null)} variant="ghost">
                {t('appointments.cancel_dialog.keep')}
              </Button>
              <Button
                aria-disabled={lost || undefined}
                loading={command.busy === 'cancel_appointment'}
                onClick={() => !lost && void cancel()}
                variant="danger"
              >
                {t('appointments.cancel_dialog.submit')}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={(isOpen) => !isOpen && setRejecting(null)}
        open={rejecting !== null}
        title={t('appointments.pending.reject')}
      >
        {rejecting ? (
          <div className="grid gap-4">
            <ReasonPicker onChange={setReason} value={reason} />
            {command.error ? (
              <Banner role="alert" tone="danger">
                {command.error}
              </Banner>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={() => setRejecting(null)} variant="ghost">
                {tCommon('actions.cancel')}
              </Button>
              <Button
                aria-disabled={lost || undefined}
                loading={command.busy === 'confirm_appointment'}
                onClick={() =>
                  void decide(rejecting, {
                    decision: 'reject',
                    reason_code: reason,
                  })
                }
                variant="danger"
              >
                {t('appointments.pending.reject')}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </main>
  );
}
