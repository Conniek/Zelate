import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AddressField } from './AddressField';
import type { AddressSuggestion } from './AddressField';

const suggestion: AddressSuggestion = {
  label: '1 Rue de la Paix 75002 Paris',
  addressLine: '1 Rue de la Paix',
  postalCode: '75002',
  city: 'Paris',
  cityCode: '75102',
  longitude: 2.331,
  latitude: 48.869,
};

function setup(found: AddressSuggestion[] = [suggestion]) {
  const onSearch = vi.fn().mockResolvedValue(found);
  const onSelect = vi.fn();
  render(
    <AddressField
      debounceMs={0}
      label="Adresse"
      noResultsText="Aucune adresse trouvée"
      onSearch={onSearch}
      onSelect={onSelect}
    />,
  );
  return { onSearch, onSelect, input: screen.getByRole('combobox') };
}

describe('AddressField', () => {
  it('does not search below the minimum length', () => {
    const { onSearch, input } = setup();
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(onSearch).not.toHaveBeenCalled();
  });

  it('selects a suggestion with the mouse', async () => {
    const { onSelect, input } = setup();
    fireEvent.change(input, { target: { value: '1 rue de la' } });
    fireEvent.click(
      await screen.findByRole('option', { name: suggestion.label }),
    );
    expect(onSelect).toHaveBeenLastCalledWith(suggestion);
    expect(input).toHaveValue(suggestion.label);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('selects with the keyboard and clears the choice on edit', async () => {
    const { onSelect, input } = setup();
    fireEvent.change(input, { target: { value: '1 rue de la' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      expect.stringContaining('-0'),
    );
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(suggestion);
    fireEvent.change(input, { target: { value: '1 rue de la P' } });
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('wraps around with the arrow keys and closes on Escape', async () => {
    const { input } = setup();
    fireEvent.change(input, { target: { value: '1 rue de la' } });
    await screen.findByRole('listbox');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('says so when nothing matches or the search fails', async () => {
    const { input } = setup([]);
    fireEvent.change(input, { target: { value: 'zzzzz' } });
    expect(await screen.findByText('Aucune adresse trouvée')).toBeVisible();
  });

  it('treats a failing search as no result', async () => {
    const onSearch = vi.fn().mockRejectedValue(new Error('down'));
    render(
      <AddressField
        debounceMs={0}
        label="Adresse"
        noResultsText="Aucune adresse trouvée"
        onSearch={onSearch}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'rue' },
    });
    await waitFor(() =>
      expect(screen.getByText('Aucune adresse trouvée')).toBeVisible(),
    );
  });
});
