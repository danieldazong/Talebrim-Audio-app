// M7 Library's pure parts — prompt 21 step 12. My List, the reader's newest
// positions, the chapter loaded in the player and the lock inputs in; what
// each segment shows, how far along each book is, how long is left in the
// chapter being listened to, and where the resume button goes, out.
// No React, no hooks, no JSX — AGENTS.md § lib/.
import { formatDuration } from "@/lib/format";
import type { LibraryItem } from "@/lib/queries/library-items";
import type { RecentPosition } from "@/lib/queries/reading-position";
import type { ParitySourceMode } from "@/store/parity-store";
import type { Enums } from "@/types/database";
import { lockStateFor } from "@/types/states";

export type LibrarySegment = "books" | "audiobooks";

/** A book with narration: the Audiobooks segment, and the teal headphone badge. */
export function isAudiobook(book: { audio_count: number | null }): boolean {
  return (book.audio_count ?? 0) > 0;
}

/** Items whose embedded book has an id. The view types every column as nullable. */
function listed(items: readonly LibraryItem[]): LibraryItem[] {
  return items.filter((item) => item.book.id !== null);
}

/** Books is every book on My List; Audiobooks, those with narration. Order is kept: newest saved first. */
export function itemsInSegment(items: readonly LibraryItem[], segment: LibrarySegment): LibraryItem[] {
  const all = listed(items);
  return segment === "books" ? all : all.filter((item) => isAudiobook(item.book));
}

export function segmentCounts(items: readonly LibraryItem[]): Record<LibrarySegment, number> {
  return {
    books: itemsInSegment(items, "books").length,
    audiobooks: itemsInSegment(items, "audiobooks").length,
  };
}

/** A position that passed its null checks, its chapter flattened. */
export type LibraryPosition = {
  chapterId: string;
  bookId: string;
  number: number;
  access: Enums<"chapter_access"> | null;
  hasText: boolean;
  hasAudio: boolean;
  lastMode: ParitySourceMode;
  /** The saved listening place, in milliseconds; null when never listened to. */
  audioMs: number | null;
  /** The catalog's measured length; null when never measured. */
  audioDurationSeconds: number | null;
};

/**
 * The newest positions, newest first as the query returns them. A row with
 * no book id or no chapter number is the view's nullable typing, and is
 * dropped, as on M4 and M9.
 */
export function libraryPositions(rows: readonly RecentPosition[]): LibraryPosition[] {
  return rows.flatMap((row) => {
    if (!row.book_id || row.chapter.number === null) return [];
    return [
      {
        chapterId: row.chapter_id,
        bookId: row.book_id,
        number: row.chapter.number,
        access: row.chapter.access,
        hasText: row.chapter.has_text === true,
        hasAudio: row.chapter.has_audio === true,
        // The table's check constraint allows exactly these two.
        lastMode: row.last_mode === "audio" ? "audio" : "text",
        audioMs: row.audio_ms,
        audioDurationSeconds: row.chapter.audio_duration_seconds,
      },
    ];
  });
}

/**
 * The Continue card's row: the newest for Books, and for Audiobooks the
 * newest last written by listening, even when something was read since.
 * Null collapses the section.
 */
export function continuePosition(
  positions: readonly LibraryPosition[],
  segment: LibrarySegment,
): LibraryPosition | null {
  const match = segment === "books" ? positions[0] : positions.find((row) => row.lastMode === "audio");
  return match ?? null;
}

/** Each book's newest row. A book with no row among them has no progress line. */
export function newestPositionByBook(positions: readonly LibraryPosition[]): Map<string, LibraryPosition> {
  const byBook = new Map<string, LibraryPosition>();
  for (const row of positions) {
    if (!byBook.has(row.bookId)) byBook.set(row.bookId, row);
  }
  return byBook;
}

/** The chapter loaded in the player, as far as Library needs it. */
export type LoadedPlace = {
  chapterId: string;
  bookId: string;
  number: number;
  /** The catalog's measured length; null when never measured. */
  durationSeconds: number | null;
};

/**
 * Whether a book's newest row gives way to the chapter loaded in the player:
 * only a listening row, and only in the same book. The player records as it
 * plays, so its chapter is the newer place, and autoplay moves it on while
 * the saved rows wait for Library's next refetch. The Continue card and the
 * grid line both follow it, so they never disagree about one book.
 */
export function followsLoadedChapter(row: LibraryPosition, loaded: LoadedPlace | null): loaded is LoadedPlace {
  return loaded !== null && row.lastMode === "audio" && row.bookId === loaded.bookId;
}

/**
 * Whole seconds left in a chapter, as M6 prints its remaining time; null when
 * the place or the length is unknown, never "0:00" for an unmeasured file.
 */
export function secondsLeft(positionMs: number | null, durationSeconds: number | null): number | null {
  if (positionMs === null || durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return null;
  }
  return Math.max(0, Math.floor(durationSeconds - Math.floor(positionMs / 1000)));
}

