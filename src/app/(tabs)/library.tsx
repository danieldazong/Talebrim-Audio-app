import { useBottomTabBarHeight } from "expo-router/tabs";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";

import { ContinueSection } from "@/components/library/continue-card";
import { GRID_TITLE_LINE_HEIGHT, LibraryGridItem } from "@/components/library/library-grid-item";
import {
  LibraryHeader,
  LibrarySegments,
  LibrarySegmentsSkeleton,
  MyListHeading,
} from "@/components/library/library-header";
import {
  AudiobooksEmpty,
  LibraryGridSkeleton,
  MyListEmpty,
  MyListMessage,
} from "@/components/library/library-states";
import { Screen } from "@/components/ui";
import { openResumeTarget } from "@/hooks/use-continue";
import { useLibrary } from "@/hooks/use-library";
import type { LibrarySegment } from "@/lib/library";
import { layout } from "@/theme";

// M7 My Library — AGENTS.md M7, prompt 21, material/9.png.
//
// A tab route: the tab shell draws the mini player and the tab bar below it.
// One vertical FlatList holds the screen. The header, the segments, Continue
// and the My List heading are its header; My List's books are its items; My
// List's states are its empty component. M7 writes nothing: books are added
// and removed from M4's My List button.

/** Measured from material/9.png: 12dp between grid columns. */
const GRID_GAP = 12;
const GRID_COLUMNS = 3;
/** The text's `maxFontSizeMultiplier`, which the reserved title height follows. */
const MAX_FONT_SCALE = 1.3;

function openBook(id: string) {
  router.push({ pathname: "/book/[id]", params: { id } });
}

export default function Library() {
  const tabBarHeight = useBottomTabBarHeight();
  const { width, fontScale } = useWindowDimensions();
  // Screen state, never persisted. Books is the default.
  const [segment, setSegment] = useState<LibrarySegment>("books");
  const { continueView, myList, retryMyList } = useLibrary(segment);

  const cellWidth = (width - 2 * layout.screenPadding - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
  const titleMinHeight = 2 * GRID_TITLE_LINE_HEIGHT * Math.min(Math.max(fontScale, 1), MAX_FONT_SCALE);

  const ready = myList.status === "ready" ? myList : null;
  const hasBooks = ready !== null && ready.counts.books > 0;

  let emptyState: React.ReactElement | null;
  if (myList.status === "loading") {
    emptyState = <LibraryGridSkeleton cellWidth={cellWidth} titleMinHeight={titleMinHeight} />;
  } else if (myList.status === "offline" || myList.status === "failed") {
    emptyState = <MyListMessage status={myList.status} onRetry={retryMyList} />;
  } else if (!hasBooks) {
    emptyState = <MyListEmpty onBrowse={() => router.navigate("/")} />;
  } else {
    emptyState = <AudiobooksEmpty />;
  }

  return (
    // `edges=["top"]` only: the tab bar carries its own bottom inset, as on M3.
    <Screen edges={["top"]}>
      <FlatList
        className="no-scrollbar"
        data={ready?.books ?? []}
        keyExtractor={(book) => book.bookId}
        numColumns={GRID_COLUMNS}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <LibraryGridItem book={item} width={cellWidth} titleMinHeight={titleMinHeight} onOpen={openBook} />
        )}
        ListHeaderComponent={
          <View>
            <LibraryHeader onSearch={() => router.push("/search")} />
            {myList.status === "loading" ? (
              <LibrarySegmentsSkeleton />
            ) : (
              <LibrarySegments value={segment} onChange={setSegment} counts={ready?.counts ?? null} />
            )}
            <ContinueSection
              view={continueView}
              heading={segment === "books" ? "Continue Reading" : "Continue Listening"}
              onOpenBook={openBook}
              onResume={openResumeTarget}
              className="mt-4"
            />
            {hasBooks ? <MyListHeading count={ready.books.length} /> : null}
          </View>
        }
        ListEmptyComponent={emptyState}
        // The last row clears the mini player and the tab bar, as on M3.
        contentContainerStyle={{ paddingBottom: tabBarHeight + 16 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: GRID_GAP,
    paddingHorizontal: layout.screenPadding,
    marginBottom: 16,
  },
});
