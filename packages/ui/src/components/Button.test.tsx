import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('preserves its label and disables interaction while loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('supports full-width and destructive variants', () => {
    render(
      <Button fullWidth variant="danger">
        Remove
      </Button>,
    );

    expect(screen.getByRole('button', { name: 'Remove' })).toHaveClass(
      'w-full',
      'bg-danger',
    );
  });
});
