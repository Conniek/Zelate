import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog } from '@zelate/ui';
import { sendMemberAction } from '../lib/queue-api';
import { supabase } from '../lib/supabase';
import { useErrorText } from '../lib/use-command';

/** How many waiting clients asked for this member (K2 preview, without writing). */
async function clientsToChoose(memberId: string): Promise<number> {
  const { data } = await supabase.functions.invoke('preview-presence-change', {
    body: { member_id: memberId, status: 'absent' },
  });
  const tickets = (data?.data?.tickets ?? []) as { choice_required: boolean }[];
  return tickets.filter((ticket) => ticket.choice_required).length;
}

/** S-16 · « Déconnecter ses appareils » and « Désactiver » (F-M4). */
export function TeamMemberActions({
  memberId,
  name,
  salonId,
}: {
  memberId: string;
  name: string;
  salonId: string;
}) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const errorText = useErrorText();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<'revoke' | 'deactivate' | null>(null);
  const [count, setCount] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ text: string; warning: boolean } | null>(
    null,
  );

  async function confirm() {
    if (!open) return;
    setBusy(true);
    setError(null);
    const outcome = await sendMemberAction(
      open === 'revoke' ? 'revoke-member-sessions' : 'deactivate-member',
      memberId,
    );
    setBusy(false);
    if (!outcome.ok) {
      setError(errorText(outcome.messageKey));
      return;
    }
    // Sessions kept: the person also works in another salon (security review DEV-6).
    if (open === 'revoke' && outcome.data.sessions_kept === true) {
      setDone({
        text: t('team.revoke_sessions.kept', { stylist_name: name }),
        warning: true,
      });
    } else {
      setDone({
        text:
          open === 'revoke'
            ? t('team.revoke_sessions.done', { stylist_name: name })
            : t('team.deactivate.done', { stylist_name: name }),
        warning: false,
      });
    }
    setOpen(null);
    await queryClient.invalidateQueries({ queryKey: ['team', salonId] });
  }

  return (
    <div className="grid w-full gap-2">
      <div
        aria-label={t('team.menu.label', { stylist_name: name })}
        className="flex flex-wrap items-center gap-2"
        role="group"
      >
        <Button
          onClick={() => {
            setError(null);
            setDone(null);
            setOpen('revoke');
          }}
          size="sm"
          variant="ghost"
        >
          {t('team.menu.revoke_sessions')}
        </Button>
        <Button
          loading={preparing}
          onClick={() => {
            setError(null);
            setDone(null);
            setPreparing(true);
            // The count is known before the dialog opens, so it is read once and right.
            void clientsToChoose(memberId)
              .catch(() => 0)
              .then((n) => {
                setCount(n);
                setPreparing(false);
                setOpen('deactivate');
              });
          }}
          size="sm"
          variant="ghost"
        >
          {t('team.menu.deactivate')}
        </Button>
      </div>
      {done ? (
        <Banner tone={done.warning ? 'warning' : 'success'}>{done.text}</Banner>
      ) : null}
      <Dialog
        closeLabel={tCommon('actions.close')}
        description={
          open === 'revoke'
            ? t('team.revoke_sessions.confirm', { stylist_name: name })
            : t('team.deactivate.confirm', { stylist_name: name, count })
        }
        onOpenChange={(value) => !value && setOpen(null)}
        open={open !== null}
        title={
          open === 'revoke'
            ? t('team.revoke_sessions.title')
            : t('team.deactivate.title', { stylist_name: name })
        }
      >
        <div className="grid gap-4">
          {error ? (
            <Banner role="alert" tone="danger">
              {error}
            </Banner>
          ) : null}
          {/* The destructive action on the right (DESIGN_SYSTEM §7.4). */}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setOpen(null)} variant="ghost">
              {t('team.cancel')}
            </Button>
            <Button
              loading={busy}
              onClick={() => void confirm()}
              variant="danger"
            >
              {open === 'revoke'
                ? t('team.revoke_sessions.submit')
                : t('team.deactivate.submit')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
