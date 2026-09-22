import { Pressable, Text, type PressableProps } from "react-native";

type ChipProps = {
  label: string;
  selected?: boolean;
  className?: string;
} & Omit<PressableProps, "children" | "style" | "className">;

/**
 * Outlined pill; blush-filled when selected — AGENTS.md § Design System.
 * Used by M2's genre picker and M8's filters.
 */
export function Chip({
  label,
  selected = false,
  className = "",
  ...pressable
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`chip ${selected ? "chip--selected" : ""} ${className}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
      {...pressable}
    >
      <Text
        className={`font-ui-medium text-sm ${selected ? "text-ink" : "text-body"}`}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </Pressable>
  );
}
