import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CodeField, cleanTicketCode } from './CodeField';

function Harness({
  onComplete,
  error,
}: {
  onComplete: (c: string) => void;
  error?: string;
}) {
  const [value, setValue] = useState('');
  return (
    <>
      <CodeField
        charLabel={(i) => `Char ${i} of 5`}
        error={error}
        hint="Ask the client"
        label="Ticket code"
        onChange={setValue}
        onComplete={onComplete}
        value={value}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const box = (i: number) => screen.getByLabelText(`Char ${i} of 5`);

describe('CodeField (C-05)', () => {
  it('keeps only the ticket alphabet, in capitals', () => {
    expect(cleanTicketCode('ab-1o0 c9z2x')).toBe('ABC9Z');
    expect(cleanTicketCode('kmp')).toBe('KMP');
  });

  it('renders 5 boxes ready for capitals', () => {
    render(<Harness onComplete={() => undefined} />);
    expect(screen.getAllByRole('textbox')).toHaveLength(5);
    expect(box(1)).toHaveAttribute('autocapitalize', 'characters');
    expect(box(1)).toHaveAttribute('inputmode', 'text');
    expect(
      screen.getByRole('group', { name: 'Ticket code' }),
    ).toHaveAccessibleDescription('Ask the client');
  });

  it('moves forward, skips forbidden letters and completes once', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.type(box(1), 'k');
    expect(box(2)).toHaveFocus();
    await userEvent.type(box(2), 'O');
    expect(screen.getByTestId('value')).toHaveTextContent(/^K$/);
    await userEvent.type(box(2), 'm2pq');
    expect(screen.getByTestId('value')).toHaveTextContent('KM2PQ');
    expect(onComplete).toHaveBeenCalledExactlyOnceWith('KM2PQ');
  });

  it('accepts a pasted code and goes back with Backspace', async () => {
    const onComplete = vi.fn();
    render(<Harness onComplete={onComplete} />);
    await userEvent.click(box(1));
    await userEvent.paste('ab2cd');
    expect(onComplete).toHaveBeenCalledWith('AB2CD');
    await userEvent.click(box(5));
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByTestId('value')).toHaveTextContent(/^AB2C?$/);
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
  });

  it('shows the error to assistive technologies', () => {
    render(<Harness error="Unknown code" onComplete={() => undefined} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown code');
    expect(box(1)).toHaveAttribute('aria-invalid', 'true');
  });
});
