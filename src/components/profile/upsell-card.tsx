import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { PLAN_NAME } from "@/constants/plan";

// M11's upsell — prompt 25 step 3, material/10.png: a `raised` card with the
// plan's name, a `muted` line, and the screen's one ember action. Shown only
// once the reader is known not to subscribe. The frame's "Go Ad-Free" and
// "Unlimited chapters, no interruptions" gave way to the plan's new name and
// what it gives (Decisions — 2026-10-01, "The paywall for a first visit").

/**
 * "See plans" is 44dp tall, where the frame draws about 34: AGENTS.md § UI
 * Quality Bar's touch target wins.
 */
export function UpsellCard({ onSeePlans }: { onSeePlans: () => void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-card bg-raised p-4">
      <View className="flex-1">
        <Text className="text-heading text-lg leading-7" maxFontSizeMultiplier={1.3}>
          {PLAN_NAME}
        </Text>
        <Text className="font-ui text-muted text-sm leading-5" maxFontSizeMultiplier={1.3}>
          Every chapter of every story
        </Text>
      </View>
      <Button
        label="See plans"
        accessibilityLabel={`See plans. Opens the ${PLAN_NAME} plans.`}
        onPress={onSeePlans}
      />
    </View>
  );
}
