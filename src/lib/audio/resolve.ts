// Resolving a chapter for the player without a screen: autoplay, previous
// and next on the loaded chapter, and the next chapter's URL minted ahead.
// No React, no hooks, no JSX (AGENTS.md § lib/). Reads through the same query
// options as M6, so a cached answer is reused and a fetched one is cached.
import { onlineManager } from "@tanstack/react-query";

import { audioRestoreMs, newerPosition } from "@/lib/audio/rules";
import { resolveCoverUrl } from "@/lib/covers";
import { downloadFor, downloadsFor } from "@/lib/downloads/local";
import { nextDownloadedChapter, playableOffline } from "@/lib/downloads/rules";
import { adoptServerPosition } from "@/lib/parity/writer";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { entitlementOptions } from "@/lib/queries/billing";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions, chapterNeighboursOptions, chapterTextOptions } from "@/lib/queries/chapters";
import { readingPositionByChapterOptions, type ReadingPosition } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryClient } from "@/lib/query-client";
import { useParityStore } from "@/store/parity-store";
import type { BookDetailRow, ChapterDetailRow } from "@/types/catalog";
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
  | { kind: "locked"; chapterId: string }
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

/** A chapter row with the columns loading it needs known to be set. */
type PlayableRow = ChapterDetailRow & { id: string; book_id: string; number: number };

/** What `checkChapter()` found: the row and book to load, or why it can't play. */
export type ChapterCheck =
  | { kind: "playable"; row: PlayableRow; book: BookDetailRow }
  | Exclude<ChapterVerdict, { kind: "playable" }>;

/**
 * Whether a chapter can play: the same checks, in the same order, as M6
 * (`hooks/use-now-playing.ts`): published, then the lock rule, then audio.
 * Online, the chapter's row is always fetched fresh (2026-09-30): a cached
 * one can be from before the owner locked the chapter in the dashboard.
 */
export async function checkChapter(userId: string, chapterId: string): Promise<ChapterCheck> {
  const detail = chapterDetailOptions(chapterId);
  const row = await queryClient.fetchQuery(onlineManager.isOnline() ? { ...detail, staleTime: 0 } : detail);
  if (row === null || row.id === null || row.book_id === null || row.number === null) {
    return { kind: "unavailable" };
  }
  const chapter = { id: row.id, number: row.number, access: row.access };

  const book = await queryClient.fetchQuery(bookDetailOptions(row.book_id));
  if (book === null) return { kind: "unavailable" };

  // The one lock rule, shared with M4, M5 and M6, the subscription included.
  // The unlocks and the entitlement are fetched only for a chapter that isn't
  // free by its own access.
  let lock = lockStateFor(chapter, undefined, undefined);
  if (lock === null) {
    const [unlocks, entitlement] = await Promise.all([
      queryClient.fetchQuery(unlocksByUserOptions(userId)),
      queryClient.fetchQuery(entitlementOptions(userId)),
    ]);
    lock = lockStateFor(chapter, new Set(unlocks.map((unlock) => unlock.chapter_id)), entitlement.active);
  }
  if (lock === null || lock.kind === "locked") return { kind: "locked", chapterId };
  if (row.has_audio !== true) return { kind: "no-audio" };
  return { kind: "playable", row: { ...row, id: row.id, book_id: row.book_id, number: row.number }, book };
}

/**
 * Whether a chapter can play, and if so what the player needs to load it and
 * where it starts (`checkChapter()`, then the cover and the position).
 */
export async function resolveChapter(userId: string, chapterId: string): Promise<ChapterVerdict> {
  if (!onlineManager.isOnline()) {
    const offline = await resolveDownloaded(userId, chapterId);
    if (offline !== null) return offline;
  }

  const checked = await checkChapter(userId, chapterId);
  if (checked.kind !== "playable") return checked;
  const { row, book } = checked;
  const settings = await queryClient.fetchQuery(appSettingsOptions());

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
    startMs: audioRestoreMs(newerPosition(session, server), {
      durationSeconds,
      textLength: cachedTextLength(chapterId) ?? downloadFor(userId, chapterId)?.text?.length ?? null,
    }).value,
  };
}

/**
 * Offline, a downloaded chapter resolves from the index, never from a paused
 * query (prompt 24 step 9): its last online check, within its 30 days,
 * stands in for the lock check. Null for anything else, which resolves as
 * before and waits for a connection.
 */
async function resolveDownloaded(userId: string, chapterId: string): Promise<ChapterVerdict | null> {
  const entry = downloadFor(userId, chapterId);
  if (entry === null) return null;
  if (entry.audio === null) return { kind: "no-audio" };
  if (!playableOffline(entry, Date.now())) return null;

  const server = await serverPosition(userId, chapterId);
  const session = useParityStore.getState().getPosition(chapterId);
  return {
    kind: "playable",
    chapter: {
      chapterId,
      bookId: entry.book.id,
      number: entry.number,
      title: entry.title,
      bookTitle: entry.book.title,
      author: entry.book.author,
      coverUrl: entry.book.coverUrl,
      durationSeconds: entry.durationSeconds,
    },
    startMs: audioRestoreMs(newerPosition(session, server), {
      durationSeconds: entry.durationSeconds,
      textLength: entry.text?.length ?? cachedTextLength(chapterId),
    }).value,
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

/**
 * The chapter after `chapter` in its book, resolved; null at the last
 * chapter. Offline, autoplay never waits: it moves to the book's next
 * downloaded chapter, or stops at the end of this one, as at the end of a
 * book (prompt 24 step 9). When the cached neighbours name the next chapter,
 * only that one will do, so a chapter the reader hasn't got is never skipped.
 */
export async function resolveNextChapter(userId: string, chapter: LoadedChapter): Promise<ChapterVerdict | null> {
  const neighbours = chapterNeighboursOptions(chapter.bookId, chapter.number);
  if (!onlineManager.isOnline()) {
    const known = queryClient.getQueryData(neighbours.queryKey);
    const next = nextDownloadedChapter(
      downloadsFor(userId),
      chapter,
      known === undefined ? undefined : (known.next?.id ?? null),
      Date.now(),
    );
    return next === null ? null : resolveChapter(userId, next.chapterId);
  }

  const { next } = await queryClient.fetchQuery(neighbours);
  if (!next || next.id === null) return null;
  return resolveChapter(userId, next.id);
}
