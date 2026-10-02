import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, type PressableProps } from "react-native";

import type { ReaderPalette } from "@/components/reader/reader-theme";

type ReaderPillProps = {
  label: string;
  palette: ReaderPalette;
  /** A leading icon in the label's colour: the lock on a locked next chapter. */
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  /** Layout classes only (height, width, margin). */
  className?: string;
} & Omit<PressableProps, "children" | "style" | "className">;

/**
 * The reader's outlined pill — prompt 14 step 12. Drawn from the active
 * theme: `Button`'s `outlined` variant has a `body` label, which vanishes on
 * `reader-light`. Used for "Next chapter" (or "Unlock chapter N") and the
 * states' Retry and Go back.
 */
export function ReaderPill({ label, palette, icon, className = "", ...pressable }: ReaderPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`min-h-11 flex-row items-center justify-center gap-2 rounded-pill border px-6 ${palette.pillBorder} ${className}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      {...pressable}
    >
      {icon ? <Ionicons name={icon} size={16} color={palette.colors.text} /> : null}
      <Text className={`font-ui-semibold text-base ${palette.text}`} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}
