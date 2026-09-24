import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient, type FetchStatus } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { parseChapterText, unsupportedMarks, type ReaderBlock } from "@/lib/chapter-text";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import {
  chapterDetailOptions,
  chapterNeighboursOptions,
  chapterTextOptions,
  lastChapterNumberOptions,
} from "@/lib/queries/chapters";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import type { ChapterDetailRow, ChapterTargetRow } from "@/types/catalog";
import {
  chapterStateFor,
  type ChapterState,
  type LockableChapter,
  type ReaderStatus,
} from "@/types/states";

/** The ready state's chapter. */
export type ReadyChapter = {
  id: string;
  number: number;
  title: string | null;
  /** Parsed once per text value. */
  blocks: ReaderBlock[];
  /** The book's highest chapter number: the "of M" in the position label. */
  lastChapterNumber: number;
  /** Null at either end of the book, and while the neighbours load or after they fail. */
  previousId: string | null;
  nextId: string | null;
};

export type ChapterReaderView =
  | { status: "ready"; chapter: ReadyChapter }
  | { status: Exclude<ReaderStatus, "ready"> };

/** The open chapter, once its id, book id and number are known to be set. */
type OpenChapter = LockableChapter & {
  bookId: string;
  title: string | null;
  hasText: boolean | null;
};

/** What the hook reads from a query it is waiting on. */
type NeededQuery = {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: FetchStatus;
  refetch: () => Promise<unknown>;
};

type Resolved = { view: ChapterReaderView; waitingOn: NeededQuery[] };

const NO_UNLOCKS: ReadonlySet<string> = new Set();

/** Chapters already reported by the development log, once per id per session. */
const reportedChapterIds = new Set<string>();

function toOpenChapter(row: ChapterDetailRow | null): OpenChapter | null {
  if (row === null || row.id === null || row.book_id === null || row.number === null) return null;
  return {
    id: row.id,
    bookId: row.book_id,
    number: row.number,
    title: row.title,
    access: row.access,
    hasText: row.has_text,
  };
}

function toNeighbour(row: ChapterTargetRow | null | undefined): LockableChapter | null {
  if (!row || row.id === null || row.number === null) return null;
  return { id: row.id, number: row.number, access: row.access };
}

/**
 * A chapter's lock state, or null while that can't be told yet. Unlocks only
 * ever open a locked chapter, so one that is free by access or by position
 * never waits for them.
 */
function lockStateFor(
  chapter: LockableChapter,
  freeChaptersAtStart: number,
  unlockedChapterIds: ReadonlySet<string> | undefined,
): ChapterState | null {
  const withoutUnlocks = chapterStateFor(chapter, { freeChaptersAtStart, unlockedChapterIds: NO_UNLOCKS });
  if (withoutUnlocks.kind !== "locked") return withoutUnlocks;
  if (unlockedChapterIds === undefined) return null;
  return chapterStateFor(chapter, { freeChaptersAtStart, unlockedChapterIds });
}

/** Waiting on whichever of `queries` has no data yet: offline beats failed beats loading. */
function waitFor(queries: NeededQuery[]): Resolved {
  const waitingOn = queries.filter((query) => query.data === undefined);
  let status: "offline" | "failed" | "loading" = "loading";
  if (waitingOn.some((query) => query.fetchStatus === "paused")) status = "offline";
  // Failed and not retrying — while a retry runs, it counts as loading again.
  else if (waitingOn.some((query) => query.isError && !query.isFetching)) status = "failed";
  return { view: { status }, waitingOn };
}

function settled(status: "unavailable" | "locked" | "no-text"): Resolved {
  return { view: { status }, waitingOn: [] };
}

/**
 * Everything M5 reads for one chapter, and the state it resolves to.
 *
 * The chapter row, settings and unlocks start together; the book, the
 * neighbours and the last chapter number follow the row, and the text
 * follows the lock check. Each check waits only for what it needs, so only a
 * query the screen is waiting on can fail it. The neighbours and the last
 * chapter number never hold up the ready state.
 */
