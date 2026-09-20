import "../global.css";

import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready, error]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      {/* Dark app: light status-bar content. AGENTS.md § UI Quality Bar. */}
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          // M3 and M5 draw their own top bars and opt back in.
          headerShown: false,
          // These take no className — AGENTS.md § Style Exception Rules is
          // exactly why src/theme/ exists. contentStyle prevents a white
          // flash between screens on a nocturnal app.
          contentStyle: { backgroundColor: colors.bg },
          headerStyle: { backgroundColor: colors.raised },
          headerTintColor: colors.body,
          headerTitleStyle: {
            fontFamily: fonts.display,
            color: colors.champagne,
          },
        }}
      />
    </SafeAreaProvider>
  );
}
