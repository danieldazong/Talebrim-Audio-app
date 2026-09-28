import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Plan } from "@/lib/billing";
import { colors, radius } from "@/theme";

type PlanCardProps = {
  plan: Plan;
  selected: boolean;
  disabled: boolean;
  onSelect: (plan: Plan) => void;
};

/**
 * One M10 plan card, from material/11.png: the name with its blush badge,
 * the price in Fraunces, the subline, and a radio on the right. On `surface`
 * with a `raised` hairline; selected, an ember border and a filled ember
 * radio, a selection mark as M6's cover rim is a decorative edge. The
 * screen's one ember action stays its button.
 *
 * One radio for screen readers: its name, full price, period and badge as one
 * sentence. Its whole style comes from a `style` function and no
 * `className` (AGENTS.md § Style Exception Rules).
 */
export function PlanCard({ plan, selected, disabled, onSelect }: PlanCardProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={plan.spoken}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={() => onSelect(plan)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.selected : null,
        { opacity: disabled && !selected ? 0.6 : pressed ? 0.85 : 1 },
      ]}
    >
      <View className="flex-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Text className="font-ui-semibold text-body text-base leading-6" maxFontSizeMultiplier={1.3}>
            {plan.name}
          </Text>
          {plan.badge ? (
            <View className="rounded-pill bg-blush/15 px-2.5 py-0.5">
              <Text className="font-ui-semibold text-blush text-[13px] leading-[18px]" maxFontSizeMultiplier={1.3}>
                {plan.badge.kind === "best-value" ? "Best value" : `Save ${plan.badge.percent}%`}
              </Text>
            </View>
          ) : null}
        </View>
        <Text className="text-heading mt-1 text-[22px] leading-7" maxFontSizeMultiplier={1.3}>
          {plan.price}
        </Text>
        <Text className="font-ui text-muted mt-1 text-sm leading-5" maxFontSizeMultiplier={1.3}>
          {plan.subline}
        </Text>
      </View>

      <View className={`h-6 w-6 items-center justify-center rounded-pill border-2 ${selected ? "border-ember" : "border-muted"}`}>
        {selected ? <View className="h-3 w-3 rounded-pill bg-ember" /> : null}
      </View>
    </Pressable>
  );
}

/** Loading: three cards' shapes on `bg`, never a spinner. */
export function PlanCardsSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading plans" accessibilityState={{ busy: true }} className="gap-3">
      {[0, 1, 2].map((index) => (
        <View key={index} className="h-[116px] justify-center gap-2.5 rounded-card border border-raised bg-surface px-4">
          <View className="h-4 w-24 rounded-pill bg-raised" />
          <View className="h-6 w-20 rounded-pill bg-raised" />
          <View className="h-3.5 w-36 rounded-pill bg-raised" />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.raised,
    backgroundColor: colors.surface,
  },
  // 2dp, as measured: a 1dp ember line reads as a hairline, not a selection.
  selected: {
    borderWidth: 2,
    padding: 15,
    borderColor: colors.ember,
  },
});
