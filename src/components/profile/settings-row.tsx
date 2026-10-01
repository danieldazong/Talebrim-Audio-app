import { Ionicons } from "@expo/vector-icons";
import { Children, Fragment, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { colors } from "@/theme";

// M11's grouped rows — prompt 25 step 4, material/10.png: 56dp rows in
// `surface` cards with `raised` hairlines, under small Fraunces capitals.

type Trailing =
  /** Opens a screen or a sheet. */
  | { kind: "chevron" }
  /** Working: Restore while it runs. */
  | { kind: "spinner" }
  /** The row is the switch. */
  | { kind: "switch"; value: boolean };

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** A `muted` second line: a state ("On"), or what the row is for. */
  detail?: string;
  trailing: Trailing;
  onPress: () => void;
  /** Ignores taps; Restore while it runs. */
  disabled?: boolean;
  /** Its label, its value and where it goes: "Theme, Dark. Opens reading settings." */
  accessibilityLabel: string;
  accessibilityHint?: string;
};

/**
 * One row: a teal outline icon, the label, an optional `muted` second line,
 * and a chevron, a spinner or a switch. 56dp at the default text size, taller
 * as the text grows, never below 44dp.
 *
 * Its whole style comes from a `style` function, with no `className` beside
 * it (AGENTS.md § Style Exception Rules). A switch row is one control: the
 * whole row toggles, and the `Switch` inside only shows the state, so no
 * control sits inside another (§ Component Creation Rule).
 */
export function SettingsRow({
  icon,
  label,
  detail,
  trailing,
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
}: SettingsRowProps) {
  const isSwitch = trailing.kind === "switch";

  return (
    <Pressable
      accessibilityRole={isSwitch ? "switch" : "button"}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled,
        busy: trailing.kind === "spinner",
        ...(isSwitch ? { checked: trailing.value } : {}),
      }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={colors.teal} />
      <View className="flex-1">
        <Text className="font-ui text-body text-[15px] leading-5" maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
        {detail ? (
          <Text className="font-ui text-muted text-[13px] leading-[18px]" maxFontSizeMultiplier={1.3}>
            {detail}
          </Text>
        ) : null}
      </View>
      {trailing.kind === "chevron" ? <Ionicons name="chevron-forward" size={16} color={colors.muted} /> : null}
      {trailing.kind === "spinner" ? <ActivityIndicator size="small" color={colors.muted} /> : null}
      {trailing.kind === "switch" ? (
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <Switch
            value={trailing.value}
            trackColor={{ false: colors.raised, true: colors.teal }}
            ios_backgroundColor={colors.raised}
            thumbColor={trailing.value ? colors.body : colors.muted}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/** A `surface` card of rows, with a `raised` hairline between each. */
export function SettingsGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    <View className="overflow-hidden rounded-card border border-raised bg-surface">
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View className="h-px bg-raised" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** "READING", "ACCOUNT": small Fraunces capitals, letter-spaced. Read as written ("Reading"). */
export function SettingsHeading({ label }: { label: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="text-heading mb-2 mt-4 px-1 text-[13px] uppercase leading-5 tracking-[1px]"
      maxFontSizeMultiplier={1.3}
    >
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
});
