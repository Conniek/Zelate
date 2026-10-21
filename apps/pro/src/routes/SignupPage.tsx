import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';
import { isValidSiretFormat, normalizeSiret } from '@zelate/salon-signup/siret';
import {
  AddressField,
  Banner,
  Button,
  PhoneField,
  TextField,
} from '@zelate/ui';
import type { AddressSuggestion } from '@zelate/ui';
import { searchAddresses } from '../lib/address';
import {
  loadDraft,
  saveDraft,
  submitSignup,
  verifySiret,
} from '../lib/signup-api';
import type { SiretState } from '../lib/signup-api';
import { supabase } from '../lib/supabase';

interface Form {
  firstName: string;
  lastName: string;
  salonName: string;
  phone: string;
  address: AddressSuggestion | null;
  siret: string;
  isHairdressing: boolean;
}

const EMPTY: Form = {
  firstName: '',
  lastName: '',
  salonName: '',
  phone: '',
  address: null,
  siret: '',
  isHairdressing: false,
};

const TOTAL = 4;
const MIN_PASSWORD = 12;

function fromDraft(data: Record<string, unknown>): Form {
  const text = (key: string) =>
    typeof data[key] === 'string' ? (data[key] as string) : '';
  return {
    firstName: text('firstName'),
    lastName: text('lastName'),
    salonName: text('salonName'),
    phone: text('phone'),
    address: (data.address as AddressSuggestion | undefined) ?? null,
    siret: text('siret'),
    isHairdressing: data.isHairdressing === true,
  };
}

