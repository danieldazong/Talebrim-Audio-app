import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Button } from "@/components/ui";
import {
  SEARCH_COVER_WIDTH,
  SEARCH_RESULT_ROW_HEIGHT,
} from "@/components/search/search-result-row";
import { colors } from "@/theme";

// M8's non-result states — prompt 11 step 8. Each is built to be told apart
// at a glance: idle is a left-aligned list (or prompt) with no icon; no
// results is centred with a search glyph, the typed term and an outlined
// "Clear search"; error is centred with an offline glyph and a filled Retry.

const SKELETON_ROWS = [0, 1, 2, 3, 4, 5];

/** Hairline between result rows — shared with the real list so the skeleton lines up. */
export function SearchRowSeparator() {
  return <View className="mx-4 h-px bg-raised" />;
}

/** Loading — skeleton rows at the real row's size, never a centred spinner. */
export function SearchSkeleton() {
  return (
    <View accessible accessibilityLabel="Searching" accessibilityState={{ busy: true }}>
      {/* Stands in for the "N results" line: same 40dp band. */}
      <View className="mx-4 mb-3 mt-3 h-4 w-20 rounded-pill bg-surface" />
      {SKELETON_ROWS.map((key) => (
        <View key={key}>
          {key > 0 ? <SearchRowSeparator /> : null}
          <View
            className="flex-row items-center gap-3 px-4"
            style={{ height: SEARCH_RESULT_ROW_HEIGHT }}
          >
            <View
              className="aspect-[2/3] rounded-cover bg-surface"
              style={{ width: SEARCH_COVER_WIDTH }}
            />
            <View className="flex-1 gap-2.5">
              <View className="h-4 w-3/5 rounded-pill bg-surface" />
              <View className="h-3 w-2/5 rounded-pill bg-surface" />
              <View className="h-3 w-1/2 rounded-pill bg-surface" />
            </View>
            <View className="h-8 w-8 rounded-pill bg-surface" />
          </View>
        </View>
      ))}
    </View>
  );
}

type SearchIdleProps = {
  recentSearches: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
};

/**
 * Idle — nothing typed yet. Recent searches when there are any (AGENTS.md
 * M8); otherwise a short prompt. Empty input is never "no results".
 */
export function SearchIdle({ recentSearches, onSelect, onRemove }: SearchIdleProps) {
  return (
    <ScrollView
      className="no-scrollbar"
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16 }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {recentSearches.length === 0 ? (
        <View className="gap-2">
          <Text className="text-heading text-lg" maxFontSizeMultiplier={1.3}>
            Find your next story
          </Text>
          <Text className="font-ui text-muted text-[15px]" maxFontSizeMultiplier={1.5}>
            Search by title or author.
          </Text>
        </View>
      ) : (
        <>
          <Text
            accessibilityRole="header"
            className="text-heading mb-3 text-lg"
            maxFontSizeMultiplier={1.3}
          >
            Recent searches
          </Text>
          {recentSearches.map((term) => (
            <View key={term} className="min-h-12 flex-row items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Search for ${term}`}
                onPress={() => onSelect(term)}
                className="min-h-12 flex-1 flex-row items-center gap-3"
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Ionicons name="time-outline" size={18} color={colors.muted} />
                <Text
                  className="font-ui text-muted flex-1 text-[15px]"
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.5}
                >
                  {term}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${term} from recent searches`}
                onPress={() => onRemove(term)}
                className="-mr-2 h-11 w-11 items-center justify-center"
              >
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

type SearchNoResultsProps = {
  /** The term the query actually ran for, as the user typed it. */
  term: string;
  /** Lower-case noun for the active filter chip, e.g. "audiobooks"; null for All. */
  scope: string | null;
  onClear: () => void;
};

/** No results — names the typed term; distinct from idle and from an error. */
export function SearchNoResults({ term, scope, onClear }: SearchNoResultsProps) {
  return (
    <View className="items-center gap-3 px-8 pt-16" accessibilityLiveRegion="polite">
      <Ionicons name="search-outline" size={32} color={colors.muted} />
      <Text className="text-heading text-center text-lg" maxFontSizeMultiplier={1.3}>
        {scope ? `No ${scope} for “${term}”` : `No results for “${term}”`}
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        Check the spelling, or try a shorter title or an author&apos;s name.
      </Text>
      <Button label="Clear search" variant="outlined" className="mt-2" onPress={onClear} />
    </View>
  );
}

type SearchErrorProps = {
  onRetry: () => void;
};

/** Error — inline with a retry. No `Alert.alert`, no toast. */
export function SearchError({ onRetry }: SearchErrorProps) {
  return (
    <View className="items-center gap-3 px-8 pt-16" accessibilityLiveRegion="polite">
      <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        We couldn&apos;t search right now.
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        Check your connection and try again.
      </Text>
      <Button label="Retry" variant="secondary" className="mt-2" onPress={onRetry} />
    </View>
  );
}
