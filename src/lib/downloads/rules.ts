// The pure rules of offline downloads — prompt 24. No React, no hooks, no JSX
// (AGENTS.md § lib/), and no `expo-file-system`, so each rule is unit-tested
// without a native module.
import type { DownloadAllState } from "@/lib/chapter-list";
import type { QueueItem } from "@/lib/downloads/queue";
import { formatBytes } from "@/lib/format";
import type { DownloadRow } from "@/lib/queries/downloads";
import type { DownloadedBook, DownloadEntry } from "@/store/downloads-store";
import { chapterStateFor, type ChapterLockInputs } from "@/types/states";

/**
 * How long a download opens offline after access was last confirmed online.
 * Settled by the owner on 2026-09-25, as Spotify does: long enough for a
 * trip, short enough that a lapsed subscription ends within a month.
 */
export const OFFLINE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** How often returning to the foreground checks every download again. App start always does. */
export const RECHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Narration with no recorded size is counted at the upload standard's bitrate, and the size says "about". */
export const FALLBACK_AUDIO_KBPS = 64;

/** Free space left over after a chapter, so a download never fills the phone to the last byte. */
export const DISK_MARGIN_BYTES = 50 * 1000 * 1000;

/** The suffix a file carries while it is written. A partial file never looks complete. */
export const PARTIAL_SUFFIX = ".part";

/** True while a download opens with no network: within `OFFLINE_WINDOW_MS` of its last online check. */
export function withinOfflineWindow(verifiedAt: number, now: number): boolean {
  return now - verifiedAt <= OFFLINE_WINDOW_MS;
}

/** A chapter's size before it is downloaded, and whether any part of it was estimated. */
export type DownloadSize = { bytes: number; estimated: boolean };

export type SizedChapter = Pick<
  DownloadRow,
  "has_audio" | "has_text" | "audio_size_bytes" | "text_bytes" | "audio_duration_seconds"
>;

/**
 * What one chapter will take on disk: its narration's recorded size
 * (`chapters_catalog.audio_size_bytes`) plus its text's (`text_bytes`). A
 * narration with no recorded size counts its duration at
 * `FALLBACK_AUDIO_KBPS`, and one with neither counts nothing: both are
 * estimates.
 */
export function chapterDownloadSize(row: SizedChapter): DownloadSize {
  let bytes = 0;
  let estimated = false;
  if (row.has_audio === true) {
    if (row.audio_size_bytes !== null && row.audio_size_bytes > 0) {
      bytes += row.audio_size_bytes;
    } else {
      estimated = true;
      const seconds = row.audio_duration_seconds;
      if (seconds !== null && Number.isFinite(seconds) && seconds > 0) {
        bytes += Math.ceil((seconds * FALLBACK_AUDIO_KBPS * 1000) / 8);
      }
    }
  }
  if (row.has_text === true) bytes += row.text_bytes ?? 0;
  return { bytes, estimated };
}

/** Every chapter's size, summed. Estimated if any one of them is. */
export function totalDownloadSize(rows: readonly SizedChapter[]): DownloadSize {
  return rows.reduce<DownloadSize>(
    (total, row) => {
      const size = chapterDownloadSize(row);
      return { bytes: total.bytes + size.bytes, estimated: total.estimated || size.estimated };
    },
    { bytes: 0, estimated: false },
  );
}

/**
 * "Download all"'s one confirmation: the chapter count and the size, "about"
 * when any part was estimated, mobile data when the phone is on it, and that
 * downloads run only while the app is open (no background downloading, so
 * the copy never promises it).
 */
export function downloadConfirmation(
  count: number,
  size: DownloadSize,
  onMobileData: boolean,
): { title: string; message: string } {
  const chapters = count === 1 ? "1 chapter" : `${count} chapters`;
  return {
    title: `Download ${chapters}?`,
    message: [
      `${chapters}, ${size.estimated ? "about " : ""}${formatBytes(size.bytes)}.`,
      onMobileData ? "You're on mobile data." : null,
      "Keep Talebrim open while they download.",
    ]
      .filter((line) => line !== null)
      .join(" "),
  };
}

/** Whether `bytes` fits in `availableBytes` with the margin to spare. */
export function hasRoomFor(availableBytes: number, bytes: number): boolean {
  return availableBytes >= bytes + DISK_MARGIN_BYTES;
}

/**
 * The stored narration's extension, from its `audio_path` ("m4a"). The file
 * keeps it so the player sees the same kind of file it streams. Anything odd
 * becomes "audio": ExoPlayer reads the format from the content, not the name.
 */
export function audioExtension(path: string): string {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(path);
  return match ? match[1].toLowerCase() : "audio";
}

export function audioFileName(chapterId: string, ext: string): string {
  return `${chapterId}.${ext}`;
}

export function textFileName(chapterId: string): string {
  return `${chapterId}.txt`;
}

