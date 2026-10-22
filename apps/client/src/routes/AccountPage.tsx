import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router';
import { Banner, Button, Dialog, Skeleton, TextField } from '@zelate/ui';
import {
  deleteAccount,
  exportData,
  loadConsentAt,
  loadFirstName,
  updateFirstName,
} from '../lib/account-api';
import { isActive } from '../lib/client-api';
import {
  timeParts,
  useClientCommand,
  useMyTicket,
  usePageTitle,
  useSession,
} from '../lib/live';
import { supabase } from '../lib/supabase';

const FIRST_NAME_MAX = 30;

/** `/account` (F-C11, U-13): first name, consent, export, deletion, sign-out. */
export function AccountPage() {
  const { t } = useTranslation('client');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const { t: tLegal } = useTranslation('legal');
  usePageTitle(t('account.page_title'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const signedIn = session.data === true;
  const mine = useMyTicket(signedIn);
  const command = useClientCommand();
  const profile = useQuery({
    queryKey: ['account-first-name'],
    queryFn: loadFirstName,
    enabled: signedIn,
    gcTime: 0,
  });

  const [firstName, setFirstName] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameTries, setNameTries] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const [step, setStep] = useState<'first' | 'second' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const doneHeading = useRef<HTMLHeadingElement>(null);

  const view = mine.query.data;
  const active = view && isActive(view.ticket) ? view : null;
  const consentAt = useQuery({
    queryKey: [
      'account-consent',
      active?.ticket.id,
      active?.ticket.notifications_consent,
    ],
    queryFn: () => loadConsentAt(active!.ticket.id),
    enabled: active !== null && active.ticket.notifications_consent,
    gcTime: 0,
  });

  useEffect(() => {
    if (nameError) document.getElementById('account-first-name')?.focus();
  }, [nameError, nameTries]);
  useEffect(() => {
    if (deleted) doneHeading.current?.focus();
  }, [deleted]);

  if (deleted) {
    // U-13 scenario 12: the session is over, nothing of him is left here.
    return (
      <main className="mx-auto grid w-full max-w-xl gap-5 px-5 py-8">
        <h1
          className="font-display text-h2 font-bold focus:outline-none"
          ref={doneHeading}
          tabIndex={-1}
        >
          {t('account.delete.done')}
        </h1>
        <Link
          className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 font-semibold text-text-on-primary"
          to="/"
        >
          {t('account.delete.done_home')}
        </Link>
      </main>
    );
  }
  if (session.isPending) {
    return (
      <main aria-busy="true" className="mx-auto w-full max-w-xl px-5 py-8">
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }
  // As for /ticket (APP_FLOW §2.3): sign in first, then back here.
  if (!signedIn) return <Navigate replace to="/signin?next=%2Faccount" />;

  const shownName = firstName ?? profile.data ?? '';

  async function saveName() {
    const value = shownName.trim();
    if (value.length < 1 || value.length > FIRST_NAME_MAX) {
      setNameError(tErrors('validation.first_name'));
      setNameTries((n) => n + 1);
      return;
    }
    setSaving(true);
    const ok = await updateFirstName(value);
    setSaving(false);
    if (!ok) {
      setStatus('');
      setNameError(tErrors('generic.unexpected'));
      setNameTries((n) => n + 1);
      return;
    }
    setNameError(null);
    setFirstName(value);
    await queryClient.invalidateQueries({ queryKey: ['account-first-name'] });
    setStatus(t('account.first_name.saved'));
  }

  async function download() {
    setExporting(true);
    setExportFailed(false);
    const text = await exportData();
    setExporting(false);
    if (text === null) {
      setExportFailed(true);
      return;
    }
    // Saved by the browser, kept nowhere by the app (no storage).
    const url = URL.createObjectURL(
      new Blob([text], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `zelate-mes-donnees-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus(t('account.data.exported'));
  }

  async function remove() {
    setDeleting(true);
    setDeleteFailed(false);
    const ok = await deleteAccount();
    setDeleting(false);
    if (!ok) {
      setDeleteFailed(true);
      return;
    }
    setStep(null);
    // The Auth account is gone: only the local session is left to clear.
    await supabase.auth.signOut({ scope: 'local' });
    queryClient.clear();
    setDeleted(true);
  }

  async function signOut() {
    await supabase.auth.signOut();
    queryClient.clear();
    void navigate('/', { replace: true });
  }

  const consentDate = consentAt.data ? new Date(consentAt.data) : null;

  return (
    <main className="mx-auto grid w-full max-w-xl gap-6 px-5 py-8">
      <h1 className="font-display text-h2 font-bold">{t('account.title')}</h1>
      <p aria-live="polite" className="sr-only" role="status">
        {status}
      </p>

      {/* The field's own label names this part: no extra heading. */}
      <div className="grid gap-3">
        {profile.isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveName();
            }}
          >
            <TextField
              autoComplete="given-name"
              error={nameError ?? undefined}
              helpText={t('account.first_name.hint')}
              id="account-first-name"
              label={t('account.first_name.label')}
              maxLength={FIRST_NAME_MAX + 1}
              onChange={(e) => {
                setNameError(null);
                setStatus('');
                setFirstName(e.target.value);
              }}
              value={shownName}
            />
            <div>
              <Button loading={saving} type="submit" variant="secondary">
                {t('account.first_name.save')}
              </Button>
            </div>
          </form>
        )}
      </div>

      <section aria-labelledby="account-consent-title" className="grid gap-2">
        <h2 className="text-h3 font-semibold" id="account-consent-title">
          {t('account.consent.title')}
        </h2>
        {active &&
        (active.ticket.status === 'waiting' ||
          active.ticket.status === 'pending_confirmation') ? (
          <>
            <p className="text-body-sm text-text-muted">
              {t('account.consent.current', { salon_name: active.salon.name })}
            </p>
            <label className="flex min-h-11 items-center gap-3 font-semibold">
              {/* K18, K34: the consent belongs to the place in progress. */}
              <input
                aria-describedby="account-consent-detail"
                checked={active.ticket.notifications_consent}
                className="size-6"
                onChange={(e) =>
                  void command.run('set_notifications_consent', {
                    ticket_id: active.ticket.id,
                    consent: e.target.checked,
                  })
                }
                role="switch"
                type="checkbox"
              />
              {tLegal('consent.tracking_notifications.switch')}
            </label>
            <p
              className="text-body-sm text-text-muted"
              id="account-consent-detail"
            >
              {active.ticket.notifications_consent && consentDate
                ? `${tLegal('consent.tracking_notifications.given_at', {
                    date: consentDate,
                  })}, ${tCommon('formats.time', timeParts(consentAt.data!))}`
                : tLegal('consent.tracking_notifications.explanation')}
            </p>
            {command.error ? (
              <Banner role="alert" tone="danger">
                {command.error}
              </Banner>
            ) : null}
          </>
        ) : (
          <p className="text-body-sm">{t('account.consent.no_ticket')}</p>
        )}
      </section>

      <section aria-labelledby="account-data-title" className="grid gap-3">
        <h2 className="text-h3 font-semibold" id="account-data-title">
          {t('account.data.title')}
        </h2>
        {exportFailed ? (
          <Banner role="alert" tone="danger">
            {t('account.data.export_failed')}
          </Banner>
        ) : null}
        <Button
          loading={exporting}
          onClick={() => !exporting && void download()}
          variant="secondary"
        >
          {exportFailed ? tCommon('actions.retry') : t('account.export')}
        </Button>
        <Button onClick={() => setStep('first')} variant="danger">
          {t('account.delete.label')}
        </Button>
      </section>

      <Button onClick={() => void signOut()} variant="ghost">
        {t('account.sign_out')}
      </Button>

      {/* U-13 scenario 10: two confirmations before anything is deleted. */}
      <Dialog
        closeLabel={tCommon('actions.close')}
        description={
          step === 'first'
            ? t('account.delete.confirm_first')
            : t('account.delete.confirm_second')
        }
        onOpenChange={(open) => {
          if (!open) {
            setStep(null);
            setDeleteFailed(false);
          }
        }}
        open={step !== null}
        title={t('account.delete.label')}
      >
        <div className="grid gap-3">
          {deleteFailed ? (
            <Banner role="alert" tone="danger">
              {tErrors('account.delete_failed')}
            </Banner>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setStep(null)} variant="ghost">
              {t('account.delete.keep')}
            </Button>
            {step === 'first' ? (
              <Button onClick={() => setStep('second')} variant="danger">
                {t('account.delete.continue')}
              </Button>
            ) : (
              <Button
                loading={deleting}
                onClick={() => !deleting && void remove()}
                variant="danger"
              >
                {deleteFailed
                  ? tCommon('actions.retry')
                  : t('account.delete.confirm')}
              </Button>
            )}
          </div>
        </div>
      </Dialog>
    </main>
  );
}
