import { Text, View } from "react-native";

import { Button } from "@/components/ui";

// M11's upsell — prompt 25 step 3, material/10.png: a `raised` card with
// "Go Ad-Free", a `muted` line, and the screen's one ember action. Shown only
// once the reader is known not to subscribe.

/**
 * "See plans" is 44dp tall, where the frame draws about 34: AGENTS.md § UI
 * Quality Bar's touch target wins.
 */
export function UpsellCard({ onSeePlans }: { onSeePlans: () => void }) {
  return (
    <View className="flex-row items-center gap-3 rounded-card bg-raised p-4">
      <View className="flex-1">
        <Text className="text-heading text-lg leading-7" maxFontSizeMultiplier={1.3}>
          Go Ad-Free
        </Text>
        <Text className="font-ui text-muted text-sm leading-5" maxFontSizeMultiplier={1.3}>
          Unlimited chapters, no interruptions
        </Text>
      </View>
      <Button label="See plans" accessibilityLabel="See plans. Opens the Ad-Free plans." onPress={onSeePlans} />
    </View>
  );
}
