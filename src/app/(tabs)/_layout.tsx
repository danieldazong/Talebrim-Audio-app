import { Tabs, type BottomTabBarProps } from "expo-router/tabs";
import { useEffect, useState } from "react";
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
 *
 * The tabs not on screen are built in the background (`TabPreloader`), so a
 * tap switches to a screen that already exists.
 *
 * Android and the web only: iOS uses `_layout.ios.tsx`, the system's native
 * tab bar (Liquid Glass on iOS 26).
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
            <TabPreloader state={props.state} navigation={props.navigation} />
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

/** Before the first tab is built, and between tabs: the screen on show starts first. */
const PRELOAD_GAP_MS = 1_500;

/**
 * Builds the tabs that weren't on screen when the shell mounted (Library and
 * Profile, on a start at Discover) in the background: one at a time, each
 * once the JS thread is idle. The first tap on one then shows a screen that
 * already exists. Built on the tap instead, Profile took most of a second,
 * and nearly two in a development build.
 *
 * Sent to the tab navigator itself. `router.prefetch()` aims at the root stack
 * whenever another screen covers the tabs, and there it would build a second,
 * hidden copy of the whole tab shell.
 */
function TabPreloader({ state, navigation }: Pick<BottomTabBarProps, "state" | "navigation">) {
  const [names] = useState(() =>
    state.routes.filter((_, index) => index !== state.index).map((route) => route.name),
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    const preload = (next: number) => {
      if (next >= names.length) return;
      timer = setTimeout(() => {
        idle = requestIdleCallback(() => {
          // The tab on screen is built already.
          const current = navigation.getState();
          if (current.routes[current.index]?.name !== names[next]) navigation.preload(names[next]);
          preload(next + 1);
        });
      }, PRELOAD_GAP_MS);
    };
    preload(0);
    return () => {
      clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [names, navigation]);

  return null;
}
