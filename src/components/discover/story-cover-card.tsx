import { Pressable, Text, View } from "react-native";

import { resolveSeedCoverAsset } from "@/constants/images";
import { Badge, Cover } from "@/components/ui";
import type { BookCatalogRow } from "@/types/catalog";

export const STORY_COVER_CARD_WIDTH = 128;

type StoryCoverCardProps = {
  book: BookCatalogRow;
  onPress: (id: string) => void;
};

/**
 * Cover card used in every M3 carousel — AGENTS.md prompt 09 step 6.
 * 12dp cover radius, Inter title, teal headphone `Badge` when the book has
 * audio (`audio_count > 0`).
 */
export function StoryCoverCard({ book, onPress }: StoryCoverCardProps) {
  const hasAudio = (book.audio_count ?? 0) > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${book.title ?? "story"}`}
      onPress={() => book.id && onPress(book.id)}
      style={{ width: STORY_COVER_CARD_WIDTH }}
      className="gap-2"
    >
      <View>
        <Cover
          source={resolveSeedCoverAsset(book.cover_path)}
          recyclingKey={book.id ?? undefined}
          width={STORY_COVER_CARD_WIDTH}
        />
        {hasAudio ? (
          <View style={{ position: "absolute", right: 6, bottom: 6 }}>
            <Badge icon="headset" />
          </View>
        ) : null}
      </View>
      <Text
        className="font-ui-medium text-body text-sm"
        numberOfLines={2}
        maxFontSizeMultiplier={1.3}
      >
        {book.title ?? "Untitled"}
      </Text>
    </Pressable>
  );
}
