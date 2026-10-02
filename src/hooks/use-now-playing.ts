import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLoadedPhase } from "@/hooks/use-audio";
import { useDownloadEntry, useIsOnline, useVerifyOnOpen } from "@/hooks/use-downloads";
import { useEntitlement } from "@/hooks/use-entitlement";
import { useRowCheck } from "@/hooks/use-row-check";
import { retryLoaded, type LoadedChapter } from "@/lib/audio/player";
import { audioRestoreMs, newerPosition } from "@/lib/audio/rules";
import { resolveCoverUrl } from "@/lib/covers";
import { withinOfflineWindow } from "@/lib/downloads/rules";
import type { RestorePoint } from "@/lib/parity/convert";
import { adoptServerPosition } from "@/lib/parity/writer";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { chapterAudioSourceOptions } from "@/lib/queries/audio";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions, chapterNeighboursOptions, chapterTextOptions } from "@/lib/queries/chapters";
import { readingPositionByChapterOptions } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";
import { syncServerPlan } from "@/lib/server-plan";
import type { DownloadEntry } from "@/store/downloads-store";
import { useParityStore } from "@/store/parity-store";
import type { ChapterDetailRow, ChapterTargetRow } from "@/types/catalog";
import { askServerAboutPlan, lockStateFor, type LockableChapter, type PlayerStatus } from "@/types/states";

/** The ready state's chapter: what the player loads, and what the screen shows around it. */
export type PlayingChapter = LoadedChapter & {
  /** Null at either end of the book, and while the neighbours load or after they fail. */
  previousId: string | null;
  nextId: string | null;
  /**
   * The next chapter is locked for this reader: next opens M5a for it
   * (prompt 22 step 12). False while its lock can't be told yet.
   */
  nextLocked: boolean;
  /**
   * Where Play starts, in milliseconds, and whether it was mapped from
   * reading. Always set while this isn't the loaded chapter. On the loaded
   * one, set only while reading has moved its place since the player last
   * recorded it (prompt 19 step 4); null is the player's own place.
   */
  restore: RestorePoint | null;
  /** This is the player's loaded chapter, so its position is recording through `lib/parity`. */
  isLoaded: boolean;
  /** This chapter has a saved position, in the session or on the server. */
  hasBookmark: boolean;
  /** False only when `has_text` is: Read instead has nowhere to go. */
  hasText: boolean;
  /** Opened from its download with no network (prompt 24 step 9). */
  openedOffline: boolean;
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
  hasText: boolean | null;
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
    hasText: row.has_text,
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
    // Offline, only what was downloaded plays and reads.
    hasAudio: entry.audio !== null,
    hasText: entry.text !== null,
    durationSeconds: entry.durationSeconds,
  };
}

function toNeighbour(row: ChapterTargetRow | null | undefined): LockableChapter | null {
  if (!row || row.id === null || row.number === null) return null;
  return { id: row.id, number: row.number, access: row.access };
}

function settled(
  status: "unavailable" | "locked" | "no-audio" | "failed" | "offline" | "loading" | "expired",
): Resolved {
  return { view: { status }, waitingOn: [] };
}

/**
 * Everything M6 reads for one chapter, and the state it resolves to — the
 * same shape and precedence as M5's `useChapterReader()`.
 *
 * The chapter row, the settings (for the cover) and the unlocks start
 * together; the book and the neighbours follow the row. Each check waits only for what it needs, so only
 * a query the screen is waiting on can fail it. The neighbours never hold up
 * the ready state.
 *
 * A chapter that isn't the player's loaded one also waits, after the lock
 * check, for its signed narration URL (`chapterAudioSourceOptions()`) and for
 * its saved position, which is where Play starts. When reading wrote that
 * position last, it waits for the chapter's text too, to map the place into
 * the narration (prompt 19 step 4). The loaded chapter waits for none of
 * them: opening M6 from the mini player never re-signs. Its failures are
 * the player's, not a query's.
 *
 * A downloaded chapter never waits for a signed URL: it plays from its file,
 * and its text's length is in the index. Offline, it opens from the index
 * entry alone (prompt 24 step 9), or says to connect once past its 30 days.
 */
