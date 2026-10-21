import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SUGGESTION_DEFAULTS,
  canDeactivate,
  centsToPrice,
  priceToCents,
  validateService,
} from '@zelate/salon-setup';
import { Banner, Button, TextField } from '@zelate/ui';
import {
  createService,
  loadServices,
  loadSpecialties,
  updateService,
} from '../lib/setup-api';
import type { ServiceRow } from '../lib/setup-api';

interface Draft {
  id: string | null;
  name: string;
  duration: string;
  price: string;
  specialty: string;
  isActive: boolean;
}

const EMPTY: Draft = {
  id: null,
  name: '',
  duration: '30',
  price: '',
  specialty: '',
  isActive: true,
};

export function SetupServices({ salonId }: { salonId: string }) {
  const { t } = useTranslation('pro-manager');
  const { t: tCommon } = useTranslation('common');
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const { data: services = [], isSuccess } = useQuery({
    queryKey: ['services', salonId],
    queryFn: () => loadServices(salonId),
  });
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: loadSpecialties,
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['services', salonId] });
  }

  function edit(service: ServiceRow) {
    setSaved(false);
    setError(null);
    setDraft({
      id: service.id,
      name: service.name,
      duration: String(service.duration_minutes),
      price: centsToPrice(service.price_cents),
      specialty: service.required_specialty_code ?? '',
      isActive: service.is_active,
    });
  }

  async function save() {
    if (!draft) return;
    const priceCents = priceToCents(draft.price);
    const input = {
      name: draft.name,
      durationMinutes: Number(draft.duration),
      priceCents: priceCents ?? -1,
    };
    const code = validateService(input);
    if (code) {
      setError(tErrors(code));
      return;
    }
    if (
      draft.id &&
      !draft.isActive &&
      !canDeactivate(
        services.map((s) => ({ id: s.id, isActive: s.is_active })),
        draft.id,
      )
    ) {
      setError(tErrors('validation.at_least_one_active_service'));
      return;
    }
    const write = {
      ...input,
      specialty: draft.specialty === '' ? null : draft.specialty,
      isActive: draft.isActive,
    };
    const ok = draft.id
      ? await updateService(draft.id, write)
      : await createService(salonId, write, services.length + 1);
    if (!ok) {
      setError(tErrors('generic.unexpected'));
      return;
    }
    setError(null);
    setSaved(true);
    setDraft(null);
    await refresh();
  }

  async function addSuggestions() {
    let order = services.length;
    for (const code of picked) {
      const defaults = SUGGESTION_DEFAULTS[code];
      if (!defaults) continue;
      order += 1;
      await createService(
        salonId,
        {
          name: t(
            `services.suggestions.${code}` as 'services.suggestions.beard',
          ),
          ...defaults,
          specialty: code,
          isActive: true,
        },
        order,
      );
    }
    setPicked([]);
    setSaved(true);
    await refresh();
  }

  return (
    <section aria-labelledby="services-title" className="grid gap-4">
      <h2 className="text-h2" id="services-title">
        {t('services.title')}
      </h2>
      {isSuccess && services.length === 0 && (
        <div className="grid gap-3">
          <p className="text-body-sm">{t('services.suggestions_intro')}</p>
          {Object.keys(SUGGESTION_DEFAULTS).map((code) => (
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
              {t(
                `services.suggestions.${code}` as 'services.suggestions.beard',
              )}
            </label>
          ))}
          <Button
            disabled={picked.length === 0}
            onClick={() => void addSuggestions()}
          >
            {t('services.suggested_add')}
          </Button>
        </div>
      )}
      <ul className="grid gap-2">
        {services.map((service) => (
          <li className="flex flex-wrap items-center gap-3" key={service.id}>
            <span className={service.is_active ? '' : 'text-text-muted'}>
              {t('services.summary', {
                name: service.name,
                duration: service.duration_minutes,
                price: centsToPrice(service.price_cents),
              })}
            </span>
            <Button onClick={() => edit(service)} variant="ghost">
              {t('services.edit')}
            </Button>
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="grid gap-3 rounded-lg border p-4">
          <TextField
            label={t('services.field.name')}
            maxLength={60}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            value={draft.name}
          />
          <TextField
            helpText={t('services.field.duration_hint')}
            inputMode="numeric"
            label={t('services.field.duration')}
            onChange={(event) =>
              setDraft({ ...draft, duration: event.target.value })
            }
            value={draft.duration}
          />
          <TextField
            inputMode="decimal"
            label={t('services.field.price')}
            onChange={(event) =>
              setDraft({ ...draft, price: event.target.value })
            }
            value={draft.price}
          />
          <label className="grid gap-2 font-semibold text-body-sm">
            {t('services.field.specialty')}
            <select
              className="min-h-12 rounded-lg border border-border-strong bg-surface px-4 text-body"
              onChange={(event) =>
                setDraft({ ...draft, specialty: event.target.value })
              }
              value={draft.specialty}
            >
              <option value="">{t('services.field.specialty_none')}</option>
              {specialties.map((code) => (
                <option key={code} value={code}>
                  {tCommon(`specialties.${code}` as 'specialties.beard')}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3">
            <input
              checked={draft.isActive}
              onChange={(event) =>
                setDraft({ ...draft, isActive: event.target.checked })
              }
              type="checkbox"
            />
            {t('services.active')}
          </label>
          <div className="flex gap-3">
            <Button onClick={() => void save()}>{t('services.save')}</Button>
            <Button onClick={() => setDraft(null)} variant="ghost">
              {t('services.cancel_edit')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          onClick={() => {
            setSaved(false);
            setError(null);
            setDraft(EMPTY);
          }}
          variant="secondary"
        >
          {t('services.add')}
        </Button>
      )}
      {error && (
        <Banner role="alert" tone="danger">
          {error}
        </Banner>
      )}
      {saved && (
        <Banner role="status" tone="success">
          {t('services.saved')}
        </Banner>
      )}
    </section>
  );
}
