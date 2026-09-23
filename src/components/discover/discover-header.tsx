import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/theme";

type DiscoverHeaderProps = {
  onPressSearch: () => void;
};

/**
 * M3 header — AGENTS.md prompt 09 step 2. Wordmark left, search and
 * notification icons right.
 *
 * // MISSING ASSET: wordmark — AGENTS.md defines no logo asset and the
 * Image Generation Rules forbid creating one, so this renders the word
 * "talebrim" as a Fraunces text wordmark instead of an image.
 *
 * DEVIATION TO REPORT: the design material's header reads "NovelNow" — the
 * product name is talebrim (AGENTS.md throughout). Rendering "talebrim",
 * not the material's placeholder brand text.
 */
export function DiscoverHeader({ onPressSearch }: DiscoverHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <Text className="text-heading text-2xl" maxFontSizeMultiplier={1.3}>
        talebrim
      </Text>

      <View className="flex-row items-center gap-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search"
          hitSlop={8}
          onPress={onPressSearch}
          className="icon-btn icon-btn--round"
        >
          <Ionicons name="search" size={20} color={colors.body} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
          // TODO: no notifications screen/feature exists yet — no-op until
          // one is built.
          className="icon-btn icon-btn--round"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.body} />
        </Pressable>
      </View>
    </View>
  );
}
