import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Banner, Button, Dialog, Skeleton, TextField } from '@zelate/ui';
import { decideSalon, getSalon } from '../lib/admin-api';

export function AdminSalonPage() {
  const { salonId = '' } = useParams();
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const { data, isError, isPending } = useQuery({
    queryKey: ['admin-salon', salonId],
    queryFn: () => getSalon(salonId),
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  async function decide(decision: 'approved' | 'rejected') {
    if (busy) return;
    if (decision === 'rejected' && reason.trim() === '') {
      setReasonError(tErrors('validation.reject_reason_required'));
      return;
    }
    setBusy(true);
    setError(null);
    const failure = await decideSalon(
      salonId,
      decision,
      decision === 'rejected' ? reason.trim() : undefined,
    );
    setBusy(false);
    setRejecting(false);
    if (failure) {
      setError(
        tErrors(failure.replace(/^errors\./, '') as 'generic.unexpected'),
      );
    } else {
      setDone(
        t(
          decision === 'approved'
            ? 'admin.salon.approve_done'
            : 'admin.salon.reject_done',
        ),
      );
    }
    await queryClient.invalidateQueries({ queryKey: ['admin-salon', salonId] });
    await queryClient.invalidateQueries({ queryKey: ['admin-salons'] });
  }

  if (isPending) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-10">
        <Skeleton className="h-48 w-full" />
      </main>
    );
  }
  if (isError || !data) {
    return (
      <main className="mx-auto grid w-full max-w-3xl gap-4 px-5 py-10">
        <Banner role="alert" tone="danger">
          {t('admin.salon.not_found')}
        </Banner>
        <Link className="underline" to="/admin/salons">
          {t('admin.salon.back')}
        </Link>
      </main>
    );
  }

  const fields: [string, string][] = [
    [t('admin.salon.fields.name'), data.name],
    [t('admin.salon.fields.phone'), data.phone],
    [
      t('admin.salon.fields.address'),
      `${data.address_line}, ${data.postal_code} ${data.city}`,
    ],
    [t('admin.salon.fields.siret'), data.siret],
    [t('admin.salon.fields.naf'), data.naf_code || '—'],
    [
      t('admin.salon.fields.manager'),
      data.manager
        ? `${data.manager.first_name} ${data.manager.last_name} · ${data.manager.email}`
        : '—',
    ],
    [
      t('admin.salon.fields.submitted_at'),
      new Date(data.submitted_at).toLocaleDateString('fr-FR'),
    ],
  ];
  const pending =
    data.decision === 'pending' && data.status === 'pending_review';

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-5 py-10">
      <Link className="underline" to="/admin/salons">
        {t('admin.salon.back')}
      </Link>
      <h1 className="font-display text-h2 font-bold">{data.name}</h1>
      {error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
      {done ? <Banner tone="success">{done}</Banner> : null}

      <section className="grid gap-3">
        <h2 className="text-h3 font-semibold">
          {t('admin.salon.sections.submitted_data')}
        </h2>
        <dl className="grid gap-3">
          {fields.map(([label, value]) => (
            <div className="grid gap-1" key={label}>
              <dt className="text-body-sm text-text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="grid gap-3">
        <h2 className="text-h3 font-semibold">
          {t('admin.salon.sections.company_check')}
        </h2>
        <Banner
          tone={data.siret_check_result === 'valid' ? 'success' : 'warning'}
        >
          {t(`admin.salon.siret_result.${data.siret_check_result}`)}
        </Banner>
      </section>

      <section className="grid gap-3">
        <h2 className="text-h3 font-semibold">
          {t('admin.salon.sections.map')}
        </h2>
        <a
          className="underline"
          href={`https://www.openstreetmap.org/?mlat=${String(data.latitude)}&mlon=${String(data.longitude)}#map=17/${String(data.latitude)}/${String(data.longitude)}`}
          rel="noreferrer"
          target="_blank"
        >
          {t('admin.salon.map_link')}
        </a>
      </section>

      {pending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            loading={busy}
            onClick={() => void decide('approved')}
            size="lg"
          >
            {t('admin.salon.approve')}
          </Button>
          <Button
            disabled={busy}
            onClick={() => setRejecting(true)}
            size="lg"
            variant="secondary"
          >
            {t('admin.salon.reject')}
          </Button>
        </div>
      ) : (
        <Banner>
          {t('admin.salon.decided', {
            decision: t(`admin.salons.decision.${data.decision}`),
            date: data.decided_at
              ? new Date(data.decided_at).toLocaleDateString('fr-FR')
              : '',
          })}
          {data.decision_reason
            ? ` ${t('admin.salon.decided_reason', { reason: data.decision_reason })}`
            : ''}
        </Banner>
      )}

      <Dialog
        closeLabel={tCommon('actions.close')}
        onOpenChange={setRejecting}
        open={rejecting}
        title={t('admin.salon.reject_confirm_title')}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void decide('rejected');
          }}
        >
          <TextField
            error={reasonError ?? undefined}
            helpText={t('admin.salon.reject_reason.hint')}
            label={t('admin.salon.reject_reason.label')}
            maxLength={500}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(null);
            }}
            value={reason}
          />
          <Button loading={busy} type="submit">
            {t('admin.salon.reject_submit')}
          </Button>
        </form>
      </Dialog>
    </main>
  );
}
