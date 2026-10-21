import { useQueries } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog, TextField } from '@zelate/ui';
import type { BoardStylist, BoardTicket } from '../lib/board-api';
import { previewReassignment, ticketStylistId } from '../lib/board-api';
import { timeParts } from '../lib/stylist';
import { useCommand, useErrorText } from '../lib/use-command';

const REASONS = [
  'emergency',
  'client_request',
  'duplicate',
  'inappropriate_behaviour',
  'other',
] as const;
const NOTE_MAX = 200;

type View = 'detail' | 'remove' | 'reassign' | 'complete';

interface Props {
  /** Called after a successful action: what to announce, whose column to focus. */
  onDone: (message: string, memberId: string | null) => void;
  onClose: () => void;
  salonId: string;
  stylists: BoardStylist[];
  ticket: BoardTicket;
}

/** F-M9 and F-M10: the detail of a ticket, with the manager's actions on it. */
export function TicketPanel({
  onClose,
  onDone,
  salonId,
  stylists,
  ticket,
}: Props) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { busy, error, run, setError } = useCommand();
  const [view, setView] = useState<View>('detail');
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [note, setNote] = useState('');
  const body = useRef<HTMLDivElement>(null);
  const currentId = ticketStylistId(ticket);
  // The engine reassigns a waiting client only, one request at a time (E9).
  const canReassign =
    ticket.status === 'waiting' && ticket.reassignment_member_id === null;
  const errorText = useErrorText();
  const [target, setTarget] = useState<string | null>(null);
  const others = stylists.filter((s) => s.member_id !== currentId);
  // S-13 scenario 1: each stylist with the client's new time, read without writing.
  const previews = useQueries({
    queries: others.map((stylist) => ({
      queryKey: ['reassign-preview', ticket.id, stylist.member_id],
      queryFn: () => previewReassignment(ticket.id, stylist.member_id),
      enabled: view === 'reassign',
      staleTime: 0,
      gcTime: 0,
      retry: false,
    })),
  });
  const time = (iso: string) => tCommon('formats.time', timeParts(iso));
  const canRemove = ticket.status !== 'in_service';
  const name = ticket.display_name;

  // The clicked button is replaced by the new view: the focus goes to its first control.
  const firstView = useRef(true);
  useEffect(() => {
    if (firstView.current) {
      firstView.current = false;
      return;
    }
    body.current
      ?.querySelector<HTMLElement>('[data-autofocus], input, button')
      ?.focus();
  }, [view]);

  function show(next: View) {
    setError(null);
    setView(next);
  }

  async function send(
    command: string,
    payload: Record<string, unknown>,
    done: string,
    memberId: string | null,
  ) {
    const outcome = await run(command, payload, salonId);
    if (outcome.ok) onDone(done, memberId);
  }

  const title =
    view === 'remove'
      ? t('remove.title', { first_name: name })
      : view === 'reassign'
        ? t('reassign.title', { first_name: name })
        : name;

  const back = (
    <Button onClick={() => show('detail')} variant="ghost">
      {tCommon('actions.cancel')}
    </Button>
  );

  return (
    <Dialog
      closeLabel={tCommon('actions.close')}
      description={tCommon(`ticket_status.${ticket.status}`)}
      onOpenChange={(open) => !open && onClose()}
      open
      title={title}
    >
      <div className="grid gap-4" ref={body}>
        {view === 'detail' ? (
          <div className="grid gap-2">
            {ticket.status === 'in_service' ? (
              <Button onClick={() => show('complete')}>
                {t('ticket_panel.complete')}
              </Button>
            ) : null}
            {canReassign ? (
              <Button onClick={() => show('reassign')} variant="secondary">
                {t('ticket_panel.reassign')}
              </Button>
            ) : null}
            {canRemove ? (
              <Button onClick={() => show('remove')} variant="secondary">
                {t('ticket_panel.remove')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {view === 'complete' ? (
          <>
            <p>{t('ticket_panel.complete_confirm', { first_name: name })}</p>
            <div className="flex flex-wrap justify-end gap-2">
              {back}
              <Button
                data-autofocus
                loading={busy === 'complete_service'}
                onClick={() =>
                  void send(
                    'complete_service',
                    { ticket_id: ticket.id },
                    t('ticket_panel.completed', { first_name: name }),
                    currentId,
                  )
                }
              >
                {t('ticket_panel.complete')}
              </Button>
            </div>
          </>
        ) : null}

        {view === 'remove' ? (
          <>
            <fieldset className="grid gap-2">
              <legend className="font-semibold text-body-sm">
                {t('remove.reason.label')}
              </legend>
              {REASONS.map((code) => (
                <label className="flex min-h-11 items-center gap-3" key={code}>
                  <input
                    checked={reason === code}
                    name="removal-reason"
                    onChange={() => setReason(code)}
                    type="radio"
                  />
                  {t(`remove.reason.${code}`)}
                </label>
              ))}
            </fieldset>
            <TextField
              helpText={t('remove.note_hint')}
              label={t('remove.note')}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              value={note}
            />
            <p className="text-body-sm text-text-muted">
              {t('remove.client_notice')}
            </p>
            {reason === null ? (
              <p
                className="text-body-sm text-text-muted"
                id="remove-reason-hint"
              >
                {t('remove.reason_required')}
              </p>
            ) : null}
            {/* The destructive action on the right (DESIGN_SYSTEM ConfirmDialog). */}
            <div className="flex flex-wrap justify-end gap-2">
              {back}
              <Button
                aria-describedby={
                  reason === null ? 'remove-reason-hint' : undefined
                }
                aria-disabled={reason === null || undefined}
                loading={busy === 'remove_ticket'}
                onClick={() =>
                  void send(
                    'remove_ticket',
                    {
                      ticket_id: ticket.id,
                      reason_code: reason,
                      note: note.trim() === '' ? null : note.trim(),
                    },
                    t('remove.done', { first_name: name }),
                    currentId,
                  )
                }
                variant="danger"
              >
                {t('remove.submit')}
              </Button>
            </div>
          </>
        ) : null}

        {view === 'reassign' ? (
          <>
            <fieldset className="grid gap-2">
              <legend className="font-semibold text-body-sm">
                {t('reassign.choose')}
              </legend>
              {others.map((stylist, index) => {
                const preview = previews[index]?.data;
                const after =
                  preview && 'needs_client_answer' in preview
                    ? preview.estimated_start_at_after
                    : null;
                return (
                  <label
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-border px-3 py-2"
                    key={stylist.member_id}
                  >
                    <input
                      checked={target === stylist.member_id}
                      name="reassign-target"
                      onChange={() => {
                        setError(null);
                        setTarget(stylist.member_id);
                      }}
                      type="radio"
                    />
                    <span className="font-semibold">{stylist.first_name}</span>
                    <span className="ml-auto text-body-sm text-text-muted">
                      {preview === undefined
                        ? '…'
                        : 'refused' in preview
                          ? errorText(preview.refused)
                          : after
                            ? t('reassign.new_time', { time: time(after) })
                            : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {(() => {
              const index = others.findIndex((s) => s.member_id === target);
              const chosen = index >= 0 ? others[index] : undefined;
              const preview = index >= 0 ? previews[index]?.data : undefined;
              const ready =
                chosen !== undefined &&
                preview !== undefined &&
                'needs_client_answer' in preview;
              const asks = ready && preview.needs_client_answer;
              const minutes =
                ready &&
                preview.estimated_start_at_before &&
                preview.estimated_start_at_after
                  ? Math.round(
                      (Date.parse(preview.estimated_start_at_after) -
                        Date.parse(preview.estimated_start_at_before)) /
                        60_000,
                    )
                  : 0;
              return (
                <>
                  {asks ? (
                    <Banner tone="warning">
                      {t('reassign.delay_warning', { minutes })}
                    </Banner>
                  ) : null}
                  {target === null ? (
                    <p
                      className="text-body-sm text-text-muted"
                      id="reassign-hint"
                    >
                      {t('reassign.choose_hint')}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-2">
                    {back}
                    <Button
                      aria-describedby={
                        target === null ? 'reassign-hint' : undefined
                      }
                      aria-disabled={!ready || undefined}
                      loading={busy === 'reassign_ticket'}
                      onClick={() =>
                        ready &&
                        void send(
                          'reassign_ticket',
                          { ticket_id: ticket.id, member_id: chosen.member_id },
                          asks
                            ? t('reassign.request_sent')
                            : t('reassign.done', {
                                first_name: name,
                                stylist_name: chosen.first_name,
                              }),
                          asks ? currentId : chosen.member_id,
                        )
                      }
                    >
                      {asks
                        ? t('reassign.send_request')
                        : tCommon('actions.confirm')}
                    </Button>
                  </div>
                </>
              );
            })()}
          </>
        ) : null}

        {error ? (
          <Banner role="alert" tone="danger">
            {error}
          </Banner>
        ) : null}
      </div>
    </Dialog>
  );
}
