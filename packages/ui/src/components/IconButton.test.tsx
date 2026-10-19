import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IconButton } from './IconButton';

describe('IconButton', () => {
  it('requires and exposes an accessible name', () => {
    render(
      <IconButton aria-label="Close">
        <svg aria-hidden="true" />
      </IconButton>,
    );

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });
});
