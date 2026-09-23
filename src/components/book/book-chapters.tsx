import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { ChapterRowsSkeleton, ChaptersEmpty, ChaptersError } from "@/components/book/book-states";
import { ChapterPreviewRow } from "@/components/book/chapter-preview-row";
import type { ChaptersSection } from "@/hooks/use-book-detail";
import { colors } from "@/theme";

type BookChaptersProps = {
  /** `books_catalog.chapter_count` — computed by the view, never the preview's length. */
  chapterCount: number | null;
  section: ChaptersSection;
  onRetry: () => void;
  onOpenChapter: (chapterId: string) => void;
  onSeeAll: () => void;
};

/**
 * M4's chapter preview and its entry point to M9.
 *
 * The frame's right-hand "Read / Audio Parity" label is omitted: it explains
 * a "min read · audio" pair whose read half has no word-count column behind it.
 *
 * A handful of rows, so `.map()` inside the page's ScrollView is fine — the
 * unbounded list is M9's, and that one is virtualised.
 */
export function BookChapters({
  chapterCount,
  section,
  onRetry,
  onOpenChapter,
  onSeeAll,
}: BookChaptersProps) {
  return (
    <View className="gap-3 px-4">
      <Text
        accessibilityRole="header"
        className="text-heading text-xl leading-7"
        maxFontSizeMultiplier={1.3}
      >
        {chapterCount === null ? "Chapters" : `Chapters (${chapterCount})`}
      </Text>

      {section.status === "loading" ? (
        <ChapterRowsSkeleton />
      ) : section.status === "error" ? (
        <ChaptersError onRetry={onRetry} />
      ) : section.rows.length === 0 ? (
        <ChaptersEmpty />
      ) : (
        // 12dp between cards — wider than the frame's 8dp, which read as
        // cramped on device. ChapterRowsSkeleton uses the same gap.
        <View className="gap-3">
          {section.rows.map((chapter) => (
            <ChapterPreviewRow key={chapter.id} chapter={chapter} onOpen={onOpenChapter} />
          ))}
        </View>
      )}

      {chapterCount !== null && chapterCount > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`See all ${chapterCount} ${chapterCount === 1 ? "chapter" : "chapters"}`}
          onPress={onSeeAll}
          className="min-h-11 flex-row items-center justify-center gap-1 self-center px-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Text
            className="font-ui-semibold text-teal text-[15px]"
            maxFontSizeMultiplier={1.3}
          >
            See all chapters
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.teal} />
        </Pressable>
      ) : null}
    </View>
  );
}
