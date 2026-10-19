import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('exposes its title and closes with Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <Dialog
        closeLabel="Close dialog"
        onOpenChange={onOpenChange}
        open
        title="Confirm action"
      >
        <p>Dialog content</p>
      </Dialog>,
    );

    expect(
      screen.getByRole('dialog', { name: 'Confirm action' }),
    ).toBeVisible();
    await user.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
