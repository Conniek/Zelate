import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Toast, ToastProvider } from './Toast';

describe('Toast', () => {
  it('announces the title and description as a status message', () => {
    render(
      <ToastProvider label="Notifications (F8)">
        <Toast
          closeLabel="Close"
          description="The queue was updated"
          open
          title="Saved"
        />
      </ToastProvider>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('The queue was updated')).toBeInTheDocument();
  });
});
