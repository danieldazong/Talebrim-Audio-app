import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { FlatList, useWindowDimensions, View } from "react-native";

import { BookNotFound } from "@/components/book/book-states";
import {
  ChapterListHeader,
  ChapterSortBar,
  ChapterSortBarSkeleton,
} from "@/components/chapters/chapter-list-header";
import { ChapterListMessage, ChapterRowsSkeleton } from "@/components/chapters/chapter-list-states";
import { ChapterRow, chapterListRowHeight } from "@/components/chapters/chapter-row";
import { Screen } from "@/components/ui";
import { useChapterList } from "@/hooks/use-chapter-list";
import {
  openingRowIndex,
  sortChapterRows,
  type ChapterListRow,
  type ChapterSortOrder,
} from "@/lib/chapter-list";
import { isUuid } from "@/lib/ids";

// M9 Full Chapter List — AGENTS.md M9, prompt 20, material/5.png.
//
// A pushed stack route outside (tabs), receiving only the book id. No tab
// bar and no mini player, by construction: both live in the tab shell, which
// this route is pushed over (as M4).
//
// TODO(paywall): the bottom bar, "Unlock all chapters" and the ember
// "Go Ad-Free", goes below the list. Until then the list runs to the bottom
// safe-area inset.

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

// Taps push, never replace, so back from M5 or M6 returns here.
function openRow(row: ChapterListRow) {
  // TODO(paywall): a Locked row opens M5a here. It must never open the reader
  // or the player: that would be a paywall bypass.
  if (row.opens === null) return;
  const pathname = row.opens === "reader" ? "/reader/[chapterId]" : "/player/[chapterId]";
  router.push({ pathname, params: { chapterId: row.id } });
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
    </Screen>
  );
}
