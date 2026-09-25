import { FlatList, Pressable, Text, View } from "react-native";

import { StoryCoverCard, STORY_COVER_CARD_WIDTH } from "@/components/discover/story-cover-card";
import { resolveCoverUrl } from "@/lib/covers";
import { layout } from "@/theme";
import type { CarouselBookRow } from "@/types/catalog";

const CARD_GAP = 12;
const ITEM_LENGTH = STORY_COVER_CARD_WIDTH + CARD_GAP;

type CarouselSectionProps = {
  title: string;
  books: CarouselBookRow[];
  /** This carousel's own query is still in flight — renders row skeletons, never a blank/empty state (a pending query is not the same as a genuinely empty result). */
  isLoading?: boolean;
  /** This carousel's own query failed — renders an inline retry, distinct from a genuinely empty result. */
  isError?: boolean;
  onRetry?: () => void;
  /** Live `app_settings.public_cdn_domain` — `null` while app settings are still loading defers cover resolution to the placeholder box. */
  publicCdnDomain: string | null;
  onPressBook: (id: string) => void;
  onPressSeeAll?: () => void;
  emptyLabel: string;
};

/**
 * One M3 carousel — "Picked for You" / "Trending Now" / "New Audio Releases"
 * (prompt 09 step 5). Virtualised with `FlatList horizontal` per step 9;
 * fixed card width means `getItemLayout` can be exact instead of measured.
 * Generic over any real ordering its caller passes in — "Trending Now" has
 * no backing metric and is rendered with an empty `books` array instead
 * (see `app/(tabs)/index.tsx`), not a special case here.
 */
export function CarouselSection({
  title,
  books,
  isLoading = false,
  isError = false,
  onRetry,
  publicCdnDomain,
  onPressBook,
  onPressSeeAll,
  emptyLabel,
}: CarouselSectionProps) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-4">
        <Text className="text-heading text-xl" maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {onPressSeeAll ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`See all ${title}`}
            hitSlop={8}
            onPress={onPressSeeAll}
            style={{ minHeight: layout.minTouchTarget, justifyContent: "center" }}
          >
            {/* Teal, as the design draws it: a secondary accent (AGENTS.md
                § Design System). The owner lifted prompt 09's "no teal
                elsewhere" on 2026-09-25. */}
            <Text className="font-ui-medium text-teal text-sm" maxFontSizeMultiplier={1.3}>
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>

      {isLoading ? (
        <View className="flex-row gap-3 px-4">
          {[0, 1, 2].map((key) => (
            <View
              key={key}
              className="aspect-[2/3] rounded-cover bg-surface"
              style={{ width: STORY_COVER_CARD_WIDTH }}
            />
          ))}
        </View>
      ) : isError ? (
        <View className="gap-3 px-4">
          <Text className="font-ui text-muted text-sm" maxFontSizeMultiplier={1.5}>
            We couldn&apos;t load this section.
          </Text>
          {onRetry ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Retry ${title}`} onPress={onRetry}>
              <Text className="font-ui-medium text-body text-sm" maxFontSizeMultiplier={1.3}>
                Retry
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : books.length === 0 ? (
        <View className="px-4">
          <Text className="font-ui text-muted text-sm" maxFontSizeMultiplier={1.5}>
            {emptyLabel}
          </Text>
        </View>
      ) : (
        <FlatList
          horizontal
          className="no-scrollbar"
          data={books}
          keyExtractor={(item, index) => item.id ?? `${title}-${index}`}
          renderItem={({ item }) => (
            <StoryCoverCard
              book={item}
              coverUrl={publicCdnDomain === null ? null : resolveCoverUrl(publicCdnDomain, item.cover_path)}
              onPress={onPressBook}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: CARD_GAP, paddingHorizontal: 16 }}
          initialNumToRender={4}
          getItemLayout={(_, index) => ({
            length: ITEM_LENGTH,
            offset: ITEM_LENGTH * index,
            index,
          })}
        />
      )}
    </View>
  );
}
