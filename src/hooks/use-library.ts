import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useContinue, type ContinueView } from "@/hooks/use-continue";
import { resolveCoverUrl } from "@/lib/covers";
import {
  chapterProgress,
  followsLoadedChapter,
  gridItemLabel,
  isAudiobook,
  itemsInSegment,
  newestPositionByBook,
  segmentCounts,
  type ChapterProgress,
  type LibrarySegment,
} from "@/lib/library";
import { libraryItemsByUserOptions } from "@/lib/queries/library-items";
import { queryKeys } from "@/lib/query-keys";
import { waitFor } from "@/lib/query-status";

export type LibraryGridBook = {
  bookId: string;
  title: string;
  coverUrl: string | null;
  isAudiobook: boolean;
  /** Null draws no line: no position among the newest 100. */
  progress: ChapterProgress | null;
  accessibilityLabel: string;
};

export type MyListView =
  | { status: "loading" | "offline" | "failed" }
  | {
      status: "ready";
      /** This segment's books, newest saved first. */
      books: LibraryGridBook[];
      counts: Record<LibrarySegment, number>;
    };

/**
 * Everything M7 reads, and what it resolves to, for one segment.
 *
 * Two lists, one request each: My List with its books embedded, and the
 * newest 100 positions with their chapters (`useContinue()`, which also
 * builds the Continue card). Nothing is queried per grid book.
 *
 * A grid line follows the chapter loaded in the player within the same book
 * (`followsLoadedChapter()`), as the Continue card does, so the two never
 * disagree about one book. On focus, My List refetches if stale.
 */
export function useLibrary(segment: LibrarySegment): {
  continueView: ContinueView;
  myList: MyListView;
  retryMyList: () => void;
} {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  // Signed-in route, so `userId` is set. RLS returns only this reader's rows.
  const list = useQuery({ ...libraryItemsByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const { view: continueView, positions, loaded, publicCdnDomain } = useContinue(segment);

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      // Never restarts a fetch already running, the first one included.
      void queryClient.refetchQueries(
        { queryKey: queryKeys.libraryItems.byUser(userId), stale: true, type: "active" },
        { cancelRefetch: false },
      );
    }, [queryClient, userId]),
  );

  let myList: MyListView;
  if (list.data === undefined) {
    myList = waitFor([list]).view;
  } else {
    const newest = newestPositionByBook(positions);
    myList = {
      status: "ready",
      counts: segmentCounts(list.data),
      books: itemsInSegment(list.data, segment).map(({ book_id: bookId, book }) => {
        const row = newest.get(bookId);
        const number = row === undefined ? null : followsLoadedChapter(row, loaded) ? loaded.number : row.number;
        const progress = number === null ? null : chapterProgress(number, book.chapter_count);
        return {
          bookId,
          title: book.title ?? "Untitled",
          coverUrl: publicCdnDomain === null ? null : resolveCoverUrl(publicCdnDomain, book.cover_path),
          isAudiobook: isAudiobook(book),
          progress,
          accessibilityLabel: gridItemLabel(book, progress),
        };
      }),
    };
  }

  return {
    continueView,
    myList,
    retryMyList: () => void list.refetch(),
  };
}
