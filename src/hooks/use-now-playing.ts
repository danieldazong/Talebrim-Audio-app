import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { resolveCoverUrl } from "@/lib/covers";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions, chapterNeighboursOptions } from "@/lib/queries/chapters";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";
import type { ChapterDetailRow, ChapterTargetRow } from "@/types/catalog";
import { lockStateFor, type LockableChapter, type PlayerStatus } from "@/types/states";

/** The ready state's chapter. */
export type PlayingChapter = {
  id: string;
  number: number;
  title: string | null;
  /** Null when the narration was never measured: the scrubber's unknown-duration state. */
  durationSeconds: number | null;
  /** Null at either end of the book, and while the neighbours load or after they fail. */
  previousId: string | null;
  nextId: string | null;
  /** Resolved from the live CDN domain. Null renders `Cover`'s flat box. */
  coverUrl: string | null;
};

export type NowPlayingView =
  | { status: "ready"; chapter: PlayingChapter }
  | { status: Exclude<PlayerStatus, "ready"> };

/** The metadata lines. Each shows whenever it is known, in any state. */
export type NowPlayingMeta = {
  /** Null while the book loads, or when there is none. */
  book: { title: string; author: string | null } | null;
  /** Null until the chapter row is known. */
  chapter: { number: number; title: string | null } | null;
};

/** The open chapter, once its id, book id and number are known to be set. */
type OpenChapter = LockableChapter & {
  bookId: string;
  title: string | null;
  hasAudio: boolean | null;
  durationSeconds: number | null;
};

type Resolved = { view: NowPlayingView; waitingOn: NeededQuery[] };

function toOpenChapter(row: ChapterDetailRow | null): OpenChapter | null {
  if (row === null || row.id === null || row.book_id === null || row.number === null) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    number: row.number,
    title: row.title,
    access: row.access,
    hasAudio: row.has_audio,
    durationSeconds: row.audio_duration_seconds,
  };
}

function neighbourId(row: ChapterTargetRow | null | undefined): string | null {
  if (!row || row.id === null || row.number === null) return null;
  return row.id;
}

function settled(status: "unavailable" | "locked" | "no-audio"): Resolved {
  return { view: { status }, waitingOn: [] };
}

/**
 * Everything M6 reads for one chapter, and the state it resolves to — the
 * same shape and precedence as M5's `useChapterReader()`.
 *
 * The chapter row, settings and unlocks start together; the book and the
 * neighbours follow the row. Each check waits only for what it needs, so only
 * a query the screen is waiting on can fail it. The neighbours never hold up
 * the ready state.
 *
 * Metadata only: no storage, no `audio_path` and no signed URL. Prompt 18
 * owns all of that.
 */
export function useNowPlaying(chapterId: string) {
  const { userId } = useAuth();

  const chapter = useQuery(chapterDetailOptions(chapterId));
  const open = chapter.data === undefined ? undefined : toOpenChapter(chapter.data);
  const bookId = open?.bookId ?? null;

  // Usually cached already by M4 or M5.
  const book = useQuery({ ...bookDetailOptions(bookId ?? ""), enabled: bookId !== null });
  const settings = useQuery(appSettingsOptions());
  // Signed-in route, so `userId` is set. Only a chapter that is free neither
  // by access nor by position waits for it.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const neighbours = useQuery({
    ...chapterNeighboursOptions(bookId ?? "", open?.number ?? 0),
    enabled: open != null,
  });

  const freeChaptersAtStart = settings.data?.free_chapters_at_start;
  const unlockedChapterIds = useMemo(
    () => (unlocks.data ? new Set(unlocks.data.map((unlock) => unlock.chapter_id)) : undefined),
    [unlocks.data],
  );
  // The one lock rule, shared with M4 and M5.
  // TODO(paywall): the subscription entitlement is not checked yet.
  const lockState =
    open && freeChaptersAtStart !== undefined
      ? lockStateFor(open, freeChaptersAtStart, unlockedChapterIds)
      : null;

  function resolve(): Resolved {
    if (open === undefined) return waitFor([chapter]);
    // Missing, unpublished, hidden by RLS, or unpublished while open.
    if (open === null || book.data === null) return settled("unavailable");
    if (book.data === undefined || settings.data === undefined) return waitFor([book, settings]);
    if (lockState === null) return waitFor([unlocks]);
    if (lockState.kind === "locked") return settled("locked");
    // A null `has_audio` is the view's nullable typing: nothing to play either.
    if (open.hasAudio !== true) return settled("no-audio");

    return {
      view: {
        status: "ready",
        chapter: {
          id: open.id,
          number: open.number,
          title: open.title,
          // A zero is a failed measurement, not a length: unknown, never "0:00".
          durationSeconds:
            open.durationSeconds !== null && open.durationSeconds > 0 ? open.durationSeconds : null,
          previousId: neighbourId(neighbours.data?.previous),
          nextId: neighbourId(neighbours.data?.next),
          coverUrl: resolveCoverUrl(settings.data.public_cdn_domain, book.data.cover_path),
        },
      },
      waitingOn: [],
    };
  }

  const { view, waitingOn } = resolve();

  function retry() {
    for (const query of waitingOn) {
      if (query.isError) void query.refetch();
    }
  }

  const meta: NowPlayingMeta = {
    book: book.data ? { title: book.data.title ?? "Untitled", author: book.data.author } : null,
    chapter: open ? { number: open.number, title: open.title } : null,
  };

  return { view, meta, retry };
}
