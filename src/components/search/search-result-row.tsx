import { Pressable, Text, View } from "react-native";

import { Badge, Cover } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import type { SearchBookRow } from "@/types/catalog";

/** 2:3 → 84dp tall. */
export const SEARCH_COVER_WIDTH = 56;

/**
 * Fixed so the results `FlatList` can use an exact `getItemLayout`:
 * 8dp + 84dp cover + 8dp, measured from material/4.png.
 */
export const SEARCH_RESULT_ROW_HEIGHT = 100;

type SearchResultRowProps = {
  book: SearchBookRow;
  /** Resolved via `resolveCoverUrl()` — never built inline here. */
  coverUrl: string | null;
  onPress: (id: string) => void;
};

/**
 * One M8 result — AGENTS.md M8, prompt 11 step 9.
 *
 * NO BACKING METRIC: the design's "★ 4.8" rating and "Ongoing"/"Completed"
 * label are omitted. `books_catalog` has no rating column and no completion
 * status (`status` is draft | published and every row here is published).
 * Duration shows only for narrated books — a text-only book has no audio to
 * measure, so "Duration unknown" would misdescribe it.
 */
export function SearchResultRow({ book, coverUrl, onPress }: SearchResultRowProps) {
  const title = book.title ?? "Untitled";
  const author = book.author ?? "Unknown author";
  const hasAudio = (book.audio_count ?? 0) > 0;

  const meta = [
    book.chapter_count === null
      ? null
      : `${book.chapter_count} ${book.chapter_count === 1 ? "chapter" : "chapters"}`,
    hasAudio ? formatDuration(book.total_duration_seconds) : null,
  ]
    .filter((part) => part !== null)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, by ${author}. ${meta}. ${hasAudio ? "Audiobook" : "Text only"}`}
      onPress={() => book.id && onPress(book.id)}
      className="flex-row items-center gap-3 px-4"
      style={({ pressed }) => ({ height: SEARCH_RESULT_ROW_HEIGHT, opacity: pressed ? 0.7 : 1 })}
    >
      <Cover
        source={coverUrl === null ? null : { uri: coverUrl }}
        recyclingKey={book.id ?? undefined}
        width={SEARCH_COVER_WIDTH}
      />

      <View className="flex-1 justify-center">
        <Text
          className="text-heading text-base leading-[22px]"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {title}
        </Text>
        <Text
          className="font-ui text-muted text-sm leading-[22px]"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {author}
        </Text>
        <Text
          className="font-ui text-muted text-[13px] leading-[22px]"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {meta}
        </Text>
      </View>

      {hasAudio ? (
        <Badge variant="round" icon="headset" />
      ) : (
        <Badge variant="outline" label="Text only" />
      )}
    </Pressable>
  );
}
