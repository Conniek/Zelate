import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog } from '@zelate/ui';
import type { QueueTicket } from '../../lib/queue-api';
import { timeParts } from '../../lib/stylist';
import type { useCommand } from '../../lib/use-command';

export const REMOVAL_REASONS = [
  'emergency',
  'client_request',
  'duplicate',
  'inappropriate_behaviour',
  'other',
] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

/** Reason picked in a list, sent to the client (E29). */
export function ReasonPicker({
  value,
  onChange,
}: {
  value: RemovalReason;
  onChange: (reason: RemovalReason) => void;
}) {
  const { t } = useTranslation('pro-stylist');
  const { t: tManager } = useTranslation('pro-manager');
  return (
    <fieldset className="grid gap-2">
      <legend className="font-semibold text-body-sm">
        {t('appointments.reason_label')}
      </legend>
      {REMOVAL_REASONS.map((reason) => (
        <label className="flex min-h-11 items-center gap-3" key={reason}>
          <input
            checked={value === reason}
            name="reason"
            onChange={() => onChange(reason)}
            type="radio"
          />
          {tManager(`remove.reason.${reason}`)}
        </label>
      ))}
    </fieldset>
  );
}

interface Props {
  ticket: QueueTicket;
  /** My appointments entered by the salon: one at the same time is offered for a merge (K14). */
  appointments: QueueTicket[];
  salonId: string;
  command: ReturnType<typeof useCommand>;
  disabled: boolean;
}

/** `PendingConfirmationCard` (F-S4, F-S10, C-11, S-19). */
export function PendingAppointment({
  ticket,
  appointments,
  salonId,
  command,
  disabled,
}: Props) {
  const { t } = useTranslation('pro-stylist');
  const { t: tCommon } = useTranslation('common');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RemovalReason>('other');
  const time = ticket.scheduled_at
    ? tCommon('formats.time', timeParts(ticket.scheduled_at))
    : '';
  const twin = appointments.find(
    (a) => a.id !== ticket.id && a.scheduled_at === ticket.scheduled_at,
  );

  async function decide(payload: Record<string, unknown>) {
    const outcome = await command.run(
      'confirm_appointment',
      { ticket_id: ticket.id, ...payload },
      salonId,
    );
    if (outcome.ok) setRejecting(false);
  }

  return (
    <section
      aria-live="polite"
      className="grid gap-3 rounded-xl border border-warning bg-warning-subtle p-4"
    >
      <h2 className="font-semibold">{t('queue.pending_appointment.title')}</h2>
      <p>
        {t('queue.pending_appointment.banner', {
          first_name: ticket.display_name,
          time,
        })}
      </p>
      {twin ? (
        <p className="text-body-sm">
          {t('appointments.merge_suggestion', {
            first_name: twin.display_name,
            time,
          })}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {twin ? (
          <Button
            disabled={disabled}
            loading={command.busy === 'confirm_appointment'}
            onClick={() =>
              void decide({
                decision: 'confirm',
                merge_into_ticket_id: twin.id,
              })
            }
            size="lg"
          >
            {t('appointments.merge_confirm')}
          </Button>
        ) : (
          <Button
            disabled={disabled}
            loading={command.busy === 'confirm_appointment'}
            onClick={() => void decide({ decision: 'confirm' })}
            size="lg"
          >
            {t('queue.pending_appointment.confirm')}
          </Button>
        )}
        <Button
          disabled={disabled}
          onClick={() => {
            command.setError(null);
            setRejecting(true);
          }}
          size="lg"
          variant="secondary"
        >
          {t('queue.pending_appointment.reject')}
        </Button>
      </div>
      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={setRejecting}
        open={rejecting}
        title={t('appointments.reject_title', {
          first_name: ticket.display_name,
        })}
      >
        <div className="grid gap-4">
          <ReasonPicker onChange={setReason} value={reason} />
          {command.error ? (
            <Banner role="alert" tone="danger">
              {command.error}
            </Banner>
          ) : null}
          <Button
            disabled={disabled}
            fullWidth
            loading={command.busy === 'confirm_appointment'}
            onClick={() =>
              void decide({ decision: 'reject', reason_code: reason })
            }
            size="xl"
            variant="danger"
          >
            {t('queue.pending_appointment.reject')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
