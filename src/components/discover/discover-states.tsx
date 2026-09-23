import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui";
import { STORY_COVER_CARD_WIDTH } from "@/components/discover/story-cover-card";
import { colors } from "@/theme";

/**
 * M3 loading skeleton — AGENTS.md prompt 09 step 11. Sized to the real hero
 * card and cover cards, surface-matched on `bg`, never a spinner over a
 * blank screen.
 */
export function DiscoverSkeleton() {
  return (
    <View className="gap-6 px-4 pt-2">
      <View className="h-9 w-40 rounded-pill bg-surface" />
      <View className="h-80 rounded-card bg-surface" />
      <View className="gap-3">
        <View className="h-6 w-32 rounded-pill bg-surface" />
        <View className="flex-row gap-3">
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              className="aspect-[2/3] rounded-cover bg-surface"
              style={{ width: STORY_COVER_CARD_WIDTH }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

type DiscoverErrorProps = {
  onRetry: () => void;
};

/** Inline error with retry — AGENTS.md prompt 09 step 11: no `Alert.alert`, no toast. */
export function DiscoverError({ onRetry }: DiscoverErrorProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        We couldn&apos;t load Discover right now.
      </Text>
      <Button label="Retry" variant="secondary" onPress={onRetry} />
    </View>
  );
}

type DiscoverEmptyScreenProps = {
  onRetry: () => void;
};

/** Whole-screen empty state — the active tab's `books_catalog` query returned zero books. */
export function DiscoverEmptyScreen({ onRetry }: DiscoverEmptyScreenProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 px-8">
      <Ionicons name="book-outline" size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        Nothing to discover yet. Check back soon for new stories.
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Refresh" onPress={onRetry}>
        <Text className="font-ui-medium text-body text-sm" maxFontSizeMultiplier={1.3}>
          Refresh
        </Text>
      </Pressable>
    </View>
  );
}
