import { beforeAll, describe, expect, it } from 'vitest';
import { initializeClientI18n } from './client';
import { i18next } from './index';

describe('French i18n resources', () => {
  beforeAll(async () => {
    await initializeClientI18n();
  });

  it('loads the shared French dictionary', () => {
    expect(i18next.t('actions.close')).toBe('Fermer');
  });

  it('formats ICU messages', () => {
    expect(
      i18next.t('client:home.search.suggestions_count', { count: 2 }),
    ).toBe('2 suggestions');
  });

  it('does not load unrelated Pro or notification dictionaries into the client app', () => {
    expect(i18next.hasResourceBundle('fr', 'pro-manager')).toBe(false);
    expect(i18next.hasResourceBundle('fr', 'notifications')).toBe(false);
  });
});
