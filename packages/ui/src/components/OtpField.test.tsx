import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OtpField } from './OtpField';

function Harness({
  disabled,
  error,
  onComplete,
}: {
  disabled?: boolean;
  error?: string;
  onComplete: (code: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <OtpField
      digitLabel={(index) => `Digit ${index} of 6`}
      disabled={disabled}
      error={error}
      label="Code"
      onChange={setValue}
      onComplete={onComplete}
      value={value}
    />
  );
}

const box = (index: number) => screen.getByLabelText(`Digit ${index} of 6`);

describe('OtpField (U-03 scenario 2)', () => {
  it('renders 6 labelled boxes, the first one ready for SMS autofill', () => {
    render(<Harness onComplete={() => undefined} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
    expect(box(1)).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('moves forward while typing and completes on the 6th digit', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.keyboard('12345');
    expect(onComplete).not.toHaveBeenCalled();
    expect(box(6)).toHaveFocus();
    await userEvent.keyboard('6');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
  });

  it('fills every box from a pasted code', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.paste('123 456');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('123456');
    expect(box(4)).toHaveValue('4');
  });

  it('accepts the whole code written at once by the SMS autofill', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.type(box(1), '654321');
    expect(onComplete).toHaveBeenCalledWith('654321');
  });

  it('ignores letters', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.keyboard('ab1');
    expect(box(1)).toHaveValue('1');
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('goes back and erases with Backspace, then arrows move focus', async () => {
    render(<Harness onComplete={() => undefined} />);
    await userEvent.click(box(1));
    await userEvent.keyboard('123');
    expect(box(4)).toHaveFocus();
    await userEvent.keyboard('{Backspace}');
    expect(box(3)).toHaveFocus();
    expect(box(3)).toHaveValue('');
    await userEvent.keyboard('{ArrowLeft}');
    expect(box(2)).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(box(3)).toHaveFocus();
  });

  it('clears a digit that is typed over by an empty value', async () => {
    render(<Harness onComplete={() => undefined} />);
    await userEvent.click(box(1));
    await userEvent.keyboard('12');
    await userEvent.clear(box(2));
    expect(box(2)).toHaveValue('');
    expect(box(1)).toHaveValue('1');
  });

  it('shows an alert and marks the boxes invalid on error', () => {
    render(<Harness error="Wrong code" onComplete={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Wrong code');
    expect(box(1)).toHaveAttribute('aria-invalid', 'true');
  });

  it('is not editable when disabled', async () => {
    const onComplete = vi.fn();
    render(<Harness disabled onComplete={onComplete} />);
    await userEvent.type(box(1), '123456');
    expect(onComplete).not.toHaveBeenCalled();
  });
});
