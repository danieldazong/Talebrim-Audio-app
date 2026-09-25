// Resolving a chapter for the player without a screen: autoplay, previous
// and next on the loaded chapter, and the next chapter's URL minted ahead.
// No React, no hooks, no JSX (AGENTS.md § lib/). Reads through the same query
// options as M6, so a cached answer is reused and a fetched one is cached.
import { onlineManager } from "@tanstack/react-query";

import { audioRestoreMs, newerPosition } from "@/lib/audio/rules";
import { resolveCoverUrl } from "@/lib/covers";
import { adoptServerPosition } from "@/lib/parity/writer";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions, chapterNeighboursOptions, chapterTextOptions } from "@/lib/queries/chapters";
import { readingPositionByChapterOptions, type ReadingPosition } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryClient } from "@/lib/query-client";
import { useParityStore } from "@/store/parity-store";
import { lockStateFor } from "@/types/states";

/** Everything the player keeps about the chapter it has loaded. */
export type LoadedChapter = {
  chapterId: string;
  /** Every position is recorded with its book (`reading_positions.book_id`). */
  bookId: string;
  number: number;
  title: string | null;
  bookTitle: string;
  author: string | null;
  /** Resolved from the live CDN domain; null when the book has no cover. */
  coverUrl: string | null;
  /** The catalog's measured length; null when it was never measured. */
  durationSeconds: number | null;
};

export type ChapterVerdict =
  | { kind: "playable"; chapter: LoadedChapter; startMs: number }
  | { kind: "locked" }
  | { kind: "no-audio" }
  | { kind: "unavailable" };

/**
 * The server's copy of one chapter's position, adopted into the session when
 * it is newer. Fetched fresh when online, as M5 does on open; offline, or
 * after an error, whatever the cache holds. Never fails the caller.
 */
async function serverPosition(userId: string, chapterId: string): Promise<ReadingPosition | null | undefined> {
  const options = readingPositionByChapterOptions(userId, chapterId);
  let row = queryClient.getQueryData(options.queryKey);
  if (onlineManager.isOnline()) {
    try {
      row = await queryClient.fetchQuery({ ...options, staleTime: 0, retry: false });
    } catch {
      // The cached row, or none: a missing position never holds up playback.
    }
  }
  if (row !== undefined) adoptServerPosition(chapterId, row);
  return row;
}

/**
 * Whether a chapter can play, and if so what the player needs to load it and
 * where it starts. The same checks, in the same order, as M6
 * (`hooks/use-now-playing.ts`): published, then the lock rule, then audio.
 */
export async function resolveChapter(userId: string, chapterId: string): Promise<ChapterVerdict> {
  const row = await queryClient.fetchQuery(chapterDetailOptions(chapterId));
  if (row === null || row.id === null || row.book_id === null || row.number === null) {
    return { kind: "unavailable" };
  }
  const chapter = { id: row.id, number: row.number, access: row.access };

  const [book, settings] = await Promise.all([
    queryClient.fetchQuery(bookDetailOptions(row.book_id)),
    queryClient.fetchQuery(appSettingsOptions()),
  ]);
  if (book === null) return { kind: "unavailable" };

  // The one lock rule, shared with M4, M5 and M6. Unlocks are fetched only
  // for a chapter that is free neither by access nor by position.
  // TODO(paywall): the subscription entitlement is not checked yet.
  let lock = lockStateFor(chapter, settings.free_chapters_at_start, undefined);
  if (lock === null) {
    const unlocks = await queryClient.fetchQuery(unlocksByUserOptions(userId));
    lock = lockStateFor(chapter, settings.free_chapters_at_start, new Set(unlocks.map((unlock) => unlock.chapter_id)));
  }
  if (lock === null || lock.kind === "locked") return { kind: "locked" };
  if (row.has_audio !== true) return { kind: "no-audio" };

  const durationSeconds =
    row.audio_duration_seconds !== null && row.audio_duration_seconds > 0 ? row.audio_duration_seconds : null;
  const server = await serverPosition(userId, chapterId);
  const session = useParityStore.getState().getPosition(chapterId);

  return {
    kind: "playable",
    chapter: {
      chapterId,
      bookId: row.book_id,
      number: row.number,
      title: row.title,
      bookTitle: book.title ?? "Untitled",
      author: book.author,
      coverUrl: resolveCoverUrl(settings.public_cdn_domain, book.cover_path),
      durationSeconds,
    },
    startMs: audioRestoreMs(newerPosition(session, server), { durationSeconds, textLength: cachedTextLength(chapterId) })
      .value,
  };
}

/**
 * The chapter's text length for mapping a reading place into audio, from the
 * cache only (prompt 19 step 4). Nothing here downloads a chapter's text:
 * without it, the audio side stands.
 */
function cachedTextLength(chapterId: string): number | null {
  const text = queryClient.getQueryData(chapterTextOptions(chapterId).queryKey);
  return typeof text === "string" ? text.length : null;
}

/** The chapter after `chapter` in its book, resolved; null at the last chapter. */
export async function resolveNextChapter(userId: string, chapter: LoadedChapter): Promise<ChapterVerdict | null> {
  const { next } = await queryClient.fetchQuery(chapterNeighboursOptions(chapter.bookId, chapter.number));
  if (!next || next.id === null) return null;
  return resolveChapter(userId, next.id);
}
