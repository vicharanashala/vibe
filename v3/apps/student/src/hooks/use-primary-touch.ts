import { useSyncExternalStore } from 'react';

/**
 * True when the device's primary input is touch — phones and tablets.
 * Laptops whose primary input is a mouse or trackpad stay false even with a
 * touchscreen, which is why this asks about the *primary* pointer rather than
 * screen width (a narrow desktop window isn't a phone). Strict mode is
 * PC-only, so it uses this to send phones to study mode instead.
 */
const QUERY = '(pointer: coarse)';

function query(): MediaQueryList | undefined {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY)
    : undefined;
}

function subscribe(onChange: () => void) {
  const mql = query();
  mql?.addEventListener?.('change', onChange);
  return () => mql?.removeEventListener?.('change', onChange);
}

export function isPrimaryTouch(): boolean {
  return query()?.matches ?? false;
}

export function usePrimaryTouch(): boolean {
  return useSyncExternalStore(subscribe, isPrimaryTouch, () => false);
}
