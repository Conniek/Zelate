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

/** F-M7: « Client à l'accueil », opened by the button or the `N` key. */
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
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey) {
        return;
      }
      if (event.altKey || disabled) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
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
    if (Object.keys(errors).length > 0) return;
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
    change(false);
  }

  return (
    <>
      <Button
        aria-keyshortcuts="N"
        disabled={disabled}
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
        <form className="grid gap-4" noValidate onSubmit={submit}>
          <TextField
            autoComplete="off"
            error={fieldErrors.firstName}
            label={t('walk_in.first_name')}
            maxLength={30}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            value={form.firstName}
          />
          <PhoneField
            error={fieldErrors.phone}
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
            <Button disabled={busy !== null} type="submit">
              {t('walk_in.submit')}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
