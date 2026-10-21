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
    // Still focusable, so the keyboard focus is not lost mid-action.
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAttribute('aria-busy', 'true');

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('aria-disabled keeps the focus and ignores clicks', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button aria-disabled onClick={onClick}>
        Call
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Call' });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
    button.focus();
    expect(button).toHaveFocus();
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
