// "View as a free reader": a development-only switch on M11 (the owner's
// choice, 2026-10-01; AGENTS.md Decisions — 2026-10-01, "View as a free
// reader"). No React, no hooks, no JSX (AGENTS.md § lib/).
//
// RevenueCat's Test Store can't cancel a subscription, and every test
// purchase leaves the owner's account subscribed for hours, so every chapter
// opens for them. While this is on, the screens read the entitlement as
// inactive (`useEntitlement()`), so the dashboard's locks show exactly as a
// reader without the plan sees them. A purchase or a restore turns it off
// (`usePurchase()`).
//
// Only the screens change. The downloads checks and the player read the real
// entitlement (`fetchQuery`), so turning it on never deletes a download.
//
// Never in a release build: `__DEV__` is false there, nothing turns it on, and
// M11 draws no switch. Session only: it is off again after the app restarts.

let on = false;
const listeners = new Set<() => void>();

/** True while the screens show a free reader's view. Always false in a release build. */
export function freeReaderPreview(): boolean {
  return __DEV__ && on;
}

export function setFreeReaderPreview(next: boolean): void {
  if (!__DEV__ || on === next) return;
  on = next;
  for (const listener of listeners) listener();
}

/** For `useSyncExternalStore`. Returns the unsubscribe. */
export function onFreeReaderPreviewChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
