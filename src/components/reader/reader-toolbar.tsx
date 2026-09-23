import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

import { NEXT_THEME, THEME_LABEL } from "@/components/reader/reader-theme";
import { Button } from "@/components/ui";
import type { ReaderTheme } from "@/store/reader-store";
import { colors } from "@/theme";

/** Measured from material/7.png. */
export const TOOLBAR_HEIGHT = 56;
/** Gap between the toolbar and the bottom safe-area edge. */
export const TOOLBAR_BOTTOM_GAP = 20;

export type ReaderPosition = {
  chapterNumber: number;
  chapterCount: number;
  /** Progress through this chapter, 0–100. */
  percent: number;
};

type ReaderToolbarProps = {
  theme: ReaderTheme;
  /** Shown in the ready state only; null leaves the middle empty. */
  position: ReaderPosition | null;
  /** Distance from the bottom of the screen: the gap plus the safe-area inset. */
  bottomOffset: number;
  /** The auto-hide slide, from `useReaderChrome`. */
  animatedStyle?: AnimatedStyle<ViewStyle>;
  onLayout?: (event: LayoutChangeEvent) => void;
  onCycleTheme: () => void;
  onOpenSettings: () => void;
  onListen: () => void;
};

/**
 * M5's floating toolbar — prompt 14 steps 9 to 11. `raised` in every theme:
 * AGENTS.md makes toolbars `raised`, where the frame fills it `surface`.
 * Flat, no shadow. No ember here: the reader's only ember element is the
 * progress bar.
 *
 * Brightness and `Aa` on the left, the position label in the middle where
 * the frame's bookmark sat, Listen on the right. The label lives inside the
 * toolbar so it never floats over the text, and hides with it.
 */
export function ReaderToolbar({
  theme,
  position,
  bottomOffset,
  animatedStyle,
  onLayout,
  onCycleTheme,
  onOpenSettings,
  onListen,
}: ReaderToolbarProps) {
  return (
    <Animated.View
      onLayout={onLayout}
      style={[{ position: "absolute", left: 16, right: 16, bottom: bottomOffset }, animatedStyle]}
    >
      <View className="h-14 flex-row items-center rounded-pill bg-raised px-3">
        {/* The sun cycles the reading theme; there is no screen-brightness control. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${THEME_LABEL[NEXT_THEME[theme]].toLowerCase()} theme`}
          onPress={onCycleTheme}
          className="h-11 w-11 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Ionicons name="sunny-outline" size={22} color={colors.muted} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reading settings"
          onPress={onOpenSettings}
          className="h-11 w-11 items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Text className="font-ui-semibold text-muted text-[15px]" maxFontSizeMultiplier={1.3}>
            Aa
          </Text>
        </Pressable>

        {/* UNBACKED — bookmark needs a bookmarks table. The frame's bookmark
            is not rendered; its slot holds the position label instead. */}
        <View className="flex-1 items-center px-2">
          {position ? (
            <Text
              accessibilityLabel={`Chapter ${position.chapterNumber} of ${position.chapterCount}, ${position.percent} percent read`}
              className="font-ui-medium text-muted text-xs"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              maxFontSizeMultiplier={1.3}
            >
              {`${position.chapterNumber} of ${position.chapterCount} · ${position.percent}%`}
            </Text>
          ) : null}
        </View>

        <Button
          label="Listen"
          variant="audio"
          icon={<Ionicons name="headset" size={16} color={colors.teal} />}
          accessibilityLabel="Listen to this chapter"
          onPress={onListen}
          className="h-11 px-4"
        />
      </View>
    </Animated.View>
  );
}

/**
 * 3dp, full width, flush with the bottom of the screen; ember, no track.
 * Always visible — it does not hide with the toolbar. Progress bars are
 * exempt from the one-ember rule.
 */
export function ReaderProgressBar({ animatedStyle }: { animatedStyle: AnimatedStyle<ViewStyle> }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: 3,
          backgroundColor: colors.ember,
          transformOrigin: "left",
        },
        animatedStyle,
      ]}
    />
  );
}
