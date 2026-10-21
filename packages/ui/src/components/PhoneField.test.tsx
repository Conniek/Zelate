import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PhoneField, toNationalDigits } from './PhoneField';

function Harness({ error }: { error?: string }) {
  const [value, setValue] = useState('');
  return (
    <PhoneField
      error={error}
      label="Phone"
      onChange={setValue}
      prefix="+33"
      value={value}
    />
  );
}

describe('toNationalDigits', () => {
  it.each([
    ['06 12 34 56 78', '612345678'],
    ['+33 6 12 34 56 78', '612345678'],
    ['0033612345678', '612345678'],
    ['612345678999', '612345678'],
    ['abc', ''],
  ])('turns %j into %j', (raw, expected) => {
    expect(toNationalDigits(raw)).toBe(expected);
  });
});

describe('PhoneField', () => {
  it('shows the fixed prefix and keeps digits only', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Phone' });
    await userEvent.type(input, '06 12-ab 34');
    expect(input).toHaveValue('61234');
    expect(screen.getByText('+33')).toBeInTheDocument();
  });

  it('normalises a pasted international number', async () => {
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Phone' });
    await userEvent.click(input);
    await userEvent.paste('+33 6 12 34 56 78');
    expect(input).toHaveValue('612345678');
  });

  it('exposes the validation message to assistive technology', () => {
    render(<Harness error="Invalid number" />);
    const input = screen.getByRole('textbox', { name: 'Phone' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Invalid number');
  });
});
