import { Pressable, Text, type PressableProps } from "react-native";

type Variant = "outlined" | "filled";

const VARIANT_CLASS: Record<Variant, string> = {
  outlined: "",
  filled: "chip--filled",
};

type ChipProps = {
  label: string;
  selected?: boolean;
  /** `outlined` — M2's genre picker. `filled` — M8's filter row. */
  variant?: Variant;
  className?: string;
} & Omit<PressableProps, "children" | "style" | "className">;

/**
 * Pill chip; blush-filled when selected — AGENTS.md § Design System.
 * Used by M2's genre picker and M8's filters.
 */
export function Chip({
  label,
  selected = false,
  variant = "outlined",
  className = "",
  ...pressable
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      className={`chip ${VARIANT_CLASS[variant]} ${selected ? "chip--selected" : ""} ${className}`}
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
