import { useEffect, useId, useRef, useState } from 'react';
import { TextField } from './TextField';

export interface AddressSuggestion {
  label: string;
  addressLine: string;
  postalCode: string;
  city: string;
  cityCode: string;
  longitude: number;
  latitude: number;
}

export interface AddressFieldProps {
  label: string;
  helpText?: string | undefined;
  error?: string | undefined;
  /** Text shown while no suggestion is chosen yet, e.g. the saved address. */
  initialValue?: string | undefined;
  noResultsText: string;
  onSearch: (query: string) => Promise<AddressSuggestion[]>;
  /** Called with the chosen suggestion, or null as soon as the text is edited again. */
  onSelect: (suggestion: AddressSuggestion | null) => void;
  debounceMs?: number;
  minChars?: number;
}

/** Address autocomplete: the value only counts once a suggestion is chosen. */
export function AddressField({
  debounceMs = 250,
  error,
  helpText,
  initialValue = '',
  label,
  minChars = 3,
  noResultsText,
  onSearch,
  onSelect,
}: AddressFieldProps) {
  const listId = useId();
  const [text, setText] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    if (!open || text.trim().length < minChars) return;
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      onSearch(text.trim())
        .then((found) => {
          if (ticket !== latest.current) return;
          setSuggestions(found);
          setSearched(true);
          setActive(-1);
        })
        .catch(() => {
          if (ticket !== latest.current) return;
          setSuggestions([]);
          setSearched(true);
        });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [text, open, minChars, debounceMs, onSearch]);

  function choose(suggestion: AddressSuggestion) {
    latest.current++;
    setText(suggestion.label);
    setOpen(false);
    setSuggestions([]);
    setSearched(false);
    onSelect(suggestion);
  }

  const showList = open && text.trim().length >= minChars && searched;

  return (
    <div className="relative grid gap-2">
      <TextField
        aria-activedescendant={
          active >= 0 ? `${listId}-${String(active)}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={showList ? listId : undefined}
        aria-expanded={showList}
        autoComplete="street-address"
        error={error}
        helpText={helpText}
        label={label}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setSearched(false);
          onSelect(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && suggestions.length > 0) {
            event.preventDefault();
            setActive((i) => (i + 1) % suggestions.length);
          } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
            event.preventDefault();
            setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
          } else if (event.key === 'Enter' && active >= 0) {
            event.preventDefault();
            const chosen = suggestions[active];
            if (chosen) choose(chosen);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        role="combobox"
        value={text}
      />
      {showList ? (
        suggestions.length > 0 ? (
          <ul
            className="rounded-lg border border-border-strong bg-surface py-1"
            id={listId}
            role="listbox"
          >
            {suggestions.map((item, index) => (
              // Keyboard handling lives on the combobox input (ARIA combobox pattern).
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events
              <li
                aria-selected={index === active}
                className={`cursor-pointer px-4 py-3 text-body ${index === active ? 'bg-surface-muted' : ''}`}
                id={`${listId}-${String(index)}`}
                key={`${item.label}-${String(index)}`}
                onClick={() => choose(item)}
                onMouseDown={(event) => event.preventDefault()}
                role="option"
              >
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-text-muted" role="status">
            {noResultsText}
          </p>
        )
      ) : null}
    </div>
  );
}
