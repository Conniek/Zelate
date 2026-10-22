import client from '../../../packages/i18n/src/fr/client.json' with { type: 'json' };
import common from '../../../packages/i18n/src/fr/common.json' with { type: 'json' };
import errors from '../../../packages/i18n/src/fr/errors.json' with { type: 'json' };
import legal from '../../../packages/i18n/src/fr/legal.json' with { type: 'json' };
import proManager from '../../../packages/i18n/src/fr/pro-manager.json' with { type: 'json' };
import proStylist from '../../../packages/i18n/src/fr/pro-stylist.json' with { type: 'json' };

const NAMESPACES: Record<string, unknown> = {
  client,
  common,
  errors,
  legal,
  'pro-manager': proManager,
  'pro-stylist': proStylist,
};

/** French copy straight from the i18n package, so the test follows wording changes. */
export function fr(
  namespace: keyof typeof NAMESPACES,
  key: string,
  values: Record<string, string | number> = {},
): string {
  let node: unknown = NAMESPACES[namespace];
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof node !== 'string')
    throw new Error(`missing copy ${namespace}:${key}`);
  return node.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  );
}
