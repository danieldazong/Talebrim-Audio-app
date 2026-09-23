import { Tabs } from "expo-router/tabs";
import { View } from "react-native";

import { MiniPlayer } from "@/components/player/MiniPlayer";
import { TabBar } from "@/components/nav/tab-bar";
import { MINI_PLAYER_VISIBLE_ROUTES } from "@/lib/mini-player-visibility";

/**
 * M3/M7/M11's shared tab shell — AGENTS.md prompt 08.
 *
 * Nested under the `isSignedIn && hasCompletedOnboarding` branch of
 * `app/_layout.tsx`'s `Stack.Protected` gate, so this never mounts for a
 * signed-out or not-yet-onboarded user.
 *
 * The mini player renders here, once, ABOVE the custom tab bar — not inside
 * each screen — so switching tabs never unmounts/remounts it (step 5).
 * Visibility is data-driven from `MINI_PLAYER_VISIBLE_ROUTES` (step 6); all
 * three tab routes are `true` today, but the check stays explicit rather
 * than assuming every tab route wants it.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => {
        const routeName = props.state.routes[props.state.index]?.name;
        const showMiniPlayer =
          routeName !== undefined &&
          MINI_PLAYER_VISIBLE_ROUTES[
            routeName as keyof typeof MINI_PLAYER_VISIBLE_ROUTES
          ];

        return (
          <View>
            {showMiniPlayer ? (
              <View className="mb-2">
                <MiniPlayer />
              </View>
            ) : null}
            <TabBar {...props} />
          </View>
        );
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover" }} />
      <Tabs.Screen name="library" options={{ title: "Library" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
