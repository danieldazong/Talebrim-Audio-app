import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useLoadedChapter, useLoadedSecondsLeft } from "@/hooks/use-audio";
import { resolveCoverUrl } from "@/lib/covers";
import {
  chapterProgress,
  continuePosition,
  followsLoadedChapter,
  gridItemLabel,
  isAudiobook,
  itemsInSegment,
  libraryPositions,
  newestPositionByBook,
  progressLine,
  resumeLabel,
  resumeTarget,
  secondsLeft,
  segmentCounts,
  type ChapterProgress,
  type LibrarySegment,
  type LoadedPlace,
  type ResumeTarget,
} from "@/lib/library";
import { flush } from "@/lib/parity/writer";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { libraryItemsByUserOptions } from "@/lib/queries/library-items";
import { recentPositionsOptions } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryKeys } from "@/lib/query-keys";
import { waitFor } from "@/lib/query-status";
import type { ParitySourceMode } from "@/store/parity-store";

export type ContinueCard = {
  bookId: string;
  title: string;
  coverUrl: string | null;
  /** Which mode wrote last: the eyebrow's "Reading" or "Listening". */
  mode: ParitySourceMode;
  progress: ChapterProgress;
  /**
   * Listening only, for the time left: the chapter, its saved place and its
   * length. The player's own count takes over while it is the loaded chapter.
   */
  listening: { chapterId: string; positionMs: number | null; durationSeconds: number | null } | null;
  target: ResumeTarget;
  /** The resume button's label, in words. */
  resumeLabel: string;
};

/** Hidden collapses the section, heading included. Parity never blocks My List. */
export type ContinueView = { status: "hidden" } | { status: "loading" } | { status: "ready"; card: ContinueCard };

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
 * newest 100 positions with their chapters. The Continue card adds its book,
 * the settings and the unlocks, which M4 has usually cached. Nothing is
 * queried per grid book.
 *
 * A listening card, and a grid line, follow the chapter loaded in the player
 * within the same book (`followsLoadedChapter()`), so autoplay moves them on
 * without leaving the screen.
 *
 * On focus, whatever position the parity writer still holds is sent first,
 * then the library keys refetch if stale. M5 and M6 flush as they unmount,
 * which comes after this screen regains focus; without the flush here, the
 * card could show the place before the one just left.
 */
export function useLibrary(segment: LibrarySegment) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  // Signed-in route, so `userId` is set. RLS returns only this reader's rows.
  const list = useQuery({ ...libraryItemsByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const recent = useQuery({ ...recentPositionsOptions(userId ?? ""), enabled: Boolean(userId) });
  const settings = useQuery(appSettingsOptions());
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  // Re-renders only when the loaded chapter changes, never with the position.
  const loadedChapter = useLoadedChapter();
  const loaded: LoadedPlace | null =
    loadedChapter === null
      ? null
      : {
          chapterId: loadedChapter.chapterId,
          bookId: loadedChapter.bookId,
          number: loadedChapter.number,
          durationSeconds: loadedChapter.durationSeconds,
        };

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void flush().then(() =>
        Promise.all(
          [queryKeys.libraryItems.byUser(userId), queryKeys.readingPosition.recent(userId)].map((queryKey) =>
            // Never restarts a fetch already running, the first one included.
            queryClient.refetchQueries({ queryKey, stale: true, type: "active" }, { cancelRefetch: false }),
          ),
        ),
      );
    }, [queryClient, userId]),
  );

  const positions = libraryPositions(recent.data ?? []);
  const resumeAt = continuePosition(positions, segment);
  const cardBook = useQuery({
    ...bookDetailOptions(resumeAt?.bookId ?? ""),
    enabled: resumeAt !== null,
  });

  const domain = settings.data?.public_cdn_domain ?? null;
  const coverUrl = (coverPath: string | null) => (domain === null ? null : resolveCoverUrl(domain, coverPath));

  let continueView: ContinueView;
  if (recent.data === undefined) {
    // Failed, or offline with nothing cached: the section collapses.
    continueView = recent.isFetching && recent.fetchStatus !== "paused" ? { status: "loading" } : { status: "hidden" };
  } else if (resumeAt === null || cardBook.data === null) {
    continueView = { status: "hidden" };
  } else if (cardBook.data === undefined) {
    continueView = cardBook.isFetching && cardBook.fetchStatus !== "paused" ? { status: "loading" } : { status: "hidden" };
  } else {
    const book = cardBook.data;
    const title = book.title ?? "Untitled";
    let place: {
      chapterId: string;
      number: number;
      target: ResumeTarget;
      positionMs: number | null;
      durationSeconds: number | null;
    };
    if (followsLoadedChapter(resumeAt, loaded)) {
      const sameChapter = loaded.chapterId === resumeAt.chapterId;
      place = {
        chapterId: loaded.chapterId,
        number: loaded.number,
        // It is in the player, which only loads what the reader may play.
        target: { kind: "player", chapterId: loaded.chapterId },
        positionMs: sameChapter ? resumeAt.audioMs : null,
        durationSeconds: sameChapter ? resumeAt.audioDurationSeconds : loaded.durationSeconds,
      };
    } else {
      place = {
        chapterId: resumeAt.chapterId,
        number: resumeAt.number,
        target: resumeTarget(resumeAt, {
          freeChaptersAtStart: settings.data?.free_chapters_at_start,
          unlockedChapterIds: unlocks.data ? new Set(unlocks.data.map((unlock) => unlock.chapter_id)) : undefined,
        }),
        positionMs: resumeAt.audioMs,
        durationSeconds: resumeAt.audioDurationSeconds,
      };
    }
    continueView = {
      status: "ready",
      card: {
        bookId: resumeAt.bookId,
        title,
        coverUrl: coverUrl(book.cover_path),
        mode: resumeAt.lastMode,
        progress: chapterProgress(place.number, book.chapter_count),
        listening:
          resumeAt.lastMode === "audio"
            ? { chapterId: place.chapterId, positionMs: place.positionMs, durationSeconds: place.durationSeconds }
            : null,
        target: place.target,
        resumeLabel: resumeLabel(place.target, title, place.number),
      },
    };
  }

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
          coverUrl: coverUrl(book.cover_path),
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

/**
 * The Continue card's progress line: the chapter, and for listening the time
 * left in it. While the card's chapter is loaded in the player, the time is
 * the player's own and counts down as it plays; otherwise it is the saved
 * place. Kept apart from `useLibrary()`, so only the card re-renders with it.
 */
export function useProgressLine(card: ContinueCard): { shown: string; spoken: string } {
  const liveLeft = useLoadedSecondsLeft(card.listening?.chapterId ?? null);
  const left =
    card.listening === null
      ? null
      : (liveLeft ?? secondsLeft(card.listening.positionMs, card.listening.durationSeconds));
  return progressLine(card.progress, left);
}
