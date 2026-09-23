import { router } from "expo-router";

import { useOnboardingStore } from "@/store/onboarding-store";

// The tab group's root — M3 Discover. A first-time user lands here, not on
// the health probe, right after completing M2 (prompt 08 step 1).
//
// `app/index.tsx` was deleted (it collided with `(tabs)/index.tsx` for the
// bare `/` URL — see `app/_layout.tsx`), so the tab group's index route IS
// `/` per the generated types in `.expo/types/router.d.ts`.
const POST_ONBOARDING_ROUTE = "/" as const;

/**
 * Where a user lands after authenticating.
 *
 * A first-time user goes to the genre picker (M2); a returning user goes
 * straight past it. This is the imperative "move forward now" call made from
 * inside a sign-in/verify/SSO success handler — the durable, force-quit-proof
 * version of this same gate lives in `app/_layout.tsx` as a `Stack.Protected`
 * guard over `hasCompletedOnboarding`, which is what actually stops a
 * completed user from ever seeing M2 again. This function only decides where
 * to point the very first navigation after auth completes.
 */
export function routeAfterAuth() {
  const { hasCompletedOnboarding } = useOnboardingStore.getState();
  router.replace(
    hasCompletedOnboarding ? POST_ONBOARDING_ROUTE : "/(auth)/genres",
  );
}
