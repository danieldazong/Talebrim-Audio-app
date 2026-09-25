import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useLoadedChapter, useLoadedSecondsLeft } from "@/hooks/use-audio";
import { resolveCoverUrl } from "@/lib/covers";
import {
  chapterProgress,
  continuePosition,
  followsLoadedChapter,
  libraryPositions,
  progressLine,
  resumeLabel,
  resumeTarget,
  secondsLeft,
  type ChapterProgress,
  type LibraryPosition,
  type LibrarySegment,
  type LoadedPlace,
  type ResumeTarget,
} from "@/lib/library";
import { flush } from "@/lib/parity/writer";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { recentPositionsOptions } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryKeys } from "@/lib/query-keys";
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

/** Hidden collapses the section, heading included. Parity never blocks the screen around it. */
export type ContinueView = { status: "hidden" } | { status: "loading" } | { status: "ready"; card: ContinueCard };

/**
 * The Continue card: where the reader left off, across every book, resumed in
 * the mode they left it. M7 shows it per segment ("books" is the newest row,
 * "audiobooks" the newest listened to); M3's Discover tab shows the "books"
 * one, so a returning reader resumes without going to Library.
 *
 * It reads the newest 100 positions (`recentPositionsOptions()`), and adds
 * the card's book, the settings and the unlocks, which M4 has usually cached.
 * A listening row follows the chapter loaded in the player within the same
 * book (`followsLoadedChapter()`), so autoplay moves it on in place.
 *
 * On focus, whatever position the parity writer still holds is sent first,
 * then the positions refetch if stale. M5 and M6 flush as they unmount, which
 * comes after this screen regains focus; without the flush here, the card
 * could show the place before the one just left.
 */
export function useContinue(segment: LibrarySegment): {
  view: ContinueView;
  /** The newest positions, for M7's grid lines. */
  positions: LibraryPosition[];
  /** The chapter loaded in the player, for M7's grid lines. */
  loaded: LoadedPlace | null;
  publicCdnDomain: string | null;
} {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  // Signed-in routes only, so `userId` is set. RLS returns only this reader's rows.
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
        // Never restarts a fetch already running, the first one included.
        queryClient.refetchQueries(
          { queryKey: queryKeys.readingPosition.recent(userId), stale: true, type: "active" },
          { cancelRefetch: false },
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

  let view: ContinueView;
  if (recent.data === undefined) {
    // Failed, or offline with nothing cached: the section collapses.
    view = recent.isFetching && recent.fetchStatus !== "paused" ? { status: "loading" } : { status: "hidden" };
  } else if (resumeAt === null || cardBook.data === null) {
    view = { status: "hidden" };
  } else if (cardBook.data === undefined) {
    view = cardBook.isFetching && cardBook.fetchStatus !== "paused" ? { status: "loading" } : { status: "hidden" };
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
    view = {
      status: "ready",
      card: {
        bookId: resumeAt.bookId,
        title,
        coverUrl: domain === null ? null : resolveCoverUrl(domain, book.cover_path),
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

  return { view, positions, loaded, publicCdnDomain: domain };
}

/**
 * Where the Continue card's resume button goes, from M7 or M3. Pushed, so
 * back returns to the screen it came from.
 */
export function openResumeTarget(target: ResumeTarget): void {
  // TODO(paywall): a Locked chapter opens M5a here. It must never open the
  // reader or the player: that would be a paywall bypass.
  if (target.kind === "player") {
    // A play button, as M5's Listen is: M6 starts the chapter once it is ready.
    router.push({ pathname: "/player/[chapterId]", params: { chapterId: target.chapterId, play: "1" } });
  } else if (target.kind === "reader") {
    router.push({ pathname: "/reader/[chapterId]", params: { chapterId: target.chapterId } });
  }
}

/**
 * The Continue card's progress line: the chapter, and for listening the time
 * left in it. While the card's chapter is loaded in the player, the time is
 * the player's own and counts down as it plays; otherwise it is the saved
 * place. Kept apart from `useContinue()`, so only the card re-renders with it.
 */
export function useProgressLine(card: ContinueCard): { shown: string; spoken: string } {
  const liveLeft = useLoadedSecondsLeft(card.listening?.chapterId ?? null);
  const left =
    card.listening === null
      ? null
      : (liveLeft ?? secondsLeft(card.listening.positionMs, card.listening.durationSeconds));
  return progressLine(card.progress, left);
}
