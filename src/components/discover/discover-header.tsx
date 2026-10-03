import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { images } from "@/constants/images";
import { useUnreadUpdates } from "@/hooks/use-updates";
import { colors } from "@/theme";

type DiscoverHeaderProps = {
  onPressSearch: () => void;
};

/** The logo is a 192 × 172 px drawing with no margin; kept to that ratio. */
const LOGO_SIZE = { width: 22, height: 20 };

/**
 * M3 header — AGENTS.md prompt 09 step 2. The brand left, search and
 * notification icons right.
 *
 * The brand is the logo beside the name in Fraunces, at half the size of the
 * frame's text wordmark (Decisions — 2026-10-03, "M3's header brand"). The logo
 * is decorative: the name beside it says the same to a screen reader.
 *
 * DEVIATION TO REPORT: the design material's header reads "NovelNow" — the
 * product name is talebrim (AGENTS.md throughout). Rendering "talebrim",
 * not the material's placeholder brand text.
 */
export function DiscoverHeader({ onPressSearch }: DiscoverHeaderProps) {
  const unread = useUnreadUpdates();

  return (
    <View className="flex-row items-center justify-between px-4 py-3">
      <View className="flex-row items-center gap-2">
        <Image source={images.logo} contentFit="contain" style={LOGO_SIZE} accessible={false} />
        <Text className="text-heading text-xs" maxFontSizeMultiplier={1.3}>
          talebrim
        </Text>
      </View>

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

        {/* Updates (2026-09-30): new chapters of the stories on My List, with
            alerts' on/off row. A teal dot while any is new; the label says
            how many, since a dot is colour alone. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            unread > 0 ? `Updates, ${unread} new ${unread === 1 ? "chapter" : "chapters"}` : "Updates"
          }
          hitSlop={8}
          onPress={() => router.push("/updates")}
          className="icon-btn icon-btn--round"
        >
          <Ionicons name="notifications-outline" size={20} color={colors.body} />
          {unread > 0 ? (
            <View
              pointerEvents="none"
              className="absolute right-2 top-2 h-2.5 w-2.5 rounded-pill border-2 border-bg bg-teal"
            />
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}
