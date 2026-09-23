import { FlatList, Pressable, Text, View } from "react-native";

import { StoryCoverCard, STORY_COVER_CARD_WIDTH } from "@/components/discover/story-cover-card";
import { layout } from "@/theme";
import type { BookCatalogRow } from "@/types/catalog";

const CARD_GAP = 12;
const ITEM_LENGTH = STORY_COVER_CARD_WIDTH + CARD_GAP;

type CarouselSectionProps = {
  title: string;
  books: BookCatalogRow[];
  onPressBook: (id: string) => void;
  onPressSeeAll?: () => void;
  emptyLabel: string;
};

/**
 * One M3 carousel — "Picked for You" / "Trending Now" / "New Audio Releases"
 * (prompt 09 step 5). Virtualised with `FlatList horizontal` per step 9;
 * fixed card width means `getItemLayout` can be exact instead of measured.
 *
 * // NO BACKING METRIC — ordering is seed-array order, not a real
 * trending/recommendation signal (AGENTS.md Data Contract: no reads table).
 */
export function CarouselSection({
  title,
  books,
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
            {/* DEVIATION: the design material renders "See all" in teal, but
                prompt 09 step 6 reserves teal exclusively for the audio
                badge on this screen ("do not use teal anywhere else").
                Following the prompt's stricter text over the image. */}
            <Text className="font-ui-medium text-muted text-sm" maxFontSizeMultiplier={1.3}>
              See all
            </Text>
          </Pressable>
        ) : null}
      </View>

      {books.length === 0 ? (
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
          renderItem={({ item }) => <StoryCoverCard book={item} onPress={onPressBook} />}
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
