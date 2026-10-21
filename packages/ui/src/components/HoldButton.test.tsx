import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HoldButton } from './HoldButton';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(disabled = false) {
  const onHold = vi.fn();
  const onRequestConfirm = vi.fn();
  render(
    <HoldButton
      disabled={disabled}
      hint="Hold to finish"
      onHold={onHold}
      onRequestConfirm={onRequestConfirm}
    >
      Finish
    </HoldButton>,
  );
  return {
    button: screen.getByRole('button', { name: 'Finish' }),
    onHold,
    onRequestConfirm,
  };
}

describe('HoldButton (C-08)', () => {
  it('fires after 600 ms of pressing, not before', () => {
    const { button, onHold } = setup();
    expect(button).toHaveAccessibleDescription('Hold to finish');
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(599));
    expect(onHold).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onHold).toHaveBeenCalledOnce();
  });

  it('leaving the button during the hold cancels it', () => {
    const { button, onHold } = setup();
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(300));
    fireEvent.pointerLeave(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(onHold).not.toHaveBeenCalled();
    expect(screen.getByTestId('hold-fill').style.width).toBe('0%');
  });

  it('a quick tap, a screen reader or the keyboard ask for a confirmation', () => {
    const { button, onHold, onRequestConfirm } = setup();
    fireEvent.pointerDown(button);
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(onRequestConfirm).toHaveBeenCalledOnce();
    fireEvent.click(button); // a click alone: screen reader double-tap, Enter, Space
    expect(onRequestConfirm).toHaveBeenCalledTimes(2);
    expect(onHold).not.toHaveBeenCalled();
  });

  it('the click that ends a full hold does not ask again', () => {
    const { button, onHold, onRequestConfirm } = setup();
    fireEvent.pointerDown(button);
    act(() => vi.advanceTimersByTime(600));
    fireEvent.pointerUp(button);
    fireEvent.click(button);
    expect(onHold).toHaveBeenCalledOnce();
    expect(onRequestConfirm).not.toHaveBeenCalled();
  });

  it('does nothing while disabled', () => {
    const { button, onHold, onRequestConfirm } = setup(true);
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    act(() => vi.advanceTimersByTime(1000));
    expect(onHold).not.toHaveBeenCalled();
    expect(onRequestConfirm).not.toHaveBeenCalled();
  });
});
