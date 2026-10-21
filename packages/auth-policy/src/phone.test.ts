import { describe, expect, it } from 'vitest';
import { normalizeFrenchMobile } from './phone.ts';

describe('normalizeFrenchMobile (U-03 scenarios 5 and 6)', () => {
  it.each([
    ['06 12 34 56 78', '+33612345678'],
    ['0612345678', '+33612345678'],
    ['+33 6 12 34 56 78', '+33612345678'],
    ['0033612345678', '+33612345678'],
    ['33612345678', '+33612345678'],
    ['612345678', '+33612345678'],
    ['07.12.34.56.78', '+33712345678'],
  ])('accepts %s', (input, e164) => {
    expect(normalizeFrenchMobile(input)).toEqual({ ok: true, e164 });
  });

  it.each([
    '',
    'abc',
    '06 12 34',
    '0512345678',
    '+33 1 23 45 67 89',
    '06123456789',
  ])('rejects %j as invalid', (input) => {
    expect(normalizeFrenchMobile(input)).toEqual({
      ok: false,
      code: 'auth.invalid_phone',
    });
  });

  it.each([
    '+44 7911 123456',
    '+1 415 555 2671',
    '0044 7911 123456',
    '+32 470 12 34 56',
  ])('refuses %s as not supported', (input) => {
    expect(normalizeFrenchMobile(input)).toEqual({
      ok: false,
      code: 'auth.phone_not_supported',
    });
  });
});
