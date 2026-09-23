import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/theme";

type Variant = "overlay" | "round" | "outline";

const CONTAINER_CLASS: Record<Variant, string> = {
  // Floats over cover art — M3 cover cards.
  overlay: "flex-row items-center gap-1 self-start rounded-pill bg-bg/70 px-2 py-1",
  // 32dp teal-tinted disc — M8 result rows (material/4.png).
  round: "h-8 w-8 items-center justify-center rounded-pill bg-teal/10",
  // Quiet outlined pill — M8's "Text only".
  outline: "rounded-pill border border-raised bg-surface px-3 py-1",
};

const ICON_SIZE: Record<Variant, number> = { overlay: 12, round: 16, outline: 12 };

const LABEL_CLASS: Record<Variant, string> = {
  overlay: "text-teal",
  round: "text-teal",
  outline: "text-muted",
};

type BadgeProps = {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: Variant;
  className?: string;
};

/**
 * Small status pill — AGENTS.md § Component Creation Rule. Status is always
 * labelled, never colour alone, so an icon-only badge still carries an
 * accessibility label.
 *
 * Teal is a reserved status colour (AGENTS.md § Design System) and marks
 * audio only; the `outline` variant is muted for non-audio status.
 */
export function Badge({ label, icon, variant = "overlay", className = "" }: BadgeProps) {
  return (
    <View
      accessible
      accessibilityLabel={label ?? "Audio available"}
      className={`${CONTAINER_CLASS[variant]} ${className}`}
    >
      {icon ? <Ionicons name={icon} size={ICON_SIZE[variant]} color={colors.teal} /> : null}
      {label ? (
        <Text
          className={`font-ui-medium text-xs ${LABEL_CLASS[variant]}`}
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );
}
