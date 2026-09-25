import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Cover, SegmentedControl, type SegmentedOption } from "@/components/ui";
import type { ChapterSortOrder } from "@/lib/chapter-list";
import { colors, layout } from "@/theme";

/** Measured from material/5.png: a 36dp-wide 2:3 cover, 10dp above and below. */
const HEADER_COVER_WIDTH = 36;

export type ChapterListBook = {
  title: string;
  coverUrl: string | null;
  recyclingKey?: string;
};

type ChapterListHeaderProps = {
  onBack: () => void;
  /** Null until the book is known, and when there is none. */
  book: ChapterListBook | null;
  /** "{N} chapters · {M} unlocked", once the rows are known. */
  counts: { chapters: number; unlocked: number } | null;
  /** Skeleton shapes where the book will go. */
  loading?: boolean;
};

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/**
 * M9's header, fixed above the list rather than a sticky list header, so the
 * sort toggle below it always takes a tap (react-native#51763). On `surface`,
 * as material/5.png draws it. Back shows in every state.
 */
export function ChapterListHeader({ onBack, book, counts, loading = false }: ChapterListHeaderProps) {
  return (
    <View className="min-h-[74px] flex-row items-center bg-surface py-2.5 pl-1.5 pr-4">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        // No className beside a `style` function (AGENTS.md § Style Exception Rules).
        style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.body} />
      </Pressable>

      {book ? (
        <>
          <View className="ml-1.5">
            <Cover
              source={book.coverUrl === null ? null : { uri: book.coverUrl }}
              recyclingKey={book.recyclingKey}
              width={HEADER_COVER_WIDTH}
            />
          </View>
          <View className="ml-3 flex-1 gap-0.5">
            <Text
              accessibilityRole="header"
              className="text-heading text-lg leading-6"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {book.title}
            </Text>
            {counts ? (
              <Text
                accessibilityLabel={`${plural(counts.chapters, "chapter")}, ${counts.unlocked} unlocked`}
                className="font-ui text-muted text-[13px] leading-[18px]"
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {`${plural(counts.chapters, "chapter")} · ${counts.unlocked} unlocked`}
              </Text>
            ) : null}
          </View>
        </>
      ) : loading ? (
        <>
          <View className="ml-1.5 aspect-[2/3] rounded-cover bg-raised" style={{ width: HEADER_COVER_WIDTH }} />
          <View className="ml-3 flex-1 gap-2.5">
            <View className="h-4 w-40 rounded-pill bg-raised" />
            <View className="h-3 w-32 rounded-pill bg-raised" />
          </View>
        </>
      ) : null}
    </View>
  );
}

const SORT_OPTIONS: readonly SegmentedOption<ChapterSortOrder>[] = [
  { value: "oldest", label: "Oldest first" },
  { value: "newest", label: "Newest first" },
];

/** The frame's control is 196dp wide, on `bg` below the header. */
const SORT_WIDTH = "w-[196px]";

type ChapterSortBarProps = {
  order: ChapterSortOrder;
  onChange: (order: ChapterSortOrder) => void;
};

/**
 * Oldest first or newest first. One line each: the frame wraps both labels,
 * a design defect.
 */
export function ChapterSortBar({ order, onChange }: ChapterSortBarProps) {
  return (
    <View className="flex-row items-center border-b border-raised px-4 py-1">
      <SegmentedControl
        options={SORT_OPTIONS}
        value={order}
        onChange={onChange}
        accessibilityLabel="Sort chapters"
        track="surface"
        className={SORT_WIDTH}
      />
      {/* TODO(downloads): "Download all" sits at the right, with real progress. */}
    </View>
  );
}

/** The sort bar while the list loads. */
export function ChapterSortBarSkeleton() {
  return (
    <View className="border-b border-raised px-4 py-1">
      <View className={`h-11 rounded-pill bg-surface ${SORT_WIDTH}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
});
