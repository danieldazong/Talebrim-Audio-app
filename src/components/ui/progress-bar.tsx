import { View } from "react-native";

type ProgressBarProps = {
  /** 0 to 1. Clamped. */
  value: number;
  /** In dp. The `progress` utility's 6dp when omitted. */
  height?: number;
  /** The `raised` track behind the fill. Off over cover art, as M7's grid lines draw it. */
  track?: boolean;
  /** Layout classes only (margin, position). Never restyle. */
  className?: string;
};

/**
 * Ember progress — AGENTS.md § Component Creation Rule. M7's Continue card
 * and grid lines first. Built on the `progress` utilities in global.css; the
 * fill width is dynamic, so it is an inline style (§ Style Exception Rules).
 *
 * Screen readers skip it: every use says the progress in words beside it.
 */
export function ProgressBar({ value, height, track = true, className = "" }: ProgressBarProps) {
  const fraction = Math.min(Math.max(value, 0), 1);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`progress ${className}`}
      // Only what is set: an `undefined` here would still override the class.
      style={{
        ...(height === undefined ? null : { height }),
        ...(track ? null : { backgroundColor: "transparent" }),
      }}
    >
      <View className="progress__fill" style={{ width: `${fraction * 100}%` }} />
    </View>
  );
}
