import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/theme";

type BadgeProps = {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  className?: string;
};

/**
 * Small teal pill for status labels — AGENTS.md § Component Creation Rule.
 *
 * Teal is a reserved status colour (AGENTS.md § Design System): M3 uses it
 * only for the audio badge on cover cards (prompt 09 step 6), never
 * decoratively elsewhere on that screen.
 */
export function Badge({ label, icon, className = "" }: BadgeProps) {
  return (
    <View
      accessible
      accessibilityLabel={label ?? "Audio available"}
      className={`flex-row items-center gap-1 self-start rounded-pill bg-bg/70 px-2 py-1 ${className}`}
    >
      {icon ? <Ionicons name={icon} size={12} color={colors.teal} /> : null}
      {label ? (
        <Text
          className="font-ui-medium text-xs"
          style={{ color: colors.teal }}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
