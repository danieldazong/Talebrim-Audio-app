import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";

import { layout } from "@/theme";

type Tone = "muted" | "destructive";

const TONE_CLASS: Record<Tone, string> = {
  muted: "text-muted",
  // M11's Sign out and Delete account (AGENTS.md § Colors).
  destructive: "text-destructive",
};

type TextLinkProps = {
  label: string;
  /** `muted`, the default, or `destructive`. */
  tone?: Tone;
} & Omit<PressableProps, "children" | "style" | "className">;

/**
 * A quiet text action: M5a's Restore purchases and Manage subscription,
 * M10's Cancel subscription, M11's Sign out and Delete account. A 44dp
 * target around the words.
 *
 * Its whole style comes from a `style` function and no `className`:
 * NativeWind drops a function beside a className (AGENTS.md § Style Exception
 * Rules).
 */
export function TextLink({ label, tone = "muted", ...pressable }: TextLinkProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}
      {...pressable}
    >
      <Text className={`font-ui-medium text-sm ${TONE_CLASS[tone]}`} maxFontSizeMultiplier={1.3}>
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
