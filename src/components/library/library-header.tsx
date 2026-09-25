import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SegmentedControl, type SegmentedOption } from "@/components/ui";
import type { LibrarySegment } from "@/lib/library";
import { colors } from "@/theme";

/** Measured from material/9.png: a 36dp disc, given 4dp of hit slop all round to reach 44dp. */
const SEARCH_SIZE = 36;

type LibraryHeaderProps = {
  onSearch: () => void;
};

/** "My Library" in Fraunces, and the round search button, filled `surface` as material/9.png draws it. */
export function LibraryHeader({ onSearch }: LibraryHeaderProps) {
  return (
    <View className="flex-row items-center justify-between px-4 pb-2.5 pt-2">
      <Text accessibilityRole="header" className="text-heading text-2xl leading-8" maxFontSizeMultiplier={1.3}>
        My Library
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search"
        hitSlop={4}
        onPress={onSearch}
        // No className beside a `style` function (AGENTS.md § Style Exception Rules).
        style={({ pressed }) => [styles.search, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Ionicons name="search" size={18} color={colors.body} />
      </Pressable>
    </View>
  );
}

type LibrarySegmentsProps = {
  value: LibrarySegment;
  onChange: (segment: LibrarySegment) => void;
  /** The counts, once My List has loaded. Bare labels before. */
  counts: Record<LibrarySegment, number> | null;
};

/** Books / Audiobooks, full width. Filters in place: no route push, no tab change. */
export function LibrarySegments({ value, onChange, counts }: LibrarySegmentsProps) {
  const options: SegmentedOption<LibrarySegment>[] = [
    { value: "books", label: counts ? `Books (${counts.books})` : "Books" },
    { value: "audiobooks", label: counts ? `Audiobooks (${counts.audiobooks})` : "Audiobooks" },
  ];

  return (
    <View className="px-4">
      <SegmentedControl
        options={options}
        value={value}
        onChange={onChange}
        accessibilityLabel="My List"
        track="surface"
      />
    </View>
  );
}

/**
 * "My List ({count in this segment})", and a static caption. The frame's
 * "Recently Updated" would be untrue: the list is ordered by when each book
 * was saved (`created_at desc`). Not a control.
 */
export function MyListHeading({ count }: { count: number }) {
  return (
    <View className="mb-3 mt-6 flex-row items-center justify-between gap-3 px-4">
      <Text accessibilityRole="header" className="text-heading text-lg leading-6" maxFontSizeMultiplier={1.3}>
        {`My List (${count})`}
      </Text>
      <Text className="font-ui text-muted text-sm" numberOfLines={1} maxFontSizeMultiplier={1.3}>
        Recently added
      </Text>
    </View>
  );
}

/** The segment bar while My List loads. */
export function LibrarySegmentsSkeleton() {
  return (
    <View className="px-4">
      <View className="h-11 rounded-pill bg-surface" />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    width: SEARCH_SIZE,
    height: SEARCH_SIZE,
    borderRadius: SEARCH_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.raised,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});
