import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
} from "react-native";

import { colors } from "@/theme";

type Variant = "primary" | "secondary" | "inverted" | "outlined" | "audio";

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn--primary",
  secondary: "btn--secondary",
  inverted: "btn--inverted",
  outlined: "btn--outlined",
  audio: "btn--audio",
};

// Ember labels are ink, never white — AGENTS.md § Design System.
const LABEL_CLASS: Record<Variant, string> = {
  primary: "text-ink",
  secondary: "text-body",
  inverted: "text-champagne",
  outlined: "text-body",
  audio: "text-teal",
};

const SPINNER_COLOR: Record<Variant, string> = {
  primary: colors.ink,
  secondary: colors.body,
  inverted: colors.champagne,
  outlined: colors.body,
  audio: colors.teal,
};

type ButtonProps = {
  label: string;
  variant?: Variant;
  /** Leading element — an icon or brand glyph. */
  icon?: React.ReactNode;
  loading?: boolean;
  /** Extra layout classes only (height, margin, width). Never restyle. */
  className?: string;
} & Omit<PressableProps, "children" | "style" | "className">;

/**
 * The app's only button implementation — AGENTS.md § Component Creation Rule.
 * Composes the `.btn` utilities in global.css; callers pass layout classes,
 * never colors.
 *
 * While `loading`, the spinner takes the leading icon slot and the label stays
 * visible, so the pill keeps a stable width instead of resizing mid-submit.
 *
 * Pressed is tracked in state and `style` is a plain object: beside a
 * className, this NativeWind drops a `style` function, so the pressed and
 * disabled opacity never rendered (AGENTS.md § Style Exception Rules).
 */
export function Button({
  label,
  variant = "primary",
  icon,
  loading = false,
  disabled,
  className = "",
  onPressIn,
  onPressOut,
  ...pressable
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`btn ${VARIANT_CLASS[variant]} ${className}`}
      style={{ opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1 }}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      {...pressable}
    >
      {loading ? (
        <ActivityIndicator size="small" color={SPINNER_COLOR[variant]} />
      ) : (
        icon
      )}
      <Text
        className={`font-ui-semibold text-base ${LABEL_CLASS[variant]}`}
        maxFontSizeMultiplier={1.3}
      >
        {label}
      </Text>
    </Pressable>
  );
}
