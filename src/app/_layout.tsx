import "../global.css";

import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/auth-gate";
import { AuthedQueryProvider } from "@/components/providers";
import { useAppFonts } from "@/hooks/use-app-fonts";
import { useCatalogSync } from "@/hooks/use-catalog-sync";
import { useParitySync } from "@/hooks/use-parity-sync";
import { colors, fonts } from "@/theme";
import { useOnboardingStore } from "@/store/onboarding-store";
// Imported here (root layout), not just from `(auth)/_layout.tsx`, so its
// `registerHydratingStore("splash")` call runs before `AuthGate` ever checks
// `isHydrationComplete()`. `(auth)/_layout.tsx` is a separate route module
// Expo Router only loads once navigated to — importing it there alone would
// race the hydration gate and could let `AuthGate` render one frame early.
import "@/store/splash-store";

// Module scope, not inside the component: calling this during render races
// the first paint and the splash can hide before the fonts are ready.
SplashScreen.preventAutoHideAsync();

const screenOptions = {
  // M3 and M5 draw their own top bars and opt back in.
  headerShown: false,
  // These take no className — AGENTS.md § Style Exception Rules is exactly
  // why src/theme/ exists. contentStyle prevents a white flash between
  // screens on a nocturnal app.
  contentStyle: { backgroundColor: colors.bg },
  headerStyle: { backgroundColor: colors.raised },
  headerTintColor: colors.body,
  headerTitleStyle: {
    fontFamily: fonts.display,
    color: colors.champagne,
  },
} as const;

/**
 * The three-way routing gate (prompt 07 step 5), composed with — not
 * replacing — the Clerk auth gate from prompt 06:
 *
 *   not signed in                              → M1 (sign-in / verify / sso-callback)
 *   signed in, hasCompletedOnboarding === false → M2 (genre picker)
 *   signed in, hasCompletedOnboarding === true  → past onboarding
 *
 * Declared with `Stack.Protected` rather than an imperative `router.replace`
 * inside a `useEffect`: when `hasCompletedOnboarding` flips true, Expo Router
 * itself removes the M2/sign-in screens from the navigator and redirects —
 * there is no window where a completed user can navigate back into M2, no
 * matter how they got here (force-quit, reinstall-then-sign-in, deep link).
 *
 * This runs INSIDE `AuthGate`, so `isLoaded` and store hydration are already
 * both true here — `hasCompletedOnboarding` is never read before it settles.
 *
 * `(auth)` is gated here as ONE opaque group, never by reaching into its
 * individual screens (`(auth)/sign-in` etc.) — Expo Router only exposes a
 * nested group with its own `_layout.tsx` as a single route node to an
 * ancestor's `<Stack.Screen name>` matcher, so naming its children from out
 * here silently fails every match (`[Layout children]: No route named
 * "(auth)/sign-in" exists`) and falls through to "Unmatched Route". The
 * sign-in-vs-splash-vs-genres decision lives inside `(auth)/_layout.tsx`,
 * which actually owns those files as its `node.children`.
 */
function RootNavigator() {
  const { isSignedIn } = useAuth();
  const hasCompletedOnboarding = useOnboardingStore(
    (state) => state.hasCompletedOnboarding,
  );

  // Dashboard edits reach every screen live. Signed-in only: the Realtime
  // topic is private.
  useCatalogSync(Boolean(isSignedIn));
  // Reading positions reach the server when the app leaves the foreground,
  // and a newer one from another device is picked up when it returns.
  useParitySync();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Protected guard={!isSignedIn || !hasCompletedOnboarding}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={Boolean(isSignedIn) && hasCompletedOnboarding}>
        {/* The tab shell — Discover/Library/Profile plus the mini player.
            Never mounts for a signed-out or not-yet-onboarded user. */}
        <Stack.Screen name="(tabs)" />

        {/* Non-tab routes: pushed on top of the tab shell and therefore
            cover the bar and mini player, per prompt 08 step 10. M5/M6
            present with neither by never mounting inside (tabs). */}
        <Stack.Screen name="book/[id]" />
        <Stack.Screen name="reader/[chapterId]" options={{ animation: "fade" }} />
        <Stack.Screen name="player/[chapterId]" options={{ animation: "fade" }} />
        <Stack.Screen name="chapters/[bookId]" />
        <Stack.Screen name="search" />
      </Stack.Protected>

      {/* Reachable regardless of gate state: the OAuth callback (mid-flight
          by definition — `isSignedIn` may not have flipped yet when it
          mounts, and gating it on that would unmount it out from under
          `setActive` before `routeAfterAuth()` can run), and `health`, a
          wiring probe (plus the __DEV__ clear-storage button, prompt 07 step
          9) that stays reachable by direct navigation without being any
          gate's landing screen (prompt 08 step 11). `app/index.tsx`, the
          former dev scaffolding root, was deleted: it collided with
          `(tabs)/index.tsx` for the bare `/` URL, and Discover owns `/`. */}
      <Stack.Screen name="sso-callback" />
      {/* Only screen that opts back into the default header — it's reached
          by a dev-only button (no swipe-back gesture on Android without a
          header) with no other way out otherwise. */}
      <Stack.Screen name="health" options={{ headerShown: true, title: "" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const { ready, error } = useAppFonts();

  useEffect(() => {
    if (error) {
      console.warn("[fonts] failed to load, falling back to system", error);
    }
  }, [error]);

  // Splash stays up until fonts are ready here, then AuthGate holds it
  // further until Clerk AND store hydration both resolve.
  if (!ready) return null;

  return (
    // SecureStore-backed cache from Clerk — never AsyncStorage for a session
    // token, and never a hand-rolled cache. AGENTS.md § Clerk Rules.
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <AuthedQueryProvider>
        <SafeAreaProvider>
          {/* Dark app: light status-bar content. AGENTS.md § UI Quality Bar. */}
          <StatusBar style="light" />
          <AuthGate>
            <RootNavigator />
          </AuthGate>
        </SafeAreaProvider>
      </AuthedQueryProvider>
    </ClerkProvider>
  );
}
