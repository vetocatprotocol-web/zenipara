import { useState, useEffect } from 'react';

/**
 * Debounce a value by the given delay (default 300ms).
 * Use instead of wiring onChange directly to a query, per spec §13.2.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
