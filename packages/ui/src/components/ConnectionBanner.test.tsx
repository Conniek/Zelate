import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConnectionBanner } from './ConnectionBanner';

describe('ConnectionBanner', () => {
  it('is an alert while the connection is lost, absent otherwise', () => {
    const { rerender } = render(
      <ConnectionBanner lost lostLabel="Connection lost" />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
    rerender(<ConnectionBanner lost={false} lostLabel="Connection lost" />);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
