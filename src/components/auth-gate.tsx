import { useAuth } from "@clerk/expo";
import { useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect } from "react";

import { routeAfterAuth } from "@/lib/auth-routing";

/**
 * Holds the splash until Clerk resolves, then keeps unauthenticated users in
 * the (auth) group.
 *
 * `isLoaded` is the whole point: rendering a protected route for even one
 * frame while auth resolves shows a signed-out user the shell of a screen
 * they should never see.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === "(auth)";

  useEffect(() => {
    if (!isLoaded) return;
    // Scaffolding routes from prompts 02/04 stay reachable while the real
    // navigation shell (prompt 08) does not exist yet.
    const root = segments[0] as string | undefined;
    // `sso-callback` is mid-flight OAuth: the session exists server-side but
    // may not have propagated to this hook yet, so redirecting here would
    // abort a sign-in that actually succeeded.
    const midFlight = root === "sso-callback";
    const onScaffolding = root === undefined || root === "health" || midFlight;

    if (!isSignedIn && !inAuthGroup && !onScaffolding) {
      router.replace("/(auth)/sign-in");
      return;
    }

    // Already signed in but sitting on a sign-in/verify screen: attempting a
    // second sign-in makes Clerk reject it with `session_exists`, which reads
    // as a broken app. Onboarding is exempt — it is marketing, not auth.
    const onAuthEntry =
      inAuthGroup && (segments[1] === "sign-in" || segments[1] === "verify");

    if (isSignedIn && onAuthEntry) {
      routeAfterAuth();
    }
  }, [isLoaded, isSignedIn, inAuthGroup, segments, router]);

  useEffect(() => {
    if (isLoaded) void SplashScreen.hideAsync();
  }, [isLoaded]);

  // Nothing renders until Clerk has resolved — no protected frame leaks out.
  if (!isLoaded) return null;

  return <>{children}</>;
}
