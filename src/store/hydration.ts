// Tracks whether every persisted Zustand slice has finished rehydrating from
// AsyncStorage. AsyncStorage reads are async, so a persisted store's initial
// render is always its pre-hydration default — reading `hasCompletedOnboarding`
// before hydration finishes reads `false` for one frame and flashes M2 at a
// returning user on every cold start (prompt 07 step 4). The routing gate
// waits on this flag, not just on Clerk's `isLoaded`.

type HydrationListener = () => void;

const pendingStores = new Set<string>();
const listeners = new Set<HydrationListener>();

/** Call once per persisted store, before its `persist()` config resolves. */
export function registerHydratingStore(name: string): void {
  pendingStores.add(name);
}

/** Call from that store's `onRehydrateStorage` callback once it settles. */
export function markStoreHydrated(name: string): void {
  pendingStores.delete(name);
  listeners.forEach((listener) => listener());
}

export function isHydrationComplete(): boolean {
  return pendingStores.size === 0;
}

export function subscribeToHydration(listener: HydrationListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
