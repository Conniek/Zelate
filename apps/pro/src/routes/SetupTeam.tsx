import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banner, Button, TextField } from '@zelate/ui';
import { inviteMember, loadTeam } from '../lib/team-api';
import { loadSpecialties } from '../lib/setup-api';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function SetupTeam({ salonId }: { salonId: string }) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const { data: team = [] } = useQuery({
    queryKey: ['team', salonId],
    queryFn: () => loadTeam(salonId),
  });
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: loadSpecialties,
  });
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    const errors: Record<string, string> = {};
    if (firstName.trim() === '')
      errors.firstName = tErrors('validation.required');
    if (lastName.trim() === '')
      errors.lastName = tErrors('validation.required');
    if (!EMAIL.test(email.trim()))
      errors.email = tErrors('validation.required');
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;
    if (picked.length === 0) {
      setError(tErrors('team.specialty_required'));
      return;
    }
    setBusy(true);
    const outcome = await inviteMember({
      firstName,
      lastName,
      email,
      specialties: picked,
    });
    setBusy(false);
    if (!outcome.ok) {
      setError(
        tErrors(
          outcome.messageKey.replace(/^errors\./, '') as 'generic.unexpected',
        ),
      );
      return;
    }
    setSentTo(email.trim());
    setOpen(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPicked([]);
    await queryClient.invalidateQueries({ queryKey: ['team', salonId] });
  }

  return (
    <section aria-labelledby="team-title" className="grid gap-4">
      <h2 className="text-h2" id="team-title">
        {t('team.title')}
      </h2>
      {team.length === 0 && (
        <p className="text-body-sm text-text-muted">{t('team.empty')}</p>
      )}
      <ul className="grid gap-2">
        {team.map((member) => (
          <li className="flex flex-wrap items-center gap-3" key={member.id}>
            <span>
              {member.first_name} {member.last_name}
            </span>
            <span className="text-body-sm text-text-muted">
              {t(`team.status.${member.status}`)}
            </span>
          </li>
        ))}
      </ul>
      {team.length > 0 && (
        <p className="text-body-sm text-text-muted">
          {t('setup.team_phones.reminder')}
        </p>
      )}
      {sentTo && (
        <Banner role="status" tone="success">
          {t('team.invite_sent', { email: sentTo })}
        </Banner>
      )}
      {open ? (
        <div className="grid gap-3 rounded-lg border p-4">
          <TextField
            error={fieldErrors.firstName}
            label={t('team.form.first_name')}
            maxLength={30}
            onChange={(event) => setFirstName(event.target.value)}
            value={firstName}
          />
          <TextField
            error={fieldErrors.lastName}
            label={t('team.form.last_name')}
            maxLength={50}
            onChange={(event) => setLastName(event.target.value)}
            value={lastName}
          />
          <TextField
            autoComplete="off"
            error={fieldErrors.email}
            label={t('team.form.email')}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
          <fieldset className="grid gap-2">
            <legend className="font-semibold text-body-sm">
              {t('team.form.specialties')}
            </legend>
            <p className="text-body-sm text-text-muted">
              {t('team.form.specialties_hint')}
            </p>
            {specialties.map((code) => (
              <label className="flex items-center gap-3" key={code}>
                <input
                  checked={picked.includes(code)}
                  onChange={(event) =>
                    setPicked(
                      event.target.checked
                        ? [...picked, code]
                        : picked.filter((c) => c !== code),
                    )
                  }
                  type="checkbox"
                />
                {tCommon(`specialties.${code}` as 'specialties.beard')}
              </label>
            ))}
          </fieldset>
          {error && (
            <Banner role="alert" tone="danger">
              {error}
            </Banner>
          )}
          <div className="flex gap-3">
            <Button loading={busy} onClick={() => void submit()}>
              {t('team.form.submit')}
            </Button>
            <Button onClick={() => setOpen(false)} variant="ghost">
              {t('team.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => {
            setSentTo(null);
            setError(null);
            setFieldErrors({});
            setOpen(true);
          }}
          variant="secondary"
        >
          {t('team.add')}
        </Button>
      )}
      {!open && error && (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      )}
    </section>
  );
}
