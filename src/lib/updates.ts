// The Updates inbox behind Discover's bell — added 2026-09-30 (AGENTS.md,
// Decisions — 2026-09-30, "Updates inbox"). The pure parts: which chapters
// show, which are new, and when the reader last looked. No React, no hooks,
// no JSX (AGENTS.md § lib/).
//
// "Seen" is a moment on the SERVER's clock: the `created_at` of the newest
// chapter the reader has had in front of them. Never the phone's clock, which
// can be minutes out (the owner's was, 2026-09-30), and would mark a chapter
// added a moment ago as seen, or one seen as new.
import type { LibraryItem } from "@/lib/queries/library-items";
import type { UpdateRow } from "@/lib/queries/updates";
import type { Enums } from "@/types/database";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How far back the inbox reaches. */
export const UPDATES_WINDOW_MS = 30 * DAY;

export type UpdateItem = {
  chapterId: string;
  bookId: string;
  bookTitle: string;
  coverPath: string | null;
  number: number;
  chapterTitle: string | null;
  access: Enums<"chapter_access"> | null;
  hasText: boolean;
  hasAudio: boolean;
  /** When the chapter was added, on the server's clock. */
  createdAt: string;
  createdAtMs: number;
  /** Added after the reader last looked at Updates. */
  isNew: boolean;
};

function time(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * The inbox's rows, newest first: chapters with text or narration, of books
 * still on My List, added after the book was put there. A chapter from
 * before the reader followed the book is not an update for them. `seenAt`
 * null (never looked, on this phone or the account) makes every row new.
 */
export function buildUpdates(
  rows: readonly UpdateRow[],
  myList: readonly LibraryItem[],
  seenAt: number | null,
): UpdateItem[] {
  const books = new Map(myList.map((item) => [item.book_id, item]));
  const items: UpdateItem[] = [];
  for (const row of rows) {
    if (row.id === null || row.book_id === null || row.number === null) continue;
    if (row.has_text !== true && row.has_audio !== true) continue;
    const item = books.get(row.book_id);
    const createdAtMs = time(row.created_at);
    if (item === undefined || createdAtMs === null || row.created_at === null) continue;
    const addedAtMs = time(item.created_at);
    if (addedAtMs !== null && createdAtMs < addedAtMs) continue;
    items.push({
      chapterId: row.id,
      bookId: row.book_id,
      bookTitle: item.book.title ?? "Untitled",
      coverPath: item.book.cover_path,
      number: row.number,
      chapterTitle: row.title,
      access: row.access,
      hasText: row.has_text === true,
      hasAudio: row.has_audio === true,
      createdAt: row.created_at,
      createdAtMs,
      isNew: seenAt === null || createdAtMs > seenAt,
    });
  }
  return items.sort((a, b) => b.createdAtMs - a.createdAtMs || b.number - a.number);
}

/** How many rows are new: the dot on the bell, and what it says to a screen reader. */
export function unreadCount(items: readonly UpdateItem[]): number {
  return items.filter((item) => item.isNew).length;
}

/** The newest row's time: what "seen" moves to when the reader looks. Null with no rows. */
export function newestUpdateAt(items: readonly UpdateItem[]): number | null {
  return items.reduce<number | null>((latest, item) => (latest === null || item.createdAtMs > latest ? item.createdAtMs : latest), null);
}

/**
 * The account's copy of "seen": Clerk's `unsafeMetadata.updates.seenAt`, an
 * ISO time. The reader's own to write, so read as untrusted: anything but a
 * valid time is null.
 */
export function seenAtFromAccount(unsafeMetadata: unknown): number | null {
  if (typeof unsafeMetadata !== "object" || unsafeMetadata === null) return null;
  const updates = (unsafeMetadata as { updates?: unknown }).updates;
  if (typeof updates !== "object" || updates === null) return null;
  const seenAt = (updates as { seenAt?: unknown }).seenAt;
  return typeof seenAt === "string" ? time(seenAt) : null;
}

/** The later of two "seen" moments, either of which may be unknown. */
export function latestSeen(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/** "Chapter 8: The Oath", or "Chapter 8" without a title. */
export function updateChapterLabel(number: number, title: string | null): string {
  const name = title?.trim();
  return name ? `Chapter ${number}: ${name}` : `Chapter ${number}`;
}

/**
 * How long ago, shown and spoken: "Just now", "5 min ago", "3 h ago",
 * "Yesterday", "4 days ago", then the date. A time a few seconds in the
 * future (the phone's clock behind the server's) reads "Just now".
 */
export function updateAge(createdAtMs: number, now: number, date: string | null): { shown: string; spoken: string } {
  const ago = Math.max(0, now - createdAtMs);
  if (ago < MINUTE) return { shown: "Just now", spoken: "Just now" };
  if (ago < HOUR) {
    const minutes = Math.floor(ago / MINUTE);
    return { shown: `${minutes} min ago`, spoken: `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago` };
  }
  if (ago < DAY) {
    const hours = Math.floor(ago / HOUR);
    return { shown: `${hours} h ago`, spoken: `${hours} ${hours === 1 ? "hour" : "hours"} ago` };
  }
  if (ago < 2 * DAY) return { shown: "Yesterday", spoken: "Yesterday" };
  if (ago < 7 * DAY) {
    const days = Math.floor(ago / DAY);
    return { shown: `${days} days ago`, spoken: `${days} days ago` };
  }
  return date === null ? { shown: "", spoken: "" } : { shown: date, spoken: date };
}
