import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "expo-router/tabs";
import { memo, useEffect } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

import { colors } from "@/theme";

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICON: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: "compass", inactive: "compass-outline" },
  library: { active: "book", inactive: "book-outline" },
  profile: { active: "person", inactive: "person-outline" },
};

const ICON_SIZE = 22;
/** The ember circle behind the selected tab's icon: a touch target's 44dp. */
const CIRCLE_SIZE = 44;
/** The circle's slide to the tab just selected: a move across the bar, so ease-in-out. */
const SLIDE = { duration: 250, easing: Easing.bezier(0.77, 0, 0.175, 1) };
/**
 * How far the circle is from a tab, in tabs, while each of the tab's two looks
 * fades. On a phone a tab is about 115dp wide. The filled icon is gone by 0.1
 * (11dp), before it can stick out past the circle's edge; the outline icon and
 * the label come back as the circle clears them, by 0.45 (52dp).
 */
const SELECTED_FADE = [0, 0.1];
const IDLE_FADE = [0.15, 0.45];

type TabRoute = BottomTabBarProps["state"]["routes"][number];

/**
 * Custom tab bar — AGENTS.md prompt 08 steps 2–4, and Decisions — 2026-10-03,
 * "The tab bar's sliding circle". The selected tab is its icon alone on an
 * ember circle; the others show an outline icon over their label. The circle
 * slides to the tab just selected.
 *
 * One shared value, `position`, says where the circle is, and the circle and
 * every tab's look follow it on the UI thread: a tab turns as the circle
 * reaches it or leaves it, the ones it passes over included, and a tap while it
 * moves sends it on from where it is. With Reduce Motion (Remove animations on
 * Android) the circle moves at once.
 *
 * Reads the bottom safe-area inset from `insets` (the `BottomTabBarProps`
 * React Navigation already measures) rather than hardcoding a bar height for
 * notched devices.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const reduceMotion = useReducedMotion();
  // In tabs: 0 is under the first tab, 1 under the second.
  const position = useSharedValue(state.index);
  // One tab's width, from the row's layout; until it is known, the circle hides.
  const tabWidth = useSharedValue(0);
  const count = state.routes.length;

  useEffect(() => {
    position.set(reduceMotion ? state.index : withTiming(state.index, SLIDE));
  }, [position, reduceMotion, state.index]);

  const circleStyle = useAnimatedStyle(() => {
    const width = tabWidth.get();
    return {
      opacity: width > 0 ? 1 : 0,
      transform: [{ translateX: (position.get() + 0.5) * width - CIRCLE_SIZE / 2 }],
    };
  });

  function onLayout(event: LayoutChangeEvent) {
    tabWidth.set(event.nativeEvent.layout.width / count);
  }

  return (
    <View
      className="nav mx-4"
      style={{ marginBottom: Math.max(insets.bottom, 8) }}
    >
      <View className="flex-1 flex-row" onLayout={onLayout}>
        {/* Under the tabs, so the selected tab's icon draws on it; touches pass through. */}
        <View className="absolute inset-0 justify-center" style={{ pointerEvents: "none" }}>
          <Animated.View style={[styles.circle, circleStyle]} />
        </View>
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
              index={index}
              label={label}
              isFocused={state.index === index}
              position={position}
              navigation={navigation}
            />
          );
        })}
      </View>
    </View>
  );
}

type TabItemProps = {
  route: TabRoute;
  index: number;
  label: string;
  isFocused: boolean;
  position: SharedValue<number>;
  navigation: BottomTabBarProps["navigation"];
};

/**
 * One tab, the whole width of its slot. Memoized, so a switch renders only the
 * two tabs whose state changed: the bar renders on every navigation, and
 * everything it renders adds to the time before the next screen shows. The
 * slide itself renders nothing.
 */
const TabItem = memo(function TabItem({
  route,
  index,
  label,
  isFocused,
  position,
  navigation,
}: TabItemProps) {
  const icons = TAB_ICON[route.name];

  const selectedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.get() - index), SELECTED_FADE, [1, 0], Extrapolation.CLAMP),
  }));
  const idleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(Math.abs(position.get() - index), IDLE_FADE, [0, 1], Extrapolation.CLAMP),
  }));

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
      onPress={onPress}
      className="nav__item"
    >
      <Animated.View style={[styles.idle, idleStyle]}>
        <Ionicons name={icons?.inactive ?? "ellipse-outline"} size={ICON_SIZE} color={colors.muted} />
        <Text className="nav__label" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      </Animated.View>
      <Animated.View style={[styles.selected, selectedStyle]}>
        <Ionicons name={icons?.active ?? "ellipse"} size={ICON_SIZE} color={colors.ink} />
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: colors.ember,
  },
  idle: { alignItems: "center", gap: 2 },
  // Centred on the slot, where the circle stops.
  selected: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
