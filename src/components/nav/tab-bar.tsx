import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { memo } from "react";
import { Pressable, View } from "react-native";

import { colors } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICON: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: "compass", inactive: "compass-outline" },
  library: { active: "book", inactive: "book-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

type TabRoute = BottomTabBarProps["state"]["routes"][number];

/**
 * Custom tab bar — AGENTS.md prompt 08 steps 2–4. Matches the design's
 * ember-filled-circle active state (`nav__item--active` in global.css, not
 * an underline) and reads the bottom safe-area inset from `insets` (the
 * `BottomTabBarProps` React Navigation already measures) rather than
 * hardcoding a bar height for notched devices.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View
      className="nav mx-4"
      style={{ marginBottom: Math.max(insets.bottom, 8) }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          typeof options.tabBarLabel === "string"
            ? options.tabBarLabel
            : (options.title ?? route.name);

        return (
          <TabItem
            key={route.key}
            route={route}
            label={label}
            isFocused={state.index === index}
            navigation={navigation}
          />
        );
      })}
    </View>
  );
}

type TabItemProps = {
  route: TabRoute;
  label: string;
  isFocused: boolean;
  navigation: BottomTabBarProps["navigation"];
};

/**
 * One tab. Memoized, so a switch renders only the two tabs whose state
 * changed: the bar renders on every navigation, and everything it renders
 * adds to the time before the next screen shows.
 */
const TabItem = memo(function TabItem({ route, label, isFocused, navigation }: TabItemProps) {
  const icons = TAB_ICON[route.name];

  function onPress() {
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(route.name);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      className={`nav__item ${isFocused ? "nav__item--active" : ""}`}
    >
      <Ionicons
        name={icons ? (isFocused ? icons.active : icons.inactive) : "ellipse-outline"}
        size={22}
        color={isFocused ? colors.ink : colors.muted}
      />
    </Pressable>
  );
});
