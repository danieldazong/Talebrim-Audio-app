import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { useLoadedPhase } from "@/hooks/use-audio";
import { retryLoaded, type LoadedChapter } from "@/lib/audio/player";
import { audioRestoreMs, newerPosition } from "@/lib/audio/rules";
import { resolveCoverUrl } from "@/lib/covers";
import type { RestorePoint } from "@/lib/parity/convert";
import { adoptServerPosition } from "@/lib/parity/writer";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { chapterAudioSourceOptions } from "@/lib/queries/audio";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions, chapterNeighboursOptions, chapterTextOptions } from "@/lib/queries/chapters";
import { readingPositionByChapterOptions } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";
import { useParityStore } from "@/store/parity-store";
import type { ChapterDetailRow, ChapterTargetRow } from "@/types/catalog";
import { lockStateFor, type LockableChapter, type PlayerStatus } from "@/types/states";

/** The ready state's chapter: what the player loads, and what the screen shows around it. */
export type PlayingChapter = LoadedChapter & {
  /** Null at either end of the book, and while the neighbours load or after they fail. */
  previousId: string | null;
  nextId: string | null;
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

function neighbourId(row: ChapterTargetRow | null | undefined): string | null {
  if (!row || row.id === null || row.number === null) return null;
  return row.id;
}

function settled(status: "unavailable" | "locked" | "no-audio" | "failed" | "offline" | "loading"): Resolved {
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
 * A chapter that isn't the player's loaded one also waits, after the lock
 * check, for its signed narration URL (`chapterAudioSourceOptions()`) and for
 * its saved position, which is where Play starts. When reading wrote that
 * position last, it waits for the chapter's text too, to map the place into
 * the narration (prompt 19 step 4). The loaded chapter waits for none of
 * them: opening M6 from the mini player never re-signs. Its failures are
 * the player's, not a query's.
 */
export function useNowPlaying(chapterId: string) {
  const { userId } = useAuth();
  const loadedPhase = useLoadedPhase(chapterId);
  const isLoaded = loadedPhase !== null;

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

  // The narration URL: only after the lock check, never for a locked
  // chapter, and never for the loaded chapter, which already plays.
  const sourceEnabled =
    !isLoaded &&
    Boolean(userId) &&
    open != null &&
    lockState !== null &&
    lockState.kind !== "locked" &&
    open.hasAudio === true;
  const source = useQuery({ ...chapterAudioSourceOptions(userId ?? "", chapterId), enabled: sourceEnabled });
  const refused = sourceEnabled && source.data?.kind === "refused";

  // Storage refused to sign: the lock rule may have changed since it was
  // read. Settings and unlocks are fetched again, once, and the lock check
  // above decides between Locked and Not available.
  const recheckStarted = useRef(false);
  const [rechecked, setRechecked] = useState(false);
  const refetchSettings = settings.refetch;
  const refetchUnlocks = unlocks.refetch;
  useEffect(() => {
    if (!refused || recheckStarted.current) return;
    recheckStarted.current = true;
    void Promise.allSettled([refetchSettings(), refetchUnlocks()]).then(() => setRechecked(true));
  }, [refused, refetchSettings, refetchUnlocks]);

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
  const textEnabled =
    placeToMap !== undefined &&
    open != null &&
    lockState !== null &&
    lockState.kind !== "locked" &&
    open.hasAudio === true &&
    open.hasText !== false;
  const text = useQuery({ ...chapterTextOptions(chapterId), enabled: textEnabled, retry: false });
  const textAnswered =
    positionSettled &&
    lockState !== null &&
    (!textEnabled ||
      text.data !== undefined ||
      text.fetchStatus === "paused" ||
      (text.isError && !text.isFetching));
  // Latched like the position, so a later refetch never sends an open
  // chapter back to the skeleton.
  const [textSettled, setTextSettled] = useState(false);
  if (!textSettled && textAnswered) setTextSettled(true);
  // A disabled query still hands back what the cache holds: never a fetch.
  const textLength = typeof text.data === "string" ? text.data.length : null;

  function resolve(): Resolved {
    if (open === undefined) return waitFor([chapter]);
    // Missing, unpublished, hidden by RLS, or unpublished while open.
    if (open === null || book.data === null) return settled("unavailable");
    if (book.data === undefined || settings.data === undefined) return waitFor([book, settings]);
    if (lockState === null) return waitFor([unlocks]);
    if (lockState.kind === "locked") return settled("locked");
    // A null `has_audio` is the view's nullable typing: nothing to play either.
    if (open.hasAudio !== true) return settled("no-audio");

    if (isLoaded) {
      // A re-mint that failed, or one waiting for a connection.
      if (loadedPhase === "failed") return settled("failed");
      if (loadedPhase === "offline") return settled("offline");
    } else {
      if (source.data === undefined) return waitFor([source]);
      // The row lost its narration after `has_audio` was read.
      if (source.data.kind === "unavailable") return settled("unavailable");
      if (source.data.kind === "refused") return settled(rechecked ? "unavailable" : "loading");
      // The URL is ready; where Play starts is not yet. Never an error.
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
          bookTitle: book.data.title ?? "Untitled",
          author: book.data.author,
          coverUrl: resolveCoverUrl(settings.data.public_cdn_domain, book.data.cover_path),
          durationSeconds,
          previousId: neighbourId(neighbours.data?.previous),
          nextId: neighbourId(neighbours.data?.next),
          restore,
          isLoaded,
          hasBookmark,
          hasText: open.hasText !== false,
        },
      },
      waitingOn: [],
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
    book: book.data ? { title: book.data.title ?? "Untitled", author: book.data.author } : null,
    chapter: open ? { number: open.number, title: open.title } : null,
  };

  return { view, meta, retry };
}
