import { useAuth } from "@clerk/expo";
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect } from "react";

import { useStoresHydrated } from "@/hooks/use-stores-hydrated";

/**
 * Holds the splash until BOTH Clerk resolves and every persisted Zustand
 * store has rehydrated from AsyncStorage.
 *
 * `isLoaded` alone is not enough: AsyncStorage rehydrates after first render,
 * so a persisted store's initial value is always its pre-hydration default.
 * Hiding the splash on `isLoaded` alone would let the `Stack.Protected` gate
 * in `app/_layout.tsx` read `hasCompletedOnboarding: false` for one frame and
 * flash M2 at a returning user on every cold start (prompt 07 step 4).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();
  const storesHydrated = useStoresHydrated();

  const ready = isLoaded && storesHydrated;

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // Nothing renders until both Clerk and the stores have resolved — no
  // protected frame leaks out, and the routing gate never reads a stale
  // default.
  if (!ready) return null;

  return <>{children}</>;
}
