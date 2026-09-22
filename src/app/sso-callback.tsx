import { useClerk } from "@clerk/expo";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";

import { Screen } from "@/components/ui";
import { routeAfterAuth } from "@/lib/auth-routing";
import { colors } from "@/theme";

// NOTE: do not call WebBrowser.maybeCompleteAuthSession() here. ClerkProvider
// already calls it on web, synchronously during render, so the redirect is
// caught before children mount. A second call races that one.

/**
 * Landing route for the OAuth callback.
 *
 * `useSSO()` opens the provider in a browser and hands it a redirect of
 * `<scheme>://sso-callback`, so this path MUST exist or the deep link lands on
 * "Unmatched Route" after a successful sign-in. The URL carries
 * `created_session_id` and `rotating_token_nonce`.
 *
 * In the normal case `useSSO()` has already activated the session by the time
 * this mounts, so this screen just forwards. The explicit `setActive` below is
 * the fallback for when the browser hands off before that resolves.
 */
export default function SSOCallback() {
  const { setActive } = useClerk();
  const { created_session_id: createdSessionId } = useLocalSearchParams<{
    created_session_id?: string;
  }>();

  // Guards against a double-activation if this effect re-runs.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    async function finish() {
      try {
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
        }
      } catch {
        // Already active, or the session is gone. Either way the gate in
        // _layout.tsx decides where this user belongs — never strand them
        // on a spinner.
      } finally {
        routeAfterAuth();
      }
    }

    void finish();
  }, [createdSessionId, setActive]);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.ember} />
      </View>
    </Screen>
  );
}