/** "2 minutes left" for a screen reader: whole minutes, so a focused label doesn't change every second. */
function timeLeftSpoken(seconds: number): string {
  if (seconds < 60) return "less than a minute left";
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? "minute" : "minutes"} left`;
}

/**
 * The Continue card's progress line. Listening adds the time left in the
 * chapter: "Chapter 1 of 13 · 2:00 left". Without it, the chapter alone.
 */
export function progressLine(progress: ChapterProgress, left: number | null): { shown: string; spoken: string } {
  if (left === null) return { shown: progress.label, spoken: progress.label };
  return {
    shown: `${progress.label} · ${formatDuration(left)} left`,
    spoken: `${progress.label}, ${timeLeftSpoken(left)}`,
  };
}

export type ChapterProgress = {
  /** "Chapter 12 of 40", or "Chapter 12" without a count. */
  label: string;
  /** How far the bar fills, 0 to 1. Null draws no bar. */
  fraction: number | null;
};

/**
 * One measure for both modes, on the card and the grid alike. No "% complete":
 * a text offset has no text length to be measured against. `chapterCount`
 * can differ from M5's "of M" where chapter numbers skip; that is accepted.
 */
export function chapterProgress(number: number, chapterCount: number | null): ChapterProgress {
  if (chapterCount === null || chapterCount <= 0) return { label: `Chapter ${number}`, fraction: null };
  return { label: `Chapter ${number} of ${chapterCount}`, fraction: Math.min(number / chapterCount, 1) };
}

/** Where the Continue card's button goes. Only "reader" and "player" open anything. */
export type ResumeTarget =
  | { kind: "reader"; chapterId: string }
  /** M6, told to play: it is a play button, as M5's Listen is. */
  | { kind: "player"; chapterId: string }
  /** The lock can't be told yet. */
  | { kind: "pending" }
  | { kind: "locked" }
  /** The chapter has neither text nor narration. */
  | { kind: "none" };

export type ResumeLockInputs = {
  /** Live `free_chapters_at_start`; undefined while settings load. */
  freeChaptersAtStart: number | undefined;
  /** Chapter ids from the reader's unlocks; undefined while they load. */
  unlockedChapterIds: ReadonlySet<string> | undefined;
};

/**
 * Resumes in the mode the reader left, or the other one when the chapter no
 * longer has that side: never a round trip to an empty state. The lock is
 * `lockStateFor()`'s, as on M5 and M6, so a chapter free by access or by
 * position never waits for the unlocks.
 * TODO(paywall): the subscription entitlement isn't checked yet, as on M4–M6.
 */
export function resumeTarget(position: LibraryPosition, inputs: ResumeLockInputs): ResumeTarget {
  if (inputs.freeChaptersAtStart === undefined) return { kind: "pending" };
  const lock = lockStateFor(
    { id: position.chapterId, number: position.number, access: position.access },
    inputs.freeChaptersAtStart,
    inputs.unlockedChapterIds,
  );
  if (lock === null) return { kind: "pending" };
  if (lock.kind === "locked") return { kind: "locked" };

  const order: ("player" | "reader")[] = position.lastMode === "audio" ? ["player", "reader"] : ["reader", "player"];
  const kind = order.find((mode) => (mode === "player" ? position.hasAudio : position.hasText));
  return kind ? { kind, chapterId: position.chapterId } : { kind: "none" };
}

/** What a screen reader hears for the resume button, including why it won't open. */
export function resumeLabel(target: ResumeTarget, title: string, number: number): string {
  const place = `${title}, chapter ${number}`;
  switch (target.kind) {
    case "player":
      return `Continue listening to ${place}`;
    case "reader":
      return `Continue reading ${place}`;
    case "pending":
      return `Loading ${place}`;
    case "locked":
      return `${place} is locked`;
    case "none":
      return `${place} has nothing to read or play yet`;
  }
}

/** One grid book as one element: "{title} by {author}. Audiobook. Chapter {n} of {m}.", with only the known parts. */
export function gridItemLabel(
  book: { title: string | null; author: string | null; audio_count: number | null },
  progress: ChapterProgress | null,
): string {
  const title = book.title ?? "Untitled";
  return `${[
    book.author ? `${title} by ${book.author}` : title,
    isAudiobook(book) ? "Audiobook" : null,
    progress?.label ?? null,
  ]
    .filter((part) => part !== null)
    .join(". ")}.`;
}

/** An optimistic add: the book goes first, once. Already listed, nothing changes. */
export function withBookAdded(items: LibraryItem[], item: LibraryItem): LibraryItem[] {
  return items.some((existing) => existing.book_id === item.book_id) ? items : [item, ...items];
}

/** An optimistic remove. */
export function withBookRemoved(items: LibraryItem[], bookId: string): LibraryItem[] {
  return items.filter((item) => item.book_id !== bookId);
}
