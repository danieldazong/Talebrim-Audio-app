import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { BOOK_CONTENT_TOP, BOOK_COVER_WIDTH } from "@/components/book/book-header";
import { CHAPTER_ROW_HEIGHT } from "@/components/book/chapter-preview-row";
import { Button } from "@/components/ui";
import { colors } from "@/theme";

// M4's non-content states — prompt 12 step 15. All on the `bg` surface.
// Whole-screen states sit below the floating top bar, which stays mounted so
// Back always works.

const SKELETON_ROWS = [0, 1, 2];
const SYNOPSIS_LINES = ["w-full", "w-full", "w-full", "w-2/3"];

/** Chapter rows while the preview, the settings and the unlocks load. */
export function ChapterRowsSkeleton() {
  return (
    <View className="gap-3" accessible accessibilityLabel="Loading chapters" accessibilityState={{ busy: true }}>
      {SKELETON_ROWS.map((key) => (
        <View key={key} className="rounded-card bg-surface" style={{ height: CHAPTER_ROW_HEIGHT }} />
      ))}
    </View>
  );
}

/** Loading — shaped like the real header and rows, never a spinner. */
export function BookDetailSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading story"
      accessibilityState={{ busy: true }}
      className="flex-1 items-center overflow-hidden px-4"
      style={{ paddingTop: BOOK_CONTENT_TOP }}
    >
      <View className="aspect-[2/3] rounded-cover bg-surface" style={{ width: BOOK_COVER_WIDTH }} />
      <View className="mt-5 h-7 w-48 rounded-pill bg-surface" />
      <View className="mt-3 h-4 w-32 rounded-pill bg-surface" />
      <View className="mt-4 h-4 w-40 rounded-pill bg-surface" />
      <View className="mt-5 flex-row gap-2">
        {SKELETON_ROWS.map((key) => (
          <View key={key} className="h-[34px] w-24 rounded-pill bg-surface" />
        ))}
      </View>
      <View className="mt-5 flex-row gap-3 self-stretch">
        <View className="h-12 flex-1 rounded-pill bg-surface" />
        <View className="h-12 flex-1 rounded-pill bg-surface" />
      </View>
      <View className="mt-8 gap-2.5 self-stretch">
        <View className="mb-1 h-6 w-28 rounded-pill bg-surface" />
        {SYNOPSIS_LINES.map((width, index) => (
          <View key={index} className={`h-3.5 rounded-pill bg-surface ${width}`} />
        ))}
      </View>
      <View className="mt-8 gap-3 self-stretch">
        <View className="h-6 w-36 rounded-pill bg-surface" />
        <ChapterRowsSkeleton />
      </View>
    </View>
  );
}

type BookNotFoundProps = {
  onBack: () => void;
};

/**
 * Not found — a malformed id, or a book that is unpublished, deleted or
 * hidden from this reader. Its own state, not an error: retrying cannot help.
 */
export function BookNotFound({ onBack }: BookNotFoundProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name="book-outline" size={32} color={colors.muted} />
      <Text className="text-heading text-center text-xl" maxFontSizeMultiplier={1.3}>
        This story isn&apos;t available
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        It may have been taken down, or the link is out of date.
      </Text>
      <Button label="Go back" variant="secondary" className="mt-2" onPress={onBack} />
    </View>
  );
}

type RetryProps = {
  onRetry: () => void;
};

/** The book itself failed to load — M8's error look. No `Alert.alert`, no toast. */
export function BookError({ onRetry }: RetryProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        We couldn&apos;t load this story.
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        Check your connection and try again.
      </Text>
      <Button label="Retry" variant="secondary" className="mt-2" onPress={onRetry} />
    </View>
  );
}

/** Chapters, settings or unlocks failed — inline, while the header stays on screen. */
export function ChaptersError({ onRetry }: RetryProps) {
  return (
    <View
      className="items-center gap-3 rounded-card border border-raised px-4 py-6"
      accessibilityLiveRegion="polite"
    >
      <Ionicons name="cloud-offline-outline" size={24} color={colors.muted} />
      <Text className="font-ui text-body text-center text-sm" maxFontSizeMultiplier={1.5}>
        We couldn&apos;t load the chapters. Check your connection and try again.
      </Text>
      <Button label="Retry" variant="secondary" onPress={onRetry} />
    </View>
  );
}

/** The book is published with no chapters yet. */
export function ChaptersEmpty() {
  return (
    <View className="items-center rounded-card border border-raised px-4 py-6">
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        No chapters yet
      </Text>
    </View>
  );
}
