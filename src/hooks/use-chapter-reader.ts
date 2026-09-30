import { useAuth } from "@clerk/expo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { useDownloadEntry, useIsOnline, useVerifyOnOpen } from "@/hooks/use-downloads";
import { useEntitlement } from "@/hooks/use-entitlement";
import { useRowCheck } from "@/hooks/use-row-check";
import { parseChapterText, unsupportedMarks, type ReaderBlock } from "@/lib/chapter-text";
import { withinOfflineWindow } from "@/lib/downloads/rules";
import { textRestoreOffset, type RestorePoint } from "@/lib/parity/convert";
import { fromServerRow, reconcile } from "@/lib/parity/reconcile";
import { adoptServerPosition } from "@/lib/parity/writer";
import { bookDetailOptions } from "@/lib/queries/book";
import {
  chapterDetailOptions,
  chapterNeighboursOptions,
  chapterTextOptions,
  lastChapterNumberOptions,
} from "@/lib/queries/chapters";
import { downloadedTextOptions } from "@/lib/queries/downloads";
import { readingPositionByChapterOptions } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";
import type { DownloadEntry } from "@/store/downloads-store";
import { useParityStore } from "@/store/parity-store";
import type { ChapterDetailRow, ChapterTargetRow } from "@/types/catalog";
import { lockStateFor, type LockableChapter, type ReaderStatus } from "@/types/states";

/** The ready state's chapter. */
export type ReadyChapter = {
  id: string;
  /** Every reading position is written with its book (`reading_positions.book_id`). */
  bookId: string;
  number: number;
  title: string | null;
  /** Parsed once per text value. */
  blocks: ReaderBlock[];
  /** The book's highest chapter number: the "of M" in the position label. */
  lastChapterNumber: number;
  /** Null at either end of the book, and while the neighbours load or after they fail. */
  previousId: string | null;
  nextId: string | null;
  /**
   * The next chapter is locked for this reader: "Next chapter" opens M5a for
   * it instead of the reader (prompt 22 step 12). False while its lock can't
   * be told yet: the reader then opens it in whatever state it resolves to.
   */
  nextLocked: boolean;
  /**
   * Where the chapter opens, as a character offset, and whether it was mapped
   * from listening (prompt 19 step 8); null opens at the top.
   */
  restore: RestorePoint | null;
  /** Opened from its download with no network (prompt 24 step 9). */
  openedOffline: boolean;
};

export type ChapterReaderView =
  | { status: "ready"; chapter: ReadyChapter }
  | { status: Exclude<ReaderStatus, "ready"> };

/**
 * How this open reads the chapter. `copy` is the download it opens from with
 * no network, once the phone is seen offline, and then for the rest of the
 * open; null reads it as always, through the queries.
 */
type Opening = { copy: DownloadEntry | null };

/** The open chapter, once its id, book id and number are known to be set. */
type OpenChapter = LockableChapter & {
  bookId: string;
  title: string | null;
  hasText: boolean | null;
  hasAudio: boolean | null;
  /** The narration's measured length, which parity maps positions against. */
  durationSeconds: number | null;
};

type Resolved = { view: ChapterReaderView; waitingOn: NeededQuery[] };

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
    hasAudio: row.has_audio,
    durationSeconds: row.audio_duration_seconds,
  };
}

/**
 * The open chapter from its download's index entry, for a cold start with no
 * network and nothing cached. `access` is never read: the download's last
 * online check stands in for the lock check.
 */
function fromDownload(entry: DownloadEntry): OpenChapter {
  return {
    id: entry.chapterId,
    bookId: entry.book.id,
    number: entry.number,
    title: entry.title,
    access: null,
    hasText: entry.text !== null,
    // Listen goes to M6, which offline has only what was downloaded.
    hasAudio: entry.audio !== null,
    durationSeconds: entry.durationSeconds,
  };
}

function toNeighbour(row: ChapterTargetRow | null | undefined): LockableChapter | null {
  if (!row || row.id === null || row.number === null) return null;
  return { id: row.id, number: row.number, access: row.access };
}

function settled(status: "unavailable" | "locked" | "no-text" | "expired"): Resolved {
  return { view: { status }, waitingOn: [] };
}

/**
 * Everything M5 reads for one chapter, and the state it resolves to.
 *
 * The chapter row and unlocks start together; the book, the
 * neighbours and the last chapter number follow the row, and the text
 * follows the lock check. Each check waits only for what it needs, so only a
 * query the screen is waiting on can fail it. The neighbours and the last
 * chapter number never hold up the ready state.
 *
 * A downloaded chapter reads its text from its file, with no network wait.
 * Offline, it opens from its index entry alone (prompt 24 step 9), or says
 * to connect once past its 30 days.
 */
