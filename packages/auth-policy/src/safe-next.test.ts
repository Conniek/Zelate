import { describe, expect, it } from 'vitest';
import { safeNext } from './safe-next.ts';

describe('safeNext', () => {
  it('keeps same-origin paths with query and hash', () => {
    expect(safeNext('/salons/abc?x=1#top')).toBe('/salons/abc?x=1#top');
  });

  it.each([
    null,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    'salons',
  ])('falls back to / for %s', (value) => {
    expect(safeNext(value)).toBe('/');
  });
});
