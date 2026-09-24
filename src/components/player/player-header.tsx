import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/theme";

type PlayerHeaderProps = {
  onClose: () => void;
};

/**
 * M6's header — prompt 17 step 4, measured from material/8.png: a 40dp round
 * dismiss button 24dp in from the edge, inside a 44dp touch target, and the
 * sync label centred. Shown in every state.
 *
 * The frame's right-hand hamburger has no defined function, so it is omitted
 * (AGENTS.md § Decisions, "No UI without data behind it"): an inert button is
 * a dead control for a screen reader. A 44dp spacer keeps the label centred.
 */
export function PlayerHeader({ onClose }: PlayerHeaderProps) {
  return (
    <View className="flex-row items-center px-[22px] pt-[22px]">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close player"
        onPress={onClose}
        className="h-11 w-11 items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <View className="h-10 w-10 items-center justify-center rounded-pill border border-raised bg-surface">
          <Ionicons name="chevron-down" size={22} color={colors.body} />
        </View>
      </Pressable>

      {/* STATIC — made truthful by prompt 18. The parity writer exists, but
          nothing syncs in this shell. */}
      <Text
        accessibilityRole="header"
        className="font-ui-semibold text-teal flex-1 px-2 text-center text-[13px] uppercase tracking-[1.5px]"
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        Audio sync active
      </Text>

      <View className="h-11 w-11" />
    </View>
  );
}
