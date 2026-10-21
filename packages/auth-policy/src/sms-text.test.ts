import { describe, expect, it } from 'vitest';
import notifications from '../../i18n/src/fr/notifications.json' with { type: 'json' };
import { gsm7Length, otpSmsText } from './sms-text.ts';

describe('otpSmsText (U-03 scenario 14)', () => {
  it('matches the dictionary template', () => {
    expect(otpSmsText('123456')).toBe(
      notifications.auth.otp_code.sms.replaceAll('{code}', '123456'),
    );
  });

  it('fits one GSM-7 SMS and ends with the autofill line', () => {
    const text = otpSmsText('123456');
    const length = gsm7Length(text);
    expect(length).not.toBeNull();
    expect(length).toBeLessThanOrEqual(160);
    expect(text.endsWith('@zelate.fr #123456')).toBe(true);
  });

  it('counts extended characters twice and flags non GSM-7 text', () => {
    expect(gsm7Length('a{b')).toBe(4);
    expect(gsm7Length('œ')).toBeNull();
  });
});