export function useNowPlaying(chapterId: string) {
  const { userId } = useAuth();
  const loadedPhase = useLoadedPhase(chapterId);
  const isLoaded = loadedPhase !== null;

  // Downloads (prompt 24 step 9), as M5 has them: the index is waited for,
  // and offline a download opens from its entry, its last online check
  // within its 30 days standing in for the lock check. Taken the moment the
  // phone is seen offline, then held for the rest of the open.
  const download = useDownloadEntry(chapterId);
  const online = useIsOnline();
  const [openedAt] = useState(() => Date.now());
  const [opening, setOpening] = useState<{ copy: DownloadEntry | null }>({ copy: null });
  if (opening.copy === null && download && !online) setOpening({ copy: download });
  const copy = opening.copy;
  const copyExpired = copy !== null && !withinOfflineWindow(copy.verifiedAt, openedAt);
  // A downloaded chapter plays from its file: never a signed URL for it.
  const localCopy = copy ?? download ?? null;
  const hasFile = localCopy?.audio != null;
  // Online, a download is checked again as it opens, never waited on.
  useVerifyOnOpen(chapterId, download);

  const chapter = useQuery(chapterDetailOptions(chapterId));
  // A cached row can be from before the owner locked the chapter: it decides
  // nothing until it is current (fetched again when stale) or the phone is
  // offline (2026-09-30). The loaded chapter doesn't wait: the player checks
  // it again itself on every catalog change (`recheckLoaded()`), and the mini
  // player opens it at once.
  const chapterCheck = useRowCheck(chapter);
  const rowUsable = chapterCheck === "current" || chapterCheck === "cached" || isLoaded;
  const open = copy ? fromDownload(copy) : chapter.data === undefined ? undefined : toOpenChapter(chapter.data);
  const bookId = open?.bookId ?? null;

  // Usually cached already by M4 or M5.
  const book = useQuery({ ...bookDetailOptions(bookId ?? ""), enabled: bookId !== null });
  // For the cover only.
  const settings = useQuery(appSettingsOptions());
  // Signed-in route, so `userId` is set. Only a chapter that isn't free by
  // its own access waits for it.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  // The subscription, waited for on the same terms as the unlocks.
  const entitlement = useEntitlement();
  const isSubscribed = entitlement.data?.active;
  const neighbours = useQuery({
    ...chapterNeighboursOptions(bookId ?? "", open?.number ?? 0),
    enabled: open != null,
  });

  const unlockedChapterIds = useMemo(
    () => (unlocks.data ? new Set(unlocks.data.map((unlock) => unlock.chapter_id)) : undefined),
    [unlocks.data],
  );
  // The one lock rule, shared with M4 and M5, the subscription included.
  const lockState = open && rowUsable ? lockStateFor(open, unlockedChapterIds, isSubscribed) : null;
  const next = toNeighbour(neighbours.data?.next);
  const nextLockState = next ? lockStateFor(next, unlockedChapterIds, isSubscribed) : null;

  // The narration URL: only after the lock check, never for a locked
  // chapter, never for the loaded chapter, which already plays, and never
  // for a downloaded one, which plays from its file.
  const sourceEnabled =
    !isLoaded &&
    !hasFile &&
    Boolean(userId) &&
    open != null &&
    lockState !== null &&
    lockState.kind !== "locked" &&
    open.hasAudio === true;
  const source = useQuery({ ...chapterAudioSourceOptions(userId ?? "", chapterId), enabled: sourceEnabled });

  // A chapter only Talebrim Unlimited opens, refused by Storage, or its row
  // withheld (no `audio_path`): the server serves it from its own copy of
  // the plan, which can be behind the phone's (prompt 22a step 8). The
  // server is asked to check that copy, once per open, and the narration is
  // signed once more. However that goes, the checks below then decide as
  // before. No timer: nothing here waits on one.
  const denied = sourceEnabled && (source.data?.kind === "refused" || source.data?.kind === "unavailable");
  // Unlocks still loading count as none: the server never refuses a chapter
  // the reader unlocked on its own.
  const planInputs =
    isSubscribed === undefined ? null : { unlockedChapterIds: unlockedChapterIds ?? new Set<string>(), isSubscribed };
  const planAsked = useRef(false);
  const [planChecked, setPlanChecked] = useState(false);
  // True from the refusal until the server has checked: the screen loads meanwhile.
  const checkingPlan = denied && open != null && askServerAboutPlan(open, planInputs, planChecked);
  const refetchSource = source.refetch;
  useEffect(() => {
    if (!checkingPlan || planAsked.current) return;
    planAsked.current = true;
    void syncServerPlan()
      .then(() => refetchSource())
      .finally(() => setPlanChecked(true));
  }, [checkingPlan, refetchSource]);
  const refused = sourceEnabled && source.data?.kind === "refused" && !checkingPlan;

  // Storage refused to sign: the lock rule may have changed since it was
  // read (the chapter locked in the dashboard, say). The chapter row and the
  // unlocks are fetched again, once, and the lock check above decides
  // between Locked and Not available.
  const recheckStarted = useRef(false);
  const [rechecked, setRechecked] = useState(false);
  const refetchChapter = chapter.refetch;
  const refetchUnlocks = unlocks.refetch;
  useEffect(() => {
    if (!refused || recheckStarted.current) return;
    recheckStarted.current = true;
    void Promise.allSettled([refetchChapter(), refetchUnlocks()]).then(() => setRechecked(true));
  }, [refused, refetchChapter, refetchUnlocks]);

  // Where Play starts, as M5 restores (AGENTS.md § Read/listen parity): a
  // position already in this session at once; without one, the server row,
  // fetched fresh on this open. It never fails or blocks the chapter.
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
  // Latched, so a later refetch never sends an open chapter back to the skeleton.
  const [positionSettled, setPositionSettled] = useState(sessionAtOpen !== undefined);
  if (!positionSettled && positionAnswered) setPositionSettled(true);

  // A newer row from another device replaces the session copy. Not for the
  // loaded chapter: the player records it continuously, and its own writes
  // coming back would flush it again on every round trip.
  useEffect(() => {
    if (!isLoaded && serverPosition.data !== undefined) adoptServerPosition(chapterId, serverPosition.data);
  }, [chapterId, isLoaded, serverPosition.data]);

  const hasSessionPosition = useParityStore((state) => state.positions[chapterId] !== undefined);
  const hasBookmark = hasSessionPosition || (serverPosition.data ?? null) !== null;

  // The place Play starts from. For a chapter that isn't loaded, the newer of
  // the session copy at the open and the server row, as M5 restores. The
  // loaded chapter's player records its own place, so there only a reading
  // place written since counts, read live: the Read instead → read on →
  // Listen round trip.
  const newerAtOpen = positionSettled ? newerPosition(sessionAtOpen, serverPosition.data) : undefined;
  const readingPlace = useParityStore((state) => {
    const position = state.positions[chapterId];
    return position?.lastWrittenBy === "text" ? position : undefined;
  });
  const placeToMap = isLoaded ? readingPlace : newerAtOpen?.lastWrittenBy === "text" ? newerAtOpen : undefined;

  // The text's length maps a reading place into the narration. Read on the
  // sanctioned terms (`chapterTextOptions()`): only after the catalog row
  // proved the chapter published, never for a locked one, and only when
  // reading wrote last. Coming from M5 it is cached. One try, like the
  // position: offline or failed, the place falls back to the audio side.
  // A download knows its text's length already: no text is read for it.
  const downloadedTextLength = localCopy?.text?.length ?? null;
  const textEnabled =
    downloadedTextLength === null &&
    copy === null &&
    placeToMap !== undefined &&
    open != null &&
    lockState !== null &&
    lockState.kind !== "locked" &&
    open.hasAudio === true &&
    open.hasText !== false;
  const text = useQuery({ ...chapterTextOptions(chapterId), enabled: textEnabled, retry: false });
  const textAnswered =
    positionSettled &&
    (lockState !== null || copy !== null) &&
    (!textEnabled ||
      text.data !== undefined ||
      text.fetchStatus === "paused" ||
      (text.isError && !text.isFetching));
  // Latched like the position, so a later refetch never sends an open
  // chapter back to the skeleton.
  const [textSettled, setTextSettled] = useState(false);
  if (!textSettled && textAnswered) setTextSettled(true);
  // A disabled query still hands back what the cache holds: never a fetch.
  const textLength = downloadedTextLength ?? (typeof text.data === "string" ? text.data.length : null);

  function resolve(): Resolved {
    // The downloads index is still rehydrating.
    if (download === undefined) return settled("loading");
    if (open === undefined) return waitFor([chapter]);
    if (copy === null) {
      // Missing, unpublished, hidden by RLS, or unpublished while open.
      if (open === null || book.data === null) return settled("unavailable");
      if (book.data === undefined) return waitFor([book]);
      // The cached row is being fetched again, or that failed: it decides nothing yet.
      if (!rowUsable) {
        return chapterCheck === "failed" ? { view: { status: "failed" }, waitingOn: [chapter] } : settled("loading");
      }
      if (lockState === null) return waitFor([unlocks, entitlement]);
      if (lockState.kind === "locked") return settled("locked");
    } else if (copyExpired && !isLoaded) {
      // Offline past its 30 days: the next online check restores or deletes it.
      return settled("expired");
    }
    if (open === null) return settled("unavailable");
    // A null `has_audio` is the view's nullable typing: nothing to play either.
    if (open.hasAudio !== true) return settled("no-audio");

    if (isLoaded) {
      // A re-mint that failed, or one waiting for a connection.
      if (loadedPhase === "failed") return settled("failed");
      if (loadedPhase === "offline") return settled("offline");
    } else {
      if (!hasFile) {
        if (source.data === undefined) return waitFor([source]);
        // The server is checking the reader's plan, then signing again.
        if (checkingPlan) return settled("loading");
        // The row lost its narration after `has_audio` was read, or the
        // server withheld it.
        if (source.data.kind === "unavailable") return settled("unavailable");
        if (source.data.kind === "refused") return settled(rechecked ? "unavailable" : "loading");
      }
      // The URL or the file is ready; where Play starts is not yet. Never an error.
      if (!positionSettled || !textSettled) return settled("loading");
    }

    // A zero is a failed measurement, not a length: unknown, never "0:00".
    const durationSeconds =
      open.durationSeconds !== null && open.durationSeconds > 0 ? open.durationSeconds : null;
    const timeline = { durationSeconds, textLength };

    let restore: RestorePoint | null;
    if (!isLoaded) {
      restore = audioRestoreMs(newerAtOpen, timeline);
    } else {
      // Unmapped (no text at hand) is the player's own place.
      const mapped = readingPlace ? audioRestoreMs(readingPlace, timeline) : null;
      restore = mapped?.mapped ? mapped : null;
    }

    return {
      view: {
        status: "ready",
        chapter: {
          chapterId: open.id,
          bookId: open.bookId,
          number: open.number,
          title: open.title,
          ...shownBook(),
          durationSeconds,
          previousId: toNeighbour(neighbours.data?.previous)?.id ?? null,
          nextId: next?.id ?? null,
          nextLocked: nextLockState?.kind === "locked",
          restore,
          isLoaded,
          hasBookmark,
          hasText: open.hasText !== false,
          openedOffline: copy !== null,
        },
      },
      waitingOn: [],
    };
  }

  /** The book lines and cover: from the download offline, else from the catalog. */
  function shownBook(): Pick<LoadedChapter, "bookTitle" | "author" | "coverUrl"> {
    if (copy !== null) return { bookTitle: copy.book.title, author: copy.book.author, coverUrl: copy.book.coverUrl };
    return {
      bookTitle: book.data?.title ?? "Untitled",
      author: book.data?.author ?? null,
      coverUrl:
        settings.data && book.data ? resolveCoverUrl(settings.data.public_cdn_domain, book.data.cover_path) : null,
    };
  }

  const { view, waitingOn } = resolve();

  function retry() {
    if (loadedPhase === "failed") {
      retryLoaded();
      return;
    }
    for (const query of waitingOn) {
      if (query.isError) void query.refetch();
    }
  }

  const meta: NowPlayingMeta = {
    book: copy
      ? { title: copy.book.title, author: copy.book.author }
      : book.data
        ? { title: book.data.title ?? "Untitled", author: book.data.author }
        : null,
    chapter: open ? { number: open.number, title: open.title } : null,
  };

  return { view, meta, retry };
}
