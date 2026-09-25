import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { LIBRARY_PROGRESS_HEIGHT } from "@/components/library/continue-card";
import { Cover, ProgressBar } from "@/components/ui";
import type { LibraryGridBook } from "@/hooks/use-library";
import { colors } from "@/theme";

/** Two lines of the title, at the default text size. */
export const GRID_TITLE_LINE_HEIGHT = 20;

type LibraryGridItemProps = {
  book: LibraryGridBook;
  /** A third of the row, inside the side padding and gutters. */
  width: number;
  /** Two lines' height, reserved so the rows align at any text size. */
  titleMinHeight: number;
  onOpen: (bookId: string) => void;
};

/**
 * One My List book, as material/9.png draws it: the 2:3 cover with a
 * `raised` hairline, the teal headphone disc top-right on audiobooks, the
 * ember progress line along the cover's bottom edge, and the title below.
 * No author: the frame shows none.
 *
 * One element for a screen reader, which hears the author and progress too.
 */
export function LibraryGridItem({ book, width, titleMinHeight, onOpen }: LibraryGridItemProps) {
  const fraction = book.progress?.fraction ?? null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={book.accessibilityLabel}
      onPress={() => onOpen(book.bookId)}
      // No className beside a `style` function (AGENTS.md § Style Exception Rules).
      style={({ pressed }) => ({ width, opacity: pressed ? 0.85 : 1 })}
    >
      <View className="overflow-hidden rounded-cover border border-raised">
        <Cover source={book.coverUrl === null ? null : { uri: book.coverUrl }} recyclingKey={book.bookId} />
        {book.isAudiobook ? (
          <View className="absolute right-1.5 top-1.5 h-6 w-6 items-center justify-center rounded-pill bg-bg/80">
            <Ionicons name="headset" size={13} color={colors.teal} />
          </View>
        ) : null}
        {fraction === null ? null : (
          <ProgressBar
            value={fraction}
            height={LIBRARY_PROGRESS_HEIGHT}
            track={false}
            className="absolute inset-x-0 bottom-0"
          />
        )}
      </View>
      <Text
        className="font-ui-semibold text-body mt-2 text-sm leading-5"
        numberOfLines={2}
        maxFontSizeMultiplier={1.3}
        style={{ minHeight: titleMinHeight }}
      >
        {book.title}
      </Text>
    </Pressable>
  );
}
