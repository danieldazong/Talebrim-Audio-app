import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  SEARCH_RESULT_ROW_HEIGHT,
  SearchResultRow,
} from "@/components/search/search-result-row";
import {
  SearchError,
  SearchIdle,
  SearchNoResults,
  SearchRowSeparator,
  SearchSkeleton,
} from "@/components/search/search-states";
import { Chip, Screen } from "@/components/ui";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { resolveCoverUrl } from "@/lib/covers";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { searchByTermOptions } from "@/lib/queries/search";
import {
  SEARCH_DEBOUNCE_MS,
  SEARCH_FILTERS,
  filterSearchResults,
  normalizeSearchTerm,
  tidySearchInput,
  type SearchFilter,
} from "@/lib/search";
import { useSearchStore } from "@/store/search-store";
import { colors, fonts } from "@/theme";

// M8 Search & Results — AGENTS.md M8, prompt 11.
//
// No mini player: this is a stack route outside (tabs), and the visibility
// map in `lib/mini-player-visibility.ts` covers tab routes only — M8 is not
// in it, so its mini-player behaviour is unspecified rather than guessed.

/** A row plus its 1dp separator — exact because both are fixed-height. */
const ITEM_LENGTH = SEARCH_RESULT_ROW_HEIGHT + 1;

/** Noun for the no-results line per chip; All reads "No results for …". */
const FILTER_SCOPE: Record<SearchFilter, string | null> = {
  all: null,
  books: "titles",
  audiobooks: "audiobooks",
  authors: "authors",
};

export default function Search() {
  const inputRef = useRef<TextInput>(null);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const debouncedInput = useDebouncedValue(input, SEARCH_DEBOUNCE_MS);

  const recentSearches = useSearchStore((state) => state.recentSearches);
  const addRecentSearch = useSearchStore((state) => state.addRecentSearch);
  const removeRecentSearch = useSearchStore((state) => state.removeRecentSearch);

  const search = useQuery(searchByTermOptions(debouncedInput));
  const appSettings = useQuery(appSettingsOptions());
  const publicCdnDomain = appSettings.data?.public_cdn_domain ?? null;

  const hasInput = normalizeSearchTerm(input).length > 0;
  // What the query actually ran for. Results and the no-results line
  // describe this, not the live input, which may be mid-debounce.
  const searchedTerm = tidySearchInput(debouncedInput);
  const rows = search.data
    ? filterSearchResults(search.data.rows, searchedTerm, filter)
    : [];
  const hasMore = search.data?.hasMore ?? false;

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function clearInput() {
    setInput("");
    inputRef.current?.focus();
  }

  function searchRecent(term: string) {
    Keyboard.dismiss();
    setInput(term);
    addRecentSearch(term);
  }

  function openBook(id: string) {
    addRecentSearch(searchedTerm);
    router.push({ pathname: "/book/[id]", params: { id } });
  }

  return (
    <Screen>
      <View className="flex-row items-center gap-1 pl-1 pr-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          className="h-11 w-11 items-center justify-center"
        >
          {/* DEVIATION: the design draws this chevron in `body`; prompt 11
              step 12 says the back affordance stays muted. Following the
              prompt's text over the image. */}
          <Ionicons name="chevron-back" size={24} color={colors.muted} />
        </Pressable>

        <View className="field field--search flex-1">
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            ref={inputRef}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => addRecentSearch(input)}
            placeholder="Search titles or authors"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
            accessibilityLabel="Search titles and authors"
            maxFontSizeMultiplier={1.3}
            underlineColorAndroid="transparent"
            style={{
              flex: 1,
              color: colors.body,
              fontFamily: fonts.ui,
              fontSize: 17,
              paddingVertical: 0,
            }}
          />
          {input.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search text"
              onPress={clearInput}
              className="-mr-2 h-11 w-11 items-center justify-center"
            >
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {hasInput ? (
        <ScrollView
          horizontal
          className="no-scrollbar mt-4 grow-0"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
        >
          {SEARCH_FILTERS.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              variant="filled"
              selected={filter === value}
              onPress={() => setFilter(value)}
              // 32dp chip → 44dp touch target.
              hitSlop={{ top: 6, bottom: 6 }}
            />
          ))}
        </ScrollView>
      ) : null}

      {!hasInput ? (
        <SearchIdle
          recentSearches={recentSearches}
          onSelect={searchRecent}
          onRemove={removeRecentSearch}
        />
      ) : search.data ? (
        rows.length === 0 ? (
          <SearchNoResults
            term={searchedTerm}
            scope={FILTER_SCOPE[filter]}
            onClear={clearInput}
          />
        ) : (
          <>
            <Text
              accessibilityLiveRegion="polite"
              className="font-ui text-muted px-4 pb-2 pt-3.5 text-sm"
              maxFontSizeMultiplier={1.3}
            >
              {`${rows.length}${hasMore ? "+" : ""} ${rows.length === 1 && !hasMore ? "result" : "results"}`}
            </Text>
            <FlatList
              data={rows}
              keyExtractor={(item, index) => item.id ?? `result-${index}`}
              renderItem={({ item }) => (
                <SearchResultRow
                  book={item}
                  coverUrl={
                    publicCdnDomain === null
                      ? null
                      : resolveCoverUrl(publicCdnDomain, item.cover_path)
                  }
                  onPress={openBook}
                />
              )}
              ItemSeparatorComponent={SearchRowSeparator}
              getItemLayout={(_, index) => ({
                length: ITEM_LENGTH,
                offset: ITEM_LENGTH * index,
                index,
              })}
              initialNumToRender={8}
              keyboardDismissMode="on-drag"
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              className="no-scrollbar"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          </>
        )
      ) : search.isError && !search.isFetching ? (
        // While Retry refetches, `status` stays "error" — fall through to
        // the skeleton so the retry is visibly in progress.
        <SearchError onRetry={() => void search.refetch()} />
      ) : (
        <SearchSkeleton />
      )}
    </Screen>
  );
}
