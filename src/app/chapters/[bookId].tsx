import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, Text, useWindowDimensions, View } from "react-native";

import { BookNotFound } from "@/components/book/book-states";
import {
  ChapterListHeader,
  ChapterSortBar,
  ChapterSortBarSkeleton,
} from "@/components/chapters/chapter-list-header";
import { ChapterListMessage, ChapterRowsSkeleton } from "@/components/chapters/chapter-list-states";
import { ChapterRow, chapterListRowHeight } from "@/components/chapters/chapter-row";
import { Button, Screen } from "@/components/ui";
import { useChapterList } from "@/hooks/use-chapter-list";
import {
  openingRowIndex,
  sortChapterRows,
  type ChapterListRow,
  type ChapterSortOrder,
} from "@/lib/chapter-list";
import { isUuid } from "@/lib/ids";
import { openPaywall } from "@/lib/paywall";

// M9 Full Chapter List — AGENTS.md M9, prompt 20, material/5.png.
//
// A pushed stack route outside (tabs), receiving only the book id. No tab
// bar and no mini player, by construction: both live in the tab shell, which
// this route is pushed over (as M4).
//
// Below the list, for a reader who isn't subscribed and has a chapter locked
// here, the bar with "Unlock all chapters" and the ember "Go Ad-Free"
// (prompt 22 step 11). The list's measured height is what the bar leaves.

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function ChapterListRoute() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();

  // A stale or hand-typed deep link. PostgREST errors on a malformed uuid
  // rather than returning no rows, so don't ask — it is simply not found.
  if (!isUuid(bookId)) {
    return (
      <Screen>
        <ChapterListHeader onBack={goBack} book={null} counts={null} />
        <BookNotFound onBack={goBack} />
      </Screen>
    );
  }

  return <ChapterList bookId={bookId} />;
}

// Taps push, never replace, so back from M5, M6 or M5a returns here. A
// Locked row opens M5a, never the reader or the player.
function openRow(row: ChapterListRow) {
  switch (row.opens?.kind) {
    case "paywall":
      openPaywall(row.id, row.opens.mode, "chapter_list");
      return;
    case "reader":
      router.push({ pathname: "/reader/[chapterId]", params: { chapterId: row.id } });
      return;
    case "player":
      router.push({ pathname: "/player/[chapterId]", params: { chapterId: row.id } });
      return;
  }
}

/** The headphone. No `play` flag: as with M4's Listen, M6 waits for its own Play. */
function listenToRow(row: ChapterListRow) {
  if (row.trailing !== "listen") return;
  router.push({ pathname: "/player/[chapterId]", params: { chapterId: row.id } });
}

function ChapterList({ bookId }: { bookId: string }) {
  const { view, book, retry } = useChapterList(bookId);
  // Screen state, never persisted. Oldest first: reading order, as the frame selects.
  const [order, setOrder] = useState<ChapterSortOrder>("oldest");
  const listRef = useRef<FlatList<ChapterListRow>>(null);
  // The list's own height, measured before it mounts: where it opens depends on how much fits.
  const [listHeight, setListHeight] = useState<number | null>(null);
  const { fontScale } = useWindowDimensions();
  const rowHeight = chapterListRowHeight(fontScale);

  function changeOrder(next: ChapterSortOrder) {
    setOrder(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  if (view.status === "loading") {
    return (
      <Screen>
        <ChapterListHeader onBack={goBack} book={book} counts={null} loading />
        <ChapterSortBarSkeleton />
        <ChapterRowsSkeleton rowHeight={rowHeight} />
      </Screen>
    );
  }

  if (view.status !== "ready") {
    return (
      <Screen>
        <ChapterListHeader onBack={goBack} book={book} counts={null} />
        {view.status === "unavailable" ? (
          <BookNotFound onBack={goBack} />
        ) : (
          <ChapterListMessage status={view.status} onRetry={retry} />
        )}
      </Screen>
    );
  }

  const rows = sortChapterRows(view.rows, order);
  const readingIndex = rows.findIndex((row) => row.state.kind === "reading");

  return (
    <Screen>
      <ChapterListHeader
        onBack={goBack}
        book={book}
        counts={{ chapters: view.rows.length, unlocked: view.unlockedCount }}
      />
      <ChapterSortBar order={order} onChange={changeOrder} />

      <View className="flex-1" onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}>
        {listHeight === null ? null : (
          <FlatList
            ref={listRef}
            data={rows}
            keyExtractor={(row) => row.id}
            renderItem={({ item, index }) => (
              <ChapterRow
                row={item}
                height={rowHeight}
                isLast={index === rows.length - 1}
                onOpen={openRow}
                onListen={listenToRow}
              />
            )}
            // Every row is one height (`chapterListRowHeight()`), so the list
            // never measures one to place another.
            getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
            // Read once, at mount: the Reading Now row at the top, or as near
            // as the list can scroll. A short list opens at the top, with no
            // blank gap above its rows.
            initialScrollIndex={openingRowIndex(readingIndex, rows.length, rowHeight, listHeight)}
            initialNumToRender={Math.ceil(listHeight / rowHeight)}
            windowSize={7}
          />
        )}
      </View>

      {view.showAdFreeBar ? <AdFreeBar /> : null}
    </Screen>
  );
}

/**
 * From material/5.png: a `raised` bar above the bottom safe area. "Unlock
 * all chapters" is a caption saying what the subscription does, not a
 * control: there is no per-book product. "Go Ad-Free" is M9's one ember
 * action, and opens M10 with no chapter, so back returns here.
 */
function AdFreeBar() {
  return (
    <View className="flex-row items-center gap-3 bg-raised px-4 py-2">
      <Text className="font-ui text-muted flex-1 text-base" numberOfLines={2} maxFontSizeMultiplier={1.3}>
        Unlock all chapters
      </Text>
      <Button label="Go Ad-Free" onPress={() => router.push("/subscription")} />
    </View>
  );
}
