import { useEffect, useState } from "react";

/**
 * Returns `value` once it has stopped changing for `delayMs`.
 *
 * The pending timer is cleared on every change and on unmount, so nothing
 * fires after the screen is gone. Use this — not `useDeferredValue`, which
 * only defers rendering — for anything that feeds a network query key.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
