import common from './fr/common.json';
import errors from './fr/errors.json';
import legal from './fr/legal.json';
import proManager from './fr/pro-manager.json';
import proStylist from './fr/pro-stylist.json';
import { initializeI18n } from './index';

export function initializeProI18n(): Promise<void> {
  return initializeI18n({
    fr: {
      common,
      errors,
      legal,
      'pro-manager': proManager,
      'pro-stylist': proStylist,
    },
  });
}
