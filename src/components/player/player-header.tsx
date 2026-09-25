import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, layout } from "@/theme";

type PlayerHeaderProps = {
  onClose: () => void;
  /** This is the player's loaded chapter, so its position is recording through `lib/parity`. */
  syncActive: boolean;
};

/**
 * M6's header — prompt 17 step 4, measured from material/8.png: a 40dp round
 * dismiss button 24dp in from the edge, inside a 44dp touch target, and the
 * sync label centred. Shown in every state; the label only while it is true
 * (prompt 18 step 11), in a space that stays when it is hidden.
 *
 * The frame's right-hand hamburger has no defined function, so it is omitted
 * (AGENTS.md § Decisions, "No UI without data behind it"): an inert button is
 * a dead control for a screen reader. A 44dp spacer keeps the label centred.
 */
export function PlayerHeader({ onClose, syncActive }: PlayerHeaderProps) {
  return (
    <View className="flex-row items-center px-[22px] pt-[22px]">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close player"
        onPress={onClose}
        // No className beside a `style` function: NativeWind would drop the
        // function (see player-controls.tsx).
        style={({ pressed }) => [styles.close, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View className="h-10 w-10 items-center justify-center rounded-pill border border-raised bg-surface">
          <Ionicons name="chevron-down" size={22} color={colors.body} />
        </View>
      </Pressable>

      {syncActive ? (
        <Text
          accessibilityRole="header"
          className="font-ui-semibold text-teal flex-1 px-2 text-center text-[13px] uppercase tracking-[1.5px]"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          Audio sync active
        </Text>
      ) : (
        <View className="flex-1" />
      )}

      <View className="h-11 w-11" />
    </View>
  );
}

const styles = StyleSheet.create({
  close: {
    height: layout.minTouchTarget,
    width: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
