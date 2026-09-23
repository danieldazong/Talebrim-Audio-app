import { useAuth } from "@clerk/expo";
import { Stack } from "expo-router";

import { colors } from "@/theme";
import { useOnboardingStore } from "@/store/onboarding-store";
import { useSplashStore } from "@/store/splash-store";

/**
 * The app's entry group: no header, no tab bar, no mini player.
 *
 * Screen-level protection lives HERE, not in the root `app/_layout.tsx`.
 * Expo Router cannot match a `<Stack.Screen name="(auth)/sign-in">` declared
 * in an ANCESTOR layout once `(auth)` has its own nested `_layout.tsx` — the
 * ancestor only ever sees `(auth)` as one opaque route, never its individual
 * children, so every screen-name match silently fails and each of
 * sign-in/verify/onboarding falls through to Expo Router's own "Unmatched
 * Route" screen. The root layout gates the whole group as a single unit
 * (`<Stack.Screen name="(auth)" />`); this layout is the one place that
 * actually owns `sign-in.tsx` / `verify.tsx` / `onboarding.tsx` /
 * `genres.tsx` as `node.children`, so it is the only place their names can
 * be matched.
 *
 * Ordering within `!isSignedIn`:
 *   splash not yet seen → onboarding (marketing splash, "Read it. Or hear it.")
 *   splash already seen → sign-in / verify (M1)
 * `genres` (M2) only ever shows once `isSignedIn` is true.
 */
export default function AuthLayout() {
  const { isSignedIn } = useAuth();
  const hasCompletedOnboarding = useOnboardingStore(
    (state) => state.hasCompletedOnboarding,
  );
  const hasSeenSplash = useSplashStore((state) => state.hasSeenSplash);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={!isSignedIn && !hasSeenSplash}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={!isSignedIn && hasSeenSplash}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="verify" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(isSignedIn) && !hasCompletedOnboarding}>
        <Stack.Screen name="genres" />
      </Stack.Protected>
    </Stack>
  );
}
