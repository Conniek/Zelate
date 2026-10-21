import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, OtpField } from '@zelate/ui';
import { supabase } from '../lib/supabase';

function useMfaLabels() {
  const { t } = useTranslation('pro-manager');
  const { t: tErrors } = useTranslation('errors');
  return { t, tErrors };
}

export function MfaForbidden() {
  const { t } = useMfaLabels();
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-xl content-center gap-4 px-5 py-10">
      <Banner role="alert" tone="danger">
        {t('admin.mfa.forbidden')}
      </Banner>
    </main>
  );
}

function CodeForm({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const { t } = useMfaLabels();
  const [code, setCode] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (code.length === 6) onSubmit(code);
  }

  return (
    <form className="grid gap-4" onSubmit={submit}>
      <OtpField
        disabled={busy}
        digitLabel={(index) => t('admin.mfa.digit_aria', { index })}
        error={error ?? undefined}
        label={t('admin.mfa.code_label')}
        onChange={setCode}
        onComplete={onSubmit}
        value={code}
      />
      <Button
        aria-disabled={code.length !== 6 || undefined}
        fullWidth
        loading={busy}
        size="lg"
        type="submit"
      >
        {t('admin.mfa.submit')}
      </Button>
    </form>
  );
}

export function MfaVerify({ onDone }: { onDone: () => void }) {
  const { t, tErrors } = useMfaLabels();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify(code: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factorId = factors?.totp[0]?.id;
    const result = factorId
      ? await supabase.auth.mfa.challengeAndVerify({ code, factorId })
      : { error: new Error('no factor') };
    setBusy(false);
    if (result.error) {
      setError(tErrors('auth.invalid_mfa_code'));
      return;
    }
    onDone();
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-xl content-center gap-6 px-5 py-10">
      <h1 className="font-display text-h2 font-bold">
        {t('admin.mfa.verify_title')}
      </h1>
      <p className="text-body text-text-muted">{t('admin.mfa.verify_body')}</p>
      <CodeForm busy={busy} error={error} onSubmit={(c) => void verify(c)} />
    </main>
  );
}

type Enrollment = { factorId: string; qrCode: string; secret: string };

export function MfaEnroll({ onDone }: { onDone: () => void }) {
  const { t, tErrors } = useMfaLabels();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.mfa
      .enroll({ factorType: 'totp' })
      .then(({ data, error: e }) => {
        if (!active) return;
        if (e || !data) {
          setError(tErrors('generic.unexpected'));
          return;
        }
        setEnrollment({
          factorId: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
      });
    return () => {
      active = false;
    };
  }, [tErrors]);

  async function verify(code: string) {
    if (busy || !enrollment) return;
    setBusy(true);
    setError(null);
    const { error: failure } = await supabase.auth.mfa.challengeAndVerify({
      code,
      factorId: enrollment.factorId,
    });
    setBusy(false);
    if (failure) {
      setError(tErrors('auth.invalid_mfa_code'));
      return;
    }
    onDone();
  }

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-xl content-center gap-6 px-5 py-10">
      <h1 className="font-display text-h2 font-bold">
        {t('admin.mfa.enroll_title')}
      </h1>
      <p className="text-body text-text-muted">{t('admin.mfa.enroll_body')}</p>
      {enrollment ? (
        <>
          <img
            alt=""
            className="size-48 justify-self-center"
            src={enrollment.qrCode}
          />
          <p className="text-body-sm">
            {t('admin.mfa.secret_label')} :{' '}
            <code className="break-all">{enrollment.secret}</code>
          </p>
          <CodeForm
            busy={busy}
            error={error}
            onSubmit={(c) => void verify(c)}
          />
        </>
      ) : error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
    </main>
  );
}