export function useChapterReader(chapterId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const chapter = useQuery(chapterDetailOptions(chapterId));
  const open = chapter.data === undefined ? undefined : toOpenChapter(chapter.data);
  const bookId = open?.bookId ?? null;

  // Usually cached already by M4.
  const book = useQuery({ ...bookDetailOptions(bookId ?? ""), enabled: bookId !== null });
  const settings = useQuery(appSettingsOptions());
  // Signed-in route, so `userId` is set. Runs alongside the rest, but only a
  // chapter that is free neither by access nor by position waits for it.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const lastNumber = useQuery({ ...lastChapterNumberOptions(bookId ?? ""), enabled: bookId !== null });
  const neighbours = useQuery({
    ...chapterNeighboursOptions(bookId ?? "", open?.number ?? 0),
    enabled: open != null,
  });

  const freeChaptersAtStart = settings.data?.free_chapters_at_start;
  const unlockedChapterIds = useMemo(
    () => (unlocks.data ? new Set(unlocks.data.map((unlock) => unlock.chapter_id)) : undefined),
    [unlocks.data],
  );
  const lockState =
    open && freeChaptersAtStart !== undefined
      ? lockStateFor(open, freeChaptersAtStart, unlockedChapterIds)
      : null;

  // The text is fetched only for a published chapter (its catalog row came
  // back) that does not resolve to locked. This keeps the app honest; it is
  // NOT security. RLS still lets any signed-in reader select `script_text`
  // for a locked chapter directly. Closing that is a pre-launch task
  // (AGENTS.md § Before production).
  // TODO(paywall): the subscription entitlement is not checked yet.
  const textEnabled =
    open != null && lockState !== null && lockState.kind !== "locked" && open.hasText !== false;
  const text = useQuery({ ...chapterTextOptions(chapterId), enabled: textEnabled });

  // The first text this screen receives stays for as long as it is mounted.
  // A dashboard edit refetches the query, but the new text waits for the
  // next open rather than moving under the reader. Only an enabled query
  // counts: a disabled one still hands back whatever the cache holds.
  const [shownText, setShownText] = useState<{ value: string | null } | null>(null);
  if (shownText === null && textEnabled && text.data !== undefined) {
    setShownText({ value: text.data });
  }
  const blocks = useMemo(
    () => (shownText?.value ? parseChapterText(shownText.value) : []),
    [shownText],
  );

  // Development only: reports marks outside the three the dashboard stores.
  // The parser still renders them literally; nothing is stripped.
  useEffect(() => {
    if (!__DEV__ || !shownText?.value || reportedChapterIds.has(chapterId)) return;
    const marks = unsupportedMarks(shownText.value);
    if (marks.length === 0) return;
    reportedChapterIds.add(chapterId);
    console.warn(`[chapter-text] chapter ${chapterId} contains ${marks.join("; ")}`);
  }, [chapterId, shownText]);

  const next = toNeighbour(neighbours.data?.next);
  const nextLockState =
    next && freeChaptersAtStart !== undefined
      ? lockStateFor(next, freeChaptersAtStart, unlockedChapterIds)
      : null;
  // One chapter ahead, and never a locked one or one whose lock state is
  // still unknown: prefetching a locked chapter is fetching locked text.
  const prefetchId = next && nextLockState && nextLockState.kind !== "locked" ? next.id : null;

  function resolve(): Resolved {
    if (open === undefined) return waitFor([chapter]);
    // Missing, unpublished, hidden by RLS, or unpublished while open.
    if (open === null || book.data === null) return settled("unavailable");
    if (book.data === undefined || freeChaptersAtStart === undefined) return waitFor([book, settings]);
    if (lockState === null) return waitFor([unlocks]);
    if (lockState.kind === "locked") return settled("locked");
    if (shownText === null) return open.hasText === false ? settled("no-text") : waitFor([text]);
    // Null, empty or whitespace-only text parses to no blocks.
    if (blocks.length === 0) return settled("no-text");

    return {
      view: {
        status: "ready",
        chapter: {
          id: open.id,
          number: open.number,
          title: open.title,
          blocks,
          // Never below this chapter's number, so the label can't read
          // "5 of 3" while the last number loads, after it fails, or from a
          // stale cache.
          lastChapterNumber: Math.max(lastNumber.data ?? book.data.chapter_count ?? 0, open.number),
          previousId: toNeighbour(neighbours.data?.previous)?.id ?? null,
          nextId: next?.id ?? null,
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

  function prefetchNext() {
    if (prefetchId !== null) void queryClient.prefetchQuery(chapterTextOptions(prefetchId));
  }

  return {
    view,
    /** The top bar's lines, shown whenever they are known, in any state. */
    bookTitle: book.data?.title ?? null,
    chapterNumber: open?.number ?? null,
    retry,
    prefetchNext,
  };
}
