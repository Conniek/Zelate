import client from './fr/client.json';
import common from './fr/common.json';
import errors from './fr/errors.json';
import legal from './fr/legal.json';
import { initializeI18n } from './index';

export function initializeClientI18n(): Promise<void> {
  return initializeI18n({
    fr: {
      client,
      common,
      errors,
      legal,
    },
  });
}
