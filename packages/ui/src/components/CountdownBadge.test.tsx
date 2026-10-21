import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountdownBadge } from './CountdownBadge';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('CountdownBadge (C-04, C-09)', () => {
  it('shows mm:ss, warns from 5 min and announces only at 5 and 1 min', () => {
    let now = 0;
    const clock = () => now;
    const { container } = render(
      <CountdownBadge
        announce={(m) => `${m} min left`}
        deadline={10 * 60_000}
        label="Release in"
        now={clock}
      />,
    );
    const badge = container.firstElementChild!;
    const live = container.querySelector('[aria-live]')!;
    const tick = (to: number) => {
      now = to;
      act(() => vi.advanceTimersByTime(1000));
    };

    expect(badge).toHaveTextContent('10:00');
    expect(live).toHaveTextContent('');
    expect(badge.className).not.toContain('warning');

    tick(4 * 60_000);
    expect(badge).toHaveTextContent('06:00');
    expect(live).toHaveTextContent('');

    tick(5 * 60_000);
    expect(badge).toHaveTextContent('05:00');
    expect(live).toHaveTextContent('5 min left');
    expect(badge.className).toContain('warning');

    tick(9 * 60_000 + 30_000);
    expect(badge).toHaveTextContent('00:30');
    expect(live).toHaveTextContent('1 min left');

    tick(11 * 60_000);
    expect(badge).toHaveTextContent('00:00');
  });
});
