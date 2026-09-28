import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { layout } from "@/theme";

type TextLinkProps = {
  label: string;
} & Omit<PressableProps, "children" | "style" | "className">;

/**
 * A quiet text action in `muted`: M5a's Restore purchases and Manage
 * subscription, M10's Cancel subscription. A 44dp target around the words.
 *
 * Its whole style comes from a `style` function and no `className`:
 * NativeWind drops a function beside a className (AGENTS.md § Style Exception
 * Rules).
 */
export function TextLink({ label, ...pressable }: TextLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
      {...pressable}
    >
      <Text className="font-ui-medium text-muted text-sm" maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