/** The files a complete entry has on disk. */
export function entryFileNames(entry: DownloadEntry): string[] {
  const names: string[] = [];
  if (entry.audio) names.push(audioFileName(entry.chapterId, entry.audio.ext));
  if (entry.text) names.push(textFileName(entry.chapterId));
  return names;
}

/** Every part the chapter had when it was downloaded is in the entry. */
function entryIsWhole(entry: DownloadEntry): boolean {
  return (!entry.hasAudio || entry.audio !== null) && (!entry.hasText || entry.text !== null);
}

export type ReconcilePlan = {
  /** The index belongs to another account: every file and entry goes. */
  wipe: boolean;
  /** Entries whose files are missing. */
  prune: string[];
  /** Files in `downloads/` that no kept entry lists, partial files included. */
  deleteFiles: string[];
};

/**
 * On start, for the signed-in `account`: the index and the folder made to
 * agree. An index written under another account (a sign-out that crashed
 * halfway, a device-to-device copy) is wiped. Otherwise an entry missing any
 * of its files is pruned, and a file no remaining entry lists is deleted.
 */
export function planReconcile(
  index: { userId: string | null; chapters: Record<string, DownloadEntry> },
  account: string,
  fileNames: readonly string[],
): ReconcilePlan {
  if (index.userId !== null && index.userId !== account) {
    return { wipe: true, prune: Object.keys(index.chapters), deleteFiles: [...fileNames] };
  }
  const onDisk = new Set(fileNames);
  const kept = new Set<string>();
  const prune: string[] = [];
  for (const entry of Object.values(index.chapters)) {
    const names = entryFileNames(entry);
    if (entryIsWhole(entry) && names.length > 0 && names.every((name) => onDisk.has(name))) {
      for (const name of names) kept.add(name);
    } else {
      prune.push(entry.chapterId);
    }
  }
  return { wipe: false, prune, deleteFiles: fileNames.filter((name) => !kept.has(name)) };
}

/** What an online check decides for one download. */
export type AccessVerdict =
  /** Still open, unchanged: `verifiedAt` moves on. */
  | "keep"
  /** Still open, edited since: `verifiedAt` moves on, and the changed parts are fetched again. */
  | "refresh"
  /** Locked now, or gone from `chapters_catalog` (unpublished or deleted): its files and entry go. */
  | "delete";

/**
 * The YouTube rule, for one download, from inputs that were ALL fetched
 * fresh: the catalog rows, the settings, the unlocks and the entitlement.
 * The caller never asks with a failed or unknown input; then nothing changes.
 */
export function accessVerdict(
  entry: DownloadEntry,
  row: Pick<DownloadRow, "id" | "number" | "access" | "updated_at"> | undefined,
  inputs: ChapterLockInputs,
): AccessVerdict {
  if (row === undefined || row.id === null || row.number === null) return "delete";
  const state = chapterStateFor({ id: row.id, number: row.number, access: row.access }, inputs);
  if (state.kind === "locked") return "delete";
  return row.updated_at === entry.updatedAt ? "keep" : "refresh";
}

/**
 * Which parts of an edited chapter to fetch again. Text always, when it has
 * text: its size and length are in the index. Narration only when its path
 * changed (the dashboard writes a new path for every replacement) or it
 * gained one.
 */
export function refreshParts(
  entry: DownloadEntry,
  row: Pick<DownloadRow, "has_text" | "has_audio">,
  audioPath: string | null,
): { text: boolean; audio: boolean } {
  return {
    text: row.has_text === true,
    audio: row.has_audio === true && audioPath !== null && entry.audio?.path !== audioPath,
  };
}

/** A download the player can use with no network: narration on disk, within its window. */
export function playableOffline(entry: DownloadEntry, now: number): boolean {
  return entry.audio !== null && withinOfflineWindow(entry.verifiedAt, now);
}

/**
 * Offline autoplay's next chapter. When the book's next chapter is known
 * (`knownNextId`, from a cached neighbours query), only that one, if it is
 * downloaded: a chapter the reader hasn't got, or can't open, is never
 * skipped. Otherwise the book's next downloaded chapter by number. Null
 * stops at the end of the chapter, as at the end of a book.
 */
export function nextDownloadedChapter(
  entries: readonly DownloadEntry[],
  current: { bookId: string; number: number },
  knownNextId: string | null | undefined,
  now: number,
): DownloadEntry | null {
  const playable = entries.filter(
    (entry) => entry.book.id === current.bookId && entry.number > current.number && playableOffline(entry, now),
  );
  if (knownNextId !== undefined) {
    return playable.find((entry) => entry.chapterId === knownNextId) ?? null;
  }
  return playable.reduce<DownloadEntry | null>(
    (next, entry) => (next === null || entry.number < next.number ? entry : next),
    null,
  );
}

