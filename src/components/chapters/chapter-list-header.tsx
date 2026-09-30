import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Cover, SegmentedControl, type SegmentedOption } from "@/components/ui";
import type { ChapterSortOrder, DownloadAllState } from "@/lib/chapter-list";
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

export type DownloadAllSlot = {
  state: DownloadAllState;
  online: boolean;
  /** The chapters, their sizes and the lock inputs are being fetched fresh. */
  preparing: boolean;
  onDownloadAll: () => void;
  onCancel: () => void;
};

type ChapterSortBarProps = {
  order: ChapterSortOrder;
  onChange: (order: ChapterSortOrder) => void;
  /** Null where downloads don't run (the web preview): no slot. */
  download: DownloadAllSlot | null;
};

/**
 * Oldest first or newest first. One line each: the frame wraps both labels,
 * a design defect. "Download all" at the right, as material/5.png draws it.
 */
export function ChapterSortBar({ order, onChange, download }: ChapterSortBarProps) {
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
      <View className="flex-1" />
      {download ? <DownloadAll {...download} /> : null}
    </View>
  );
}

/**
 * The sort bar's "Download all" (prompt 24 step 12): teal with its download
 * icon, as the frame draws it; while a run goes, "12 of 41" and Cancel; with
 * nothing left, a disabled "All downloaded" in `muted`. Never ember. Offline
 * it is disabled: nothing can download without a connection.
 */
function DownloadAll({ state, online, preparing, onDownloadAll, onCancel }: DownloadAllSlot) {
  switch (state.kind) {
    case "hidden":
      return null;
    case "ready": {
      const disabled = !online || preparing;
      const count = state.count === 1 ? "1 chapter" : `${state.count} chapters`;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={online ? `Download all, ${count}` : "Download all. Not available offline"}
          accessibilityState={{ disabled, busy: preparing }}
          disabled={disabled}
          onPress={onDownloadAll}
          style={({ pressed }) => [styles.slot, { opacity: !online ? 0.5 : pressed ? 0.7 : 1 }]}
        >
          {preparing ? (
            <ActivityIndicator size="small" color={colors.teal} />
          ) : (
            <Ionicons name="download-outline" size={18} color={colors.teal} />
          )}
          <Text className="font-ui-medium text-teal text-[15px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            Download all
          </Text>
        </Pressable>
      );
    }
    case "running":
      return (
        <View className="flex-row items-center">
          <Text
            accessibilityLabel={`Downloading, ${state.done} of ${state.total} chapters`}
            accessibilityLiveRegion="polite"
            className="font-ui text-muted text-sm"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {`${state.done} of ${state.total}`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel downloads"
            onPress={onCancel}
            style={({ pressed }) => [styles.slot, styles.cancel, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text className="font-ui-medium text-teal text-[15px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              Cancel
            </Text>
          </Pressable>
        </View>
      );
    case "done":
      return (
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel="All downloaded"
          accessibilityState={{ disabled: true }}
          style={styles.slot}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.muted} />
          <Text className="font-ui-medium text-muted text-[15px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            All downloaded
          </Text>
        </View>
      );
  }
}

/** Why chapters failed to download, under the sort bar, until the reader tries again. */
export function DownloadFailureLine({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-start gap-2 border-b border-raised px-4 py-2.5"
    >
      <Ionicons name="alert-circle-outline" size={16} color={colors.muted} style={{ marginTop: 2 }} />
      <Text className="font-ui text-muted flex-1 text-[13px] leading-[18px]" maxFontSizeMultiplier={1.3}>
        {message}
      </Text>
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
  // A 44dp target whose text ends on the bar's 16dp edge.
  slot: {
    minHeight: layout.minTouchTarget,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 8,
  },
  cancel: {
    paddingLeft: 12,
  },
});
