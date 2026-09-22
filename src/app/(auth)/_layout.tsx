import { Stack } from "expo-router";

import { colors } from "@/theme";

// The app's entry group: no header, no tab bar, no mini player.
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
