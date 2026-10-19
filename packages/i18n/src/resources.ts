export type TranslationResources = {
  client: typeof import('./fr/client.json');
  common: typeof import('./fr/common.json');
  errors: typeof import('./fr/errors.json');
  legal: typeof import('./fr/legal.json');
  notifications: typeof import('./fr/notifications.json');
  'pro-manager': typeof import('./fr/pro-manager.json');
  'pro-stylist': typeof import('./fr/pro-stylist.json');
};

export type TranslationNamespace = keyof TranslationResources;
