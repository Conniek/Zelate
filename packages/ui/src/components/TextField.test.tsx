import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('connects the visible label and validation message to the input', () => {
    render(
      <TextField
        error="Enter a valid value"
        label="Phone number"
        name="phone"
      />,
    );

    const input = screen.getByRole('textbox', { name: 'Phone number' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid value');
  });
});
