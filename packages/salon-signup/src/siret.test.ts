import { describe, expect, it } from 'vitest';
import { checkSiret, isValidSiretFormat, normalizeSiret } from './siret.ts';
import { fakeLookup, hairSalon } from './testing.ts';

describe('siret format', () => {
  it('strips spaces', () => {
    expect(normalizeSiret('123 456 789\u00a001234')).toBe('12345678901234');
  });
  it('requires exactly 14 digits', () => {
    expect(isValidSiretFormat('12345678901234')).toBe(true);
    expect(isValidSiretFormat('1234567890123')).toBe(false);
    expect(isValidSiretFormat('123456789012345')).toBe(false);
    expect(isValidSiretFormat('1234567890123a')).toBe(false);
  });
});

describe('checkSiret', () => {
  it('is valid for an active 96.02A or 96.02B', async () => {
    expect((await checkSiret(fakeLookup(hairSalon), 'x')).result).toBe('valid');
    const b = fakeLookup({ ...hairSalon, naf: '96.02B' });
    expect((await checkSiret(b, 'x')).result).toBe('valid');
  });
  it('flags another NAF code', async () => {
    const l = fakeLookup({ ...hairSalon, naf: '47.11F' });
    expect((await checkSiret(l, 'x')).result).toBe('naf_mismatch');
  });
  it('flags a closed establishment', async () => {
    const l = fakeLookup({ ...hairSalon, administrativeState: 'F' });
    expect((await checkSiret(l, 'x')).result).toBe('inactive');
  });
  it('flags an unknown SIRET', async () => {
    const r = await checkSiret(fakeLookup(null), 'x');
    expect(r).toEqual({ result: 'not_found', establishment: null });
  });
  it('flags an unavailable service as error', async () => {
    const r = await checkSiret(fakeLookup(new Error('down')), 'x');
    expect(r.result).toBe('error');
  });
});
