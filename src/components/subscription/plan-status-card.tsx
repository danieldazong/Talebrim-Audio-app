import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/theme";

export type PlanStatus = {
  /** The store product's title, or a fallback when it isn't in the offering. */
  title: string;
  /** "Renews 21 Sept 2026 · $4.99/week", or "Ends 21 Sept 2026"; null without an expiry. */
  renewal: string | null;
  /** Bought through Google Play, not granted another way. */
  billedByPlay: boolean;
};

/**
 * A subscriber's plan, from material/11.png: a check disc, the plan's name
 * and a teal "Active" pill, then under a hairline when it renews or ends and
 * how it is billed. On `raised`, as the frame measures (#2C1E42), which sets
 * it apart from the `surface` plan cards below. One element for screen
 * readers, the pill included.
 */
export function PlanStatusCard({ status }: { status: PlanStatus }) {
  const lines = [status.renewal, status.billedByPlay ? "Billed through Google Play" : null].filter(
    (line) => line !== null,
  );

  return (
    <View
      accessible
      accessibilityLabel={`${status.title}. Active. ${lines.map((line) => `${line}.`).join(" ")}`.trim()}
      className="rounded-card bg-raised p-4"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-pill bg-teal/20">
          <Ionicons name="checkmark" size={18} color={colors.teal} />
        </View>
        <Text className="text-heading flex-1 text-xl leading-7" numberOfLines={2} maxFontSizeMultiplier={1.3}>
          {status.title}
        </Text>
        <View className="rounded-pill bg-teal/10 px-3 py-1">
          <Text className="font-ui-semibold text-teal text-sm leading-5" maxFontSizeMultiplier={1.3}>
            Active
          </Text>
        </View>
      </View>

      {lines.length > 0 ? (
        <>
          <View className="mt-4 h-px bg-bg/40" />
          <View className="mt-3 gap-1">
            {lines.map((line) => (
              <Text key={line} className="font-ui text-muted text-sm leading-5" maxFontSizeMultiplier={1.5}>
                {line}
              </Text>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/** Loading: the card's shape, on `raised`. */
export function PlanStatusCardSkeleton() {
  return (
    <View className="gap-4 rounded-card bg-raised p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-8 w-8 rounded-pill bg-surface" />
        <View className="h-5 w-40 rounded-pill bg-surface" />
      </View>
      <View className="h-3.5 w-52 rounded-pill bg-surface" />
    </View>
  );
}
