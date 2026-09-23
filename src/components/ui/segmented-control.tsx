import { Pressable, Text, View } from "react-native";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  /** The current value. The control always opens on it. */
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Theme". */
  accessibilityLabel: string;
  /** Layout classes only (width, flex). Never restyle. */
  className?: string;
};

/**
 * Pill segmented control — AGENTS.md § Component Creation Rule. M5's reading
 * settings today; M7's Books / Audiobooks next.
 *
 * The SELECTED option is the filled one: a `muted/25` pill, clearly lighter
 * than the `bg` track, with a `body` label. Several design frames fill the
 * wrong segment, a known defect (AGENTS.md § Known design-file defects), so
 * the fill is derived from `value` and nothing else.
 *
 * 44dp tall: a `bg` track with 4dp of padding around 36dp segments, each
 * given 4dp of hit slop above and below to reach the 44dp touch target.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      className={`h-11 flex-row rounded-pill bg-bg p-1 ${className}`}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            hitSlop={{ top: 4, bottom: 4 }}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            className={`flex-1 items-center justify-center rounded-pill px-1 ${selected ? "bg-muted/25" : ""}`}
            style={({ pressed }) => ({ opacity: pressed && !selected ? 0.7 : 1 })}
          >
            {/* Shrinks rather than truncates at large system text sizes. */}
            <Text
              className={`font-ui-medium text-sm ${selected ? "text-body" : "text-muted"}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              maxFontSizeMultiplier={1.3}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
