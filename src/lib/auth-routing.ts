import { router } from "expo-router";

/**
 * Where a user lands after authenticating.
 *
 * A first-time user goes to the genre picker (M2); a returning user goes
 * straight to Discover (M3).
 */
export function routeAfterAuth() {
  // TODO(08): read the persisted onboarding/genre completion flag and send
  // returning users to Discover (M3) instead. Until that flag exists every
  // user is treated as first-time, so everyone gets the genre picker — never
  // the health probe, which is a scaffolding-only wiring check and not a
  // screen a signed-in user should ever land on.
  router.replace("/(auth)/genres");
}
