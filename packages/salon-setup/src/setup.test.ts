import { describe, expect, it } from 'vitest';
import {
  canDeactivate,
  centsToPrice,
  copyToWeek,
  priceToCents,
  toHm,
  validateClosure,
  validateDay,
  validateService,
  validateWeek,
} from './index.ts';

describe('hours', () => {
  it('accepts several ranges in a day, touching ones included', () => {
    expect(
      validateDay([
        { opens: '09:00', closes: '12:00' },
        { opens: '12:00', closes: '19:00' },
      ]),
    ).toBeNull();
  });
  it('refuses a range that closes before or when it opens', () => {
    for (const closes of ['08:00', '09:00']) {
      expect(validateDay([{ opens: '09:00', closes }])).toBe(
        'validation.hours_order',
      );
    }
    expect(validateDay([{ opens: '9h', closes: '12:00' }])).toBe(
      'validation.hours_order',
    );
  });
  it('refuses overlapping ranges, whatever the order', () => {
    expect(
      validateDay([
        { opens: '11:00', closes: '15:00' },
        { opens: '09:00', closes: '12:00' },
      ]),
    ).toBe('validation.hours_overlap');
  });
  it('needs at least one open day', () => {
    expect(validateWeek({})).toBe('validation.at_least_one_open_day');
    expect(
      validateWeek({ 1: [{ opens: '09:00', closes: '19:00' }] }),
    ).toBeNull();
    expect(validateWeek({ 2: [{ opens: '10:00', closes: '09:00' }] })).toBe(
      'validation.hours_order',
    );
  });
  it('copies a day onto the whole week without sharing objects', () => {
    const week = copyToWeek({ 1: [{ opens: '09:00', closes: '19:00' }] }, 1);
    expect(Object.keys(week)).toHaveLength(7);
    expect(week[7]).toEqual([{ opens: '09:00', closes: '19:00' }]);
    expect(week[7]?.[0]).not.toBe(week[1]?.[0]);
    expect(copyToWeek({}, 3)[1]).toEqual([]);
  });
  it('trims database times', () => {
    expect(toHm('09:00:00')).toBe('09:00');
  });
});

describe('closures', () => {
  it('accepts one day and a period', () => {
    expect(
      validateClosure({ startsOn: '2026-12-24', endsOn: '2026-12-24' }),
    ).toBeNull();
    expect(
      validateClosure({
        startsOn: '2026-12-24',
        endsOn: '2026-12-26',
        reason: 'Congés',
      }),
    ).toBeNull();
  });
  it('refuses inverted or malformed dates', () => {
    expect(
      validateClosure({ startsOn: '2026-12-26', endsOn: '2026-12-24' }),
    ).toBe('validation.closure_dates');
    expect(validateClosure({ startsOn: '', endsOn: '2026-12-24' })).toBe(
      'validation.closure_dates',
    );
  });
  it('limits the reason to 120 characters', () => {
    const base = { startsOn: '2026-12-24', endsOn: '2026-12-24' };
    expect(validateClosure({ ...base, reason: 'a'.repeat(120) })).toBeNull();
    expect(validateClosure({ ...base, reason: 'a'.repeat(121) })).toBe(
      'validation.closure_reason_length',
    );
  });
});

describe('services', () => {
  const ok = { name: 'Coupe homme', durationMinutes: 30, priceCents: 2500 };
  it('accepts valid services, price 0 and the duration limits', () => {
    expect(validateService(ok)).toBeNull();
    expect(validateService({ ...ok, priceCents: 0 })).toBeNull();
    expect(validateService({ ...ok, durationMinutes: 15 })).toBeNull();
    expect(validateService({ ...ok, durationMinutes: 180 })).toBeNull();
  });
  it('refuses a bad name, duration or price', () => {
    expect(validateService({ ...ok, name: ' a ' })).toBe(
      'validation.service_name',
    );
    expect(validateService({ ...ok, name: 'a'.repeat(61) })).toBe(
      'validation.service_name',
    );
    for (const durationMinutes of [10, 185, 32, 30.5]) {
      expect(validateService({ ...ok, durationMinutes })).toBe(
        'validation.service_duration',
      );
    }
    expect(validateService({ ...ok, priceCents: -1 })).toBe(
      'validation.service_price',
    );
  });
  it('converts prices', () => {
    expect(priceToCents('12,50')).toBe(1250);
    expect(priceToCents(' 12.5 ')).toBe(1250);
    expect(priceToCents('0')).toBe(0);
    expect(priceToCents('abc')).toBeNull();
    expect(priceToCents('1.234')).toBeNull();
    expect(centsToPrice(1250)).toBe('12,50');
  });
  it('keeps at least one active service', () => {
    const list = [
      { id: 'a', isActive: true },
      { id: 'b', isActive: false },
    ];
    expect(canDeactivate(list, 'a')).toBe(false);
    expect(canDeactivate([...list, { id: 'c', isActive: true }], 'a')).toBe(
      true,
    );
  });
});