export function SignupPage() {
  const { t } = useTranslation('pro-manager');
  const { t: tErrors } = useTranslation('errors');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Form>(EMPTY);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<Record<string, string>>({});
  const [confirmSent, setConfirmSent] = useState(false);
  const [siretState, setSiretState] = useState<SiretState | 'checking' | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [draftFailed, setDraftFailed] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (!data.session) {
        setSignedIn(false);
        return;
      }
      const draft = await loadDraft().catch(() => null);
      if (!active) return;
      if (draft) {
        setForm(fromDraft(draft.data));
        setStep(Math.max(2, draft.step));
      } else {
        setStep(2);
      }
      setSignedIn(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  // The draft follows every change (S-01 scenario 7), one second after the last keystroke.
  useEffect(() => {
    if (!signedIn || !dirty.current) return;
    const timer = setTimeout(() => {
      saveDraft(step, { ...form })
        .then(() => {
          setSaved(true);
          setDraftFailed(false);
        })
        .catch(() => setDraftFailed(true));
    }, 1000);
    return () => clearTimeout(timer);
  }, [form, step, signedIn]);

  const update = useCallback((patch: Partial<Form>) => {
    dirty.current = true;
    setSaved(false);
    setForm((current) => ({ ...current, ...patch }));
  }, []);

  async function createAccount(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (password.length < MIN_PASSWORD) {
      setError(tErrors('auth.weak_password'));
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: failure } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/signup` },
    });
    setBusy(false);
    if (failure) {
      setError(
        failure.code === 'weak_password'
          ? tErrors('auth.weak_password')
          : tErrors('generic.unexpected'),
      );
      return;
    }
    // Auth hides an existing account: it returns a user without identities.
    if (data.user && data.user.identities?.length === 0) {
      setError(tErrors('auth.email_in_use'));
      return;
    }
    if (data.session) {
      setSignedIn(true);
      setStep(2);
    } else {
      setConfirmSent(true);
    }
  }

  async function checkSiret() {
    const siret = normalizeSiret(form.siret);
    if (siret === '') return;
    if (!isValidSiretFormat(siret)) {
      setSiretState(null);
      setFieldError((e) => ({
        ...e,
        siret: tErrors('validation.siret_format'),
      }));
      return;
    }
    setFieldError((e) => ({ ...e, siret: '' }));
    setSiretState('checking');
    setSiretState(await verifySiret(siret));
  }

  function validateStep(current: number): boolean {
    const errors: Record<string, string> = {};
    if (current === 2) {
      if (form.firstName.trim() === '') {
        errors.firstName = tErrors('validation.required');
      }
      if (form.salonName.trim().length < 2) {
        errors.salonName = tErrors('validation.required');
      }
      if (!/^[1-9]\d{8}$/.test(form.phone)) {
        errors.phone = tErrors('validation.phone_format');
      }
      if (!form.address) {
        errors.address = tErrors('validation.address_not_selected');
      }
      if (!isValidSiretFormat(normalizeSiret(form.siret))) {
        errors.siret = tErrors('validation.siret_format');
      }
    }
    setFieldError(errors);
    return Object.keys(errors).length === 0;
  }

  function next(event: FormEvent) {
    event.preventDefault();
    if (!validateStep(step)) return;
    dirty.current = true;
    setStep((s) => Math.min(TOTAL, s + 1));
  }

  async function submit() {
    if (busy || !form.address) return;
    setBusy(true);
    setError(null);
    const outcome = await submitSignup({
      firstName: form.firstName,
      lastName: form.lastName,
      salonName: form.salonName,
      phone: `+33${form.phone}`,
      addressLine: form.address.addressLine,
      postalCode: form.address.postalCode,
      city: form.address.city,
      cityCode: form.address.cityCode,
      longitude: form.address.longitude,
      latitude: form.address.latitude,
      siret: normalizeSiret(form.siret),
      isHairdressing: form.isHairdressing,
    });
    setBusy(false);
    if (outcome.ok) {
      void navigate('/signup/pending', { replace: true });
      return;
    }
    setError(
      tErrors(
        outcome.messageKey.replace(/^errors\./, '') as 'generic.unexpected',
      ),
    );
  }

  if (signedIn === null) return null;

  const stepLabel = t('signup.step', {
    step: signedIn ? step : 1,
    total: TOTAL,
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 py-10">
      <header className="grid gap-1">
        <h1 className="font-display text-h2 font-bold">{t('signup.title')}</h1>
        <p className="text-body-sm text-text-muted">{stepLabel}</p>
      </header>
      {error ? (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      ) : null}
      {draftFailed ? (
        <Banner tone="warning">{t('signup.draft_error')}</Banner>
      ) : null}

      {!signedIn ? (
        <form className="grid gap-4" onSubmit={(e) => void createAccount(e)}>
          <h2 className="text-h3 font-semibold">{t('signup.account.title')}</h2>
          {confirmSent ? (
            <Banner>{t('signup.account.confirm_email')}</Banner>
          ) : null}
          <TextField
            autoComplete="email"
            inputMode="email"
            label={t('signup.account.email')}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            value={email}
          />
          <TextField
            autoComplete="new-password"
            helpText={t('signup.account.password_hint')}
            label={t('signup.account.password')}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            value={password}
          />
          <Button
            disabled={email.trim() === '' || password === ''}
            fullWidth
            loading={busy}
            size="lg"
            type="submit"
          >
            {t('signup.account.create')}
          </Button>
          <Link className="text-body-sm underline" to="/signin">
            {t('signup.account.have_account')}
          </Link>
        </form>
      ) : null}

      {signedIn && step === 2 ? (
        <form className="grid gap-4" onSubmit={next}>
          <h2 className="text-h3 font-semibold">{t('signup.salon.title')}</h2>
          <TextField
            autoComplete="given-name"
            error={fieldError.firstName}
            label={t('signup.account.first_name')}
            maxLength={30}
            onChange={(e) => update({ firstName: e.target.value })}
            value={form.firstName}
          />
          <TextField
            autoComplete="family-name"
            label={t('signup.account.last_name')}
            onChange={(e) => update({ lastName: e.target.value })}
            value={form.lastName}
          />
          <TextField
            error={fieldError.salonName}
            label={t('signup.salon.name')}
            maxLength={80}
            onChange={(e) => update({ salonName: e.target.value })}
            value={form.salonName}
          />
          <PhoneField
            error={fieldError.phone}
            helpText={t('signup.salon.phone_hint')}
            label={t('signup.salon.phone')}
            onChange={(phone) => update({ phone })}
            prefix="+33"
            value={form.phone}
          />
          <AddressField
            error={fieldError.address}
            helpText={t('signup.salon.address_hint')}
            initialValue={form.address?.label}
            label={t('signup.salon.address')}
            noResultsText={t('signup.salon.address_none')}
            onSearch={searchAddresses}
            onSelect={(address) => update({ address })}
          />
          <div className="grid gap-2">
            <TextField
              error={fieldError.siret}
              helpText={t('signup.salon.siret_hint')}
              inputMode="numeric"
              label={t('signup.salon.siret')}
              onBlur={() => void checkSiret()}
              onChange={(e) => {
                setSiretState(null);
                update({ siret: e.target.value });
              }}
              value={form.siret}
            />
            {siretState === 'checking' ? (
              <p className="text-body-sm text-text-muted" role="status">
                {t('signup.salon.siret_checking')}
              </p>
            ) : null}
            {siretState === 'valid' ? (
              <Banner tone="success">{t('signup.salon.siret_valid')}</Banner>
            ) : null}
            {siretState === 'to_verify' || siretState === 'unavailable' ? (
              <Banner tone="warning">
                <strong>⚠ {t('signup.salon.siret_to_verify')}</strong>{' '}
                {t('signup.salon.siret_to_verify_hint')}
              </Banner>
            ) : null}
          </div>
          <p
            aria-live="polite"
            className="text-body-sm text-text-muted"
            role="status"
          >
            {saved ? t('signup.draft_saved') : ''}
          </p>
          <Button fullWidth size="lg" type="submit">
            {tCommon('actions.next')}
          </Button>
        </form>
      ) : null}

      {signedIn && step === 3 ? (
        <form className="grid gap-4" onSubmit={next}>
          <h2 className="text-h3 font-semibold">
            {t('signup.hairdressing.title')}
          </h2>
          <label className="flex min-h-12 items-center gap-3 text-body">
            <input
              checked={form.isHairdressing}
              className="size-6"
              onChange={(e) => update({ isHairdressing: e.target.checked })}
              type="checkbox"
            />
            {t('signup.hairdressing.label')}
          </label>
          <p className="text-body-sm text-text-muted">
            {t('signup.hairdressing.hint')}
          </p>
          <div className="grid gap-3">
            <Button fullWidth size="lg" type="submit">
              {tCommon('actions.next')}
            </Button>
            <Button
              fullWidth
              onClick={() => setStep(2)}
              type="button"
              variant="secondary"
            >
              {tCommon('actions.back')}
            </Button>
          </div>
        </form>
      ) : null}

      {signedIn && step === 4 ? (
        <section className="grid gap-4">
          <h2 className="text-h3 font-semibold">{t('signup.review.title')}</h2>
          <dl className="grid gap-3 text-body">
            <Row label={t('signup.salon.name')} value={form.salonName} />
            <Row
              label={t('signup.review.address')}
              value={form.address?.label ?? ''}
            />
            <Row label={t('signup.salon.phone')} value={`+33 ${form.phone}`} />
            <Row label={t('signup.salon.siret')} value={form.siret} />
            <Row
              label={t('signup.hairdressing.title')}
              value={
                form.isHairdressing
                  ? t('signup.review.hairdressing_yes')
                  : t('signup.review.hairdressing_no')
              }
            />
          </dl>
          <div className="grid gap-3">
            <Button
              fullWidth
              loading={busy}
              onClick={() => void submit()}
              size="lg"
            >
              {t('signup.submit')}
            </Button>
            <Button
              disabled={busy}
              fullWidth
              onClick={() => setStep(2)}
              variant="secondary"
            >
              {t('signup.review.edit')}
            </Button>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="text-body-sm text-text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