/**
 * The chapters "Download all" would fetch: every one the reader can open now
 * that has text or narration and isn't downloaded or waiting already.
 */
export function downloadCandidates(
  rows: readonly DownloadRow[],
  inputs: ChapterLockInputs,
  skip: ReadonlySet<string>,
): DownloadRow[] {
  return rows.filter((row) => {
    if (row.id === null || row.number === null || skip.has(row.id)) return false;
    if (row.has_text !== true && row.has_audio !== true) return false;
    return chapterStateFor({ id: row.id, number: row.number, access: row.access }, inputs).kind !== "locked";
  });
}

/**
 * M4's download button (Decisions — 2026-09-30), from M9's "Download all"
 * state for the book. What it shows, and what a tap does:
 * - unavailable: downloads don't run here (iOS, the web): opens Downloads,
 *   which says they work in the Android app
 * - loading: the chapter list isn't known yet: disabled
 * - offline: nothing can download: disabled
 * - ready: downloads the book, after the size confirmation
 * - preparing: fetching the chapters and their sizes fresh: disabled
 * - failed: that fetch failed: tries again
 * - running: a run is going: opens the chapter list, where its progress
 *   and Cancel are
 * - done: every chapter the reader can open is downloaded: opens Downloads
 * - hidden: nothing in the book can be downloaded by this reader
 */
export type DownloadButton =
  | { kind: "unavailable" }
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "ready"; count: number }
  | { kind: "preparing" }
  | { kind: "failed" }
  | { kind: "running"; done: number; total: number }
  | { kind: "done" }
  | { kind: "hidden" };

export function downloadButton(input: {
  /** `downloadsAvailable()`. */
  available: boolean;
  /** M9's "Download all" state for the book; null until its chapter list is known. */
  state: DownloadAllState | null;
  online: boolean;
  preparing: boolean;
  prepareFailed: boolean;
}): DownloadButton {
  const { available, state, online, preparing, prepareFailed } = input;
  if (!available) return { kind: "unavailable" };
  if (preparing) return { kind: "preparing" };
  if (state === null) return online ? { kind: "loading" } : { kind: "offline" };
  switch (state.kind) {
    case "running":
    case "done":
    case "hidden":
      return state;
    case "ready":
      if (!online) return { kind: "offline" };
      return prepareFailed ? { kind: "failed" } : state;
  }
}

/** One downloaded book, as the Downloads screen lists it. */
export type DownloadedBookGroup = {
  book: DownloadEntry["book"];
  /** Oldest first. */
  chapters: DownloadEntry[];
  bytes: number;
};

/** The size of one entry's files on disk. */
export function entryBytes(entry: DownloadEntry): number {
  return (entry.audio?.bytes ?? 0) + (entry.text?.bytes ?? 0);
}

/** The index as books, most recently verified book first, chapters in reading order. */
export function groupByBook(entries: readonly DownloadEntry[]): DownloadedBookGroup[] {
  const groups = new Map<string, DownloadedBookGroup & { latest: number }>();
  for (const entry of entries) {
    const group = groups.get(entry.book.id) ?? { book: entry.book, chapters: [], bytes: 0, latest: 0 };
    group.chapters.push(entry);
    group.bytes += entryBytes(entry);
    group.latest = Math.max(group.latest, entry.verifiedAt);
    groups.set(entry.book.id, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.latest - a.latest || a.book.title.localeCompare(b.book.title))
    .map(({ latest: _latest, ...group }) => ({
      ...group,
      chapters: [...group.chapters].sort((a, b) => a.number - b.number),
    }));
}

/** A book with reader downloads still to do, for the Downloads screen. */
export type DownloadingBook = {
  book: DownloadedBook;
  /** Chapters finished in this run, and the run's size: M9's "12 of 41". */
  done: number;
  total: number;
  /** The chapter under way, from 0 to 1, paused included; null when none has started. */
  progress: number | null;
};

/**
 * Every book the queue is still downloading for the reader, in the queue's
 * order. A run counts as M9's `downloadAllState()` counts it: every reader
 * download of the book that wasn't cancelled. Refreshes never show.
 */
export function downloadingBooks(queue: readonly QueueItem[]): DownloadingBook[] {
  const runs = new Map<string, QueueItem[]>();
  for (const item of queue) {
    if (item.kind !== "download" || item.status === "cancelled") continue;
    runs.set(item.bookId, [...(runs.get(item.bookId) ?? []), item]);
  }
  return [...runs.values()].flatMap((run) => {
    if (!run.some((item) => item.status === "queued" || item.status === "downloading")) return [];
    const current =
      run.find((item) => item.status === "downloading") ??
      run.find((item) => item.status === "queued" && item.progress > 0);
    return [
      {
        book: run[0].book,
        done: run.filter((item) => item.status === "done").length,
        total: run.length,
        progress: current?.progress ?? null,
      },
    ];
  });
}
