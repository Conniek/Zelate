import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner } from './Banner';

describe('Banner', () => {
  it('uses the requested accessible urgency role', () => {
    render(
      <Banner role="alert" tone="danger">
        Connection lost
      </Banner>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Connection lost');
  });
});
