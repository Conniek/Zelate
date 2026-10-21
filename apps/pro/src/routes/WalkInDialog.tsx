import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, Dialog, PhoneField, TextField } from '@zelate/ui';
import type { BoardStylist } from '../lib/board-api';
import type { ServiceOption } from '../lib/queue-api';
import { useCommand } from '../lib/use-command';

interface Props {
  announce: (message: string) => void;
  disabled: boolean;
  salonId: string;
  services: ServiceOption[];
  stylists: BoardStylist[];
}

const EMPTY = { firstName: '', phone: '', serviceId: '', stylistId: '' };
const FIRST_NAME_ID = 'walkin-first-name';
const PHONE_ID = 'walkin-contact';

/**
 * F-M7: « Client à l'accueil », opened by the button or Alt+Shift+N. A single
 * letter would fire while typing elsewhere or with voice control (WCAG 2.1.4).
 */
export function WalkInDialog({
  announce,
  disabled,
  salonId,
  services,
  stylists,
}: Props) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const { busy, error, run, setError } = useCommand();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    phone?: string;
  }>({});

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'KeyN' || !event.altKey || !event.shiftKey) return;
      if (event.ctrlKey || event.metaKey || disabled) return;
      // Never over another dialog (ticket panel, absence form).
      if (document.querySelector('[role="dialog"]')) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled]);

  const change = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setForm(EMPTY);
      setFieldErrors({});
      setError(null);
    }
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    const errors = {
      ...(form.firstName.trim() === ''
        ? { firstName: tErrors('validation.required') }
        : {}),
      ...(form.phone.length !== 9
        ? { phone: tErrors('validation.phone_format') }
        : {}),
    };
    setFieldErrors(errors);
    if (errors.firstName || errors.phone) {
      document
        .getElementById(errors.firstName ? FIRST_NAME_ID : PHONE_ID)
        ?.focus();
      return;
    }
    const outcome = await run(
      'register_walk_in',
      {
        first_name: form.firstName.trim(),
        phone: `0${form.phone}`,
        ...(form.serviceId ? { service_id: form.serviceId } : {}),
        ...(form.stylistId ? { requested_member_id: form.stylistId } : {}),
      },
      salonId,
    );
    if (!outcome.ok) return;
    announce(t('walk_in.success', { first_name: form.firstName.trim() }));
    // Typed by the salon for someone else: nothing of it stays on screen.
    change(false);
  }

  return (
    <>
      <Button
        aria-describedby={disabled ? 'board-offline' : undefined}
        aria-disabled={disabled || undefined}
        aria-keyshortcuts="Alt+Shift+N"
        onClick={() => setOpen(true)}
      >
        {t('walk_in.open')}
      </Button>
      <Dialog
        closeLabel={tCommon('actions.close')}
        description={t('walk_in.shortcut')}
        onOpenChange={change}
        open={open}
        title={t('walk_in.title')}
      >
        <form
          autoComplete="off"
          className="grid gap-4"
          noValidate
          onSubmit={submit}
        >
          <TextField
            autoComplete="off"
            error={fieldErrors.firstName}
            id={FIRST_NAME_ID}
            label={t('walk_in.first_name')}
            maxLength={30}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            value={form.firstName}
          />
          {/* Someone else's number: the browser must not keep it (H6, ADR-007). */}
          <PhoneField
            autoComplete="off"
            error={fieldErrors.phone}
            id={PHONE_ID}
            name={PHONE_ID}
            helpText={t('walk_in.phone_hint')}
            label={t('walk_in.phone')}
            onChange={(digits) => setForm({ ...form, phone: digits })}
            prefix="+33"
            value={form.phone}
          />
          <label className="grid gap-2">
            <span className="font-semibold">{t('walk_in.service')}</span>
            <select
              className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
              onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
              value={form.serviceId}
            >
              <option value="" />
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </select>
            <span className="text-body-sm text-text-muted">
              {t('walk_in.service_hint')}
            </span>
          </label>
          <label className="grid gap-2">
            <span className="font-semibold">{t('walk_in.stylist')}</span>
            <select
              className="min-h-12 rounded-lg border border-border-strong bg-surface px-3"
              onChange={(e) => setForm({ ...form, stylistId: e.target.value })}
              value={form.stylistId}
            >
              <option value="">{tCommon('first_available')}</option>
              {stylists.map((stylist) => (
                <option key={stylist.member_id} value={stylist.member_id}>
                  {stylist.first_name}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <Banner role="alert" tone="danger">
              {error}
            </Banner>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button onClick={() => change(false)} variant="secondary">
              {tCommon('actions.cancel')}
            </Button>
            <Button loading={busy !== null} type="submit">
              {t('walk_in.submit')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
