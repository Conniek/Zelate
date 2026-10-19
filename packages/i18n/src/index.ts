import type {} from './i18next';
import ICU from 'i18next-icu';
import i18next from 'i18next';
import type { Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';

let initialization: Promise<void> | undefined;

export function initializeI18n(resources: Resource): Promise<void> {
  initialization ??= i18next
    .use(ICU)
    .use(initReactI18next)
    .init({
      defaultNS: 'common',
      fallbackLng: false,
      interpolation: {
        escapeValue: false,
      },
      lng: 'fr',
      ns: Object.keys(resources.fr ?? {}),
      resources,
      returnNull: false,
      showSupportNotice: false,
    })
    .then(() => undefined);

  return initialization;
}

export { i18next };
