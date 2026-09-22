import "../global.css";

import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthGate } from "@/components/auth-gate";
import { AuthedQueryProvider } from "@/components/providers";
import { useAppFonts } from "@/hooks/use-app-fonts";
import { colors, fonts } from "@/theme";

// Module scope, not inside the component: calling this during render races
// the first paint and the splash can hide before the fonts are ready.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { ready, error } = useAppFonts();

  useEffect(() => {
    if (error) {
      console.warn("[fonts] failed to load, falling back to system", error);
    }
  }, [error]);

  // Splash stays up until BOTH fonts and Clerk resolve — AuthGate hides it
  // once `isLoaded` is true.
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
            <Stack
              screenOptions={{
                // M3 and M5 draw their own top bars and opt back in.
                headerShown: false,
                // These take no className — AGENTS.md § Style Exception Rules
                // is exactly why src/theme/ exists. contentStyle prevents a
                // white flash between screens on a nocturnal app.
                contentStyle: { backgroundColor: colors.bg },
                headerStyle: { backgroundColor: colors.raised },
                headerTintColor: colors.body,
                headerTitleStyle: {
                  fontFamily: fonts.display,
                  color: colors.champagne,
                },
              }}
            />
          </AuthGate>
        </SafeAreaProvider>
      </AuthedQueryProvider>
    </ClerkProvider>
  );
}
