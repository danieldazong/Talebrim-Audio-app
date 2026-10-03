import { NativeTabs } from "expo-router/unstable-native-tabs";

import { MiniPlayer } from "@/components/player/MiniPlayer";
import { useLoadedChapter } from "@/hooks/use-audio";
import { colors } from "@/theme";

/** Behind each tab's screen, as the root stack's `contentStyle`: `bg`, never the navigation theme's grey. */
const SCREEN = { backgroundColor: colors.bg };

/**
 * M3/M7/M11's tab shell on iOS: the system tab bar, which iOS 26 draws in
 * Liquid Glass. Android and the web keep `_layout.tsx`'s designed bar
 * (AGENTS.md, Decisions — 2026-10-02, "Native tabs on iOS").
 *
 * The system draws the bar and adapts it to what scrolls beneath, so the one
 * token here is the ember of the selected tab. Labels are in the system font,
 * as iOS tab bars are.
 *
 * Every tab mounts at once (react-native-screens renders each tab's content),
 * so `_layout.tsx`'s `TabPreloader` has no twin here. The system insets each
 * screen's scroll view for the bar, so `useTabBarInset()` is 0 on iOS.
 */
export default function TabsLayout() {
  // The mini player is the bar's bottom accessory while a chapter is loaded.
  // The accessory belongs to the bar, not to one tab, so it shows on all
  // three, as MINI_PLAYER_VISIBLE_ROUTES allows. iOS 26 and later only:
  // earlier versions have no accessory, and show no mini player on the tabs.
  const hasChapter = useLoadedChapter() !== null;

  return (
    <NativeTabs tintColor={colors.ember}>
      {hasChapter ? (
        <NativeTabs.BottomAccessory>
          <AccessoryMiniPlayer />
        </NativeTabs.BottomAccessory>
      ) : null}

      {/* Discover's scroll view sits below its header and genre strip, so the
          system can't find it: a second tap doesn't scroll it to the top, and
          on iOS 18 and earlier the bar would stay see-through over it without
          disableTransparentOnScrollEdge. Library's and Profile's lists are
          their screens' first view, so both scroll to the top. */}
      <NativeTabs.Trigger name="index" contentStyle={SCREEN} disableTransparentOnScrollEdge>
        <NativeTabs.Trigger.Icon sf={{ default: "binoculars", selected: "binoculars.fill" }} />
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="library" contentStyle={SCREEN}>
        <NativeTabs.Trigger.Icon sf={{ default: "books.vertical", selected: "books.vertical.fill" }} />
        <NativeTabs.Trigger.Label>Library</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile" contentStyle={SCREEN}>
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} />
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

/**
 * The system renders one copy for each placement: above the bar, and beside
 * it once it shrinks. The player's state lives in `lib/audio`, so both agree.
 */
function AccessoryMiniPlayer() {
  return <MiniPlayer placement={NativeTabs.BottomAccessory.usePlacement()} />;
}