export function useChapterReader(chapterId: string) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  // Downloads (prompt 24 step 9). Undefined until the index has rehydrated,
  // which the whole screen waits for, so a cold start offline never shows a
  // downloaded chapter as missing. Offline, a download opens from its index
  // entry and its file: its last online check, within its 30 days, stands in
  // for the lock check. Taken the moment the phone is seen offline (NetInfo
  // can report a moment after launch), then held, so a connection coming
  // back never sends an open chapter back to loading.
  const download = useDownloadEntry(chapterId);
  const online = useIsOnline();
  const [openedAt] = useState(() => Date.now());
  const [opening, setOpening] = useState<Opening>({ copy: null });
  if (opening.copy === null && download && !online) setOpening({ copy: download });
  const copy = opening.copy;
  const copyExpired = copy !== null && !withinOfflineWindow(copy.verifiedAt, openedAt);
  // Online, a download is checked again as it opens, never waited on.
  useVerifyOnOpen(chapterId, download);

  const chapter = useQuery(chapterDetailOptions(chapterId));
  // A cached row can be from before the owner locked the chapter: it decides
  // nothing until it is current (fetched again when stale) or the phone is
  // offline (2026-09-30).
  const chapterCheck = useRowCheck(chapter);
  const rowUsable = chapterCheck === "current" || chapterCheck === "cached";
  const open = copy ? fromDownload(copy) : chapter.data === undefined ? undefined : toOpenChapter(chapter.data);
  const bookId = open?.bookId ?? null;

  // Usually cached already by M4.
  const book = useQuery({ ...bookDetailOptions(bookId ?? ""), enabled: bookId !== null });
  // Signed-in route, so `userId` is set. Runs alongside the rest, but only a
  // chapter that isn't free by its own access waits for it.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  // The subscription, waited for on the same terms as the unlocks.
  const entitlement = useEntitlement();
  const isSubscribed = entitlement.data?.active;
  const lastNumber = useQuery({ ...lastChapterNumberOptions(bookId ?? ""), enabled: bookId !== null });
  const neighbours = useQuery({
    ...chapterNeighboursOptions(bookId ?? "", open?.number ?? 0),
    enabled: open != null,
  });
  const neighboursCheck = useRowCheck(neighbours);

  const unlockedChapterIds = useMemo(
    () => (unlocks.data ? new Set(unlocks.data.map((unlock) => unlock.chapter_id)) : undefined),
    [unlocks.data],
  );
  const lockState = open && rowUsable ? lockStateFor(open, unlockedChapterIds, isSubscribed) : null;

  // The text is fetched only for a published chapter (its catalog row came
  // back) that does not resolve to locked. This keeps the app honest; it is
  // NOT security. RLS still lets any signed-in reader select `script_text`
  // for a locked chapter directly. Closing that is a pre-launch task
  // (AGENTS.md § Before production). A subscription opens the chapter the
  // moment its entitlement lands, and this query starts by itself.
  //
  // A downloaded chapter's text comes from its file instead, online or off,
  // with no network wait: offline from the start, online once the lock check
  // above says open. Online, a file that can't be read falls back to the
  // network; offline, it fails.
  const unlockedNow = lockState !== null && lockState.kind !== "locked";
  const fileTextReady = (copy ?? download)?.text != null && (copy !== null ? !copyExpired : unlockedNow);
  const fileText = useQuery({
    ...downloadedTextOptions(userId ?? "", chapterId),
    enabled: fileTextReady && Boolean(userId),
  });
  const fromFile = fileTextReady && (copy !== null || !fileText.isError);
  const textEnabled = !fromFile && copy === null && open != null && unlockedNow && open.hasText !== false;
  const networkText = useQuery({ ...chapterTextOptions(chapterId), enabled: textEnabled });
  const text = fromFile ? fileText : networkText;

  // The first text this screen receives stays for as long as it is mounted.
  // A dashboard edit refetches the query, but the new text waits for the
  // next open rather than moving under the reader. Only an enabled query
  // counts: a disabled one still hands back whatever the cache holds.
  const [shownText, setShownText] = useState<{ value: string | null } | null>(null);
  if (shownText === null && (fromFile || textEnabled) && text.data !== undefined) {
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

  // The reader's place (AGENTS.md § Read/listen parity). A position already in
  // this session opens at once. Without one (a new app session, or a place
  // left on another device) the server row is one more input to the ready
  // state, fetched fresh on this open rather than trusted from a cache another
  // device may have overtaken. It never fails or blocks the chapter: after an
  // error, or offline, it opens from the cached row if there is one, else the
  // top.
  const [sessionAtOpen] = useState(() => useParityStore.getState().getPosition(chapterId));
  const serverPosition = useQuery({
    ...readingPositionByChapterOptions(userId ?? "", chapterId),
    enabled: Boolean(userId),
    refetchOnMount: sessionAtOpen === undefined ? "always" : true,
    // One try: a missing position must not hold the chapter through retries.
    retry: false,
  });
  const positionAnswered =
    !userId ||
    (!serverPosition.isFetching &&
      (serverPosition.status !== "pending" || serverPosition.fetchStatus === "paused"));
  // Latched, so a later refetch (the app returning to the foreground) never
  // sends an open chapter back to the skeleton.
  const [positionSettled, setPositionSettled] = useState(sessionAtOpen !== undefined);
  if (!positionSettled && positionAnswered) setPositionSettled(true);

  // Last write wins by the server's clock: a newer row from another device
  // replaces the session copy. The open text stays where it is (the same rule
  // as a text edit) and the new place applies on the next open.
  useEffect(() => {
    if (serverPosition.data !== undefined) adoptServerPosition(chapterId, serverPosition.data);
  }, [chapterId, serverPosition.data]);

  const next = toNeighbour(neighbours.data?.next);
  const nextLockState = next ? lockStateFor(next, unlockedChapterIds, isSubscribed) : null;
  // One chapter ahead, and never a locked one or one whose lock state is
  // still unknown: prefetching a locked chapter is fetching locked text. The
  // neighbours' row must be current too, as the chapter's own is.
  const prefetchId =
    next && neighboursCheck === "current" && nextLockState && nextLockState.kind !== "locked" ? next.id : null;

  function resolve(): Resolved {
    // The downloads index is still rehydrating.
    if (download === undefined) return { view: { status: "loading" }, waitingOn: [] };
    if (open === undefined) return waitFor([chapter]);
    if (copy === null) {
      // Missing, unpublished, hidden by RLS, or unpublished while open.
      if (open === null || book.data === null) return settled("unavailable");
      if (book.data === undefined) return waitFor([book]);
      // The cached row is being fetched again, or that failed: it decides nothing yet.
      if (chapterCheck === "checking") return { view: { status: "loading" }, waitingOn: [] };
      if (chapterCheck === "failed") return { view: { status: "failed" }, waitingOn: [chapter] };
      if (lockState === null) return waitFor([unlocks, entitlement]);
      if (lockState.kind === "locked") return settled("locked");
    } else if (copyExpired) {
      // Offline past its 30 days: the next online check restores or deletes it.
      return settled("expired");
    }
    if (open === null) return settled("unavailable");
    if (shownText === null) return open.hasText === false ? settled("no-text") : waitFor([text]);
    // Null, empty or whitespace-only text parses to no blocks.
    if (blocks.length === 0) return settled("no-text");
    // The text is ready; the place to open it at is not yet. Never an error.
    if (!positionSettled) return { view: { status: "loading" }, waitingOn: [] };

    const restoreFrom =
      reconcile(sessionAtOpen, serverPosition.data) === "adopt" && serverPosition.data
        ? fromServerRow(serverPosition.data)
        : sessionAtOpen;

    return {
      view: {
        status: "ready",
        chapter: {
          id: open.id,
          bookId: open.bookId,
          number: open.number,
          title: open.title,
          blocks,
          // Never below this chapter's number, so the label can't read
          // "5 of 3" while the last number loads, after it fails, or from a
          // stale cache.
          lastChapterNumber: Math.max(lastNumber.data ?? book.data?.chapter_count ?? 0, open.number),
          previousId: toNeighbour(neighbours.data?.previous)?.id ?? null,
          nextId: next?.id ?? null,
          nextLocked: nextLockState?.kind === "locked",
          restore: restoreFrom
            ? textRestoreOffset(restoreFrom, {
                textLength: shownText.value?.length ?? 0,
                blocks,
                durationSeconds: open.durationSeconds,
              })
            : null,
          openedOffline: copy !== null,
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
    bookTitle: copy?.book.title ?? book.data?.title ?? null,
    chapterNumber: open?.number ?? null,
    /** The chapter has narration to hand off to. A null `has_audio` has none. */
    hasAudio: open?.hasAudio === true,
    retry,
    prefetchNext,
  };
}
