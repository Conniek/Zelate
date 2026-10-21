import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from './useCountdown';

describe('useCountdown (U-03 scenario 10)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is idle until started, then counts 30 s down to unlock', () => {
    const { result } = renderHook(() => useCountdown(30));
    expect(result.current).toMatchObject({ remaining: 0, isRunning: false });

    act(() => result.current.start());
    expect(result.current).toMatchObject({ remaining: 30, isRunning: true });

    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(result.current.remaining).toBe(18);

    act(() => {
      vi.advanceTimersByTime(18_000);
    });
    expect(result.current).toMatchObject({ remaining: 0, isRunning: false });
  });

  it('restarts the countdown on a new send', () => {
    const { result } = renderHook(() => useCountdown(30));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    act(() => result.current.start());
    expect(result.current.remaining).toBe(30);
  });
});
