// M9's rows — prompt 20. Chapter metadata, the lock inputs, where the reader
// left off and what is downloaded (prompt 24), in; what each row shows, says
// and opens, out.
// No React, no hooks, no JSX — AGENTS.md § lib/.
import { PLAN_NAME } from "@/constants/plan";
import type { DownloadFailure, QueueItem } from "@/lib/downloads/queue";
import { formatDuration, formatDurationSpoken } from "@/lib/format";
import type { ParitySourceMode } from "@/store/parity-store";
import type { ChapterListItemRow } from "@/types/catalog";
import { chapterStateFor, openedByPlan, type ChapterLockInputs, type ChapterState } from "@/types/states";

export type ChapterSortOrder = "oldest" | "newest";

/**
 * The one thing in a row's right-hand slot. "listen" is the teal headphone
 * and "downloaded" the teal disc, each a button of its own beside the row.
 * "queued", "progress" and "failed" are a chapter in the download queue, in
 * words, in `muted`.
 */
export type ChapterRowTrailing =
  | "reading"
  | "downloaded"
  | "locked"
  | "listen"
  | "queued"
  | "progress"
  | "failed"
  | null;

/** Where a row's chapter is with downloads. */
export type RowDownload =
  | { kind: "none" }
  | { kind: "downloaded" }
  | { kind: "queued" }
  | { kind: "downloading"; percent: number }
  | { kind: "failed"; failure: DownloadFailure };

/** What M9 knows about downloads: the index's chapters, and the queue's reader downloads. */
export type ChapterListDownloads = {
  downloaded: ReadonlySet<string>;
  queue: readonly QueueItem[];
};

const NO_DOWNLOADS: ChapterListDownloads = { downloaded: new Set(), queue: [] };

/**
 * What a tap on a row opens. A locked chapter opens M5a, in the mode the tap
 * was going to: never the reader or the player, which would be a paywall
 * bypass.
 */
export type ChapterRowOpens =
  | { kind: "reader" }
  | { kind: "player" }
  | { kind: "paywall"; mode: ParitySourceMode };

export type ChapterListRow = {
  id: string;
  number: number;
  /** "Ch. 17: A Whispered Oath", or "Chapter 17" when untitled. */
  title: string;
  /** The audio line, as M4 writes it, or what the chapter has instead. */
  detail: string;
  /** The row as one screen-reader element: its title, its audio and its state, in words. */
  accessibilityLabel: string;
  state: ChapterState;
  /**
   * Locked in the dashboard and open to this reader only through the
   * subscription (`openedByPlan()`): the detail line starts "Unlimited".
   */
  byPlan: boolean;
  trailing: ChapterRowTrailing;
  /** Null opens nothing: a chapter with neither text nor narration. */
  opens: ChapterRowOpens | null;
  /** The chapter has narration: the row sheet offers Listen. */
  hasAudio: boolean;
  download: RowDownload;
  /**
   * The row has a sheet (long-press, the disc, or a screen reader's actions):
   * a chapter the reader can open, with text or narration. Never a Locked one.
   */
  hasSheet: boolean;
};

const STATE_WORDS: Record<ChapterState["kind"], string> = {
  reading: "Reading now",
  downloaded: "Downloaded",
  unlocked: "Unlocked",
  locked: "Locked",
};

/** A measured duration. Null or 0 is unknown, never "0:00" (AGENTS.md Data Contract). */
function measured(seconds: number | null): number | null {
  return seconds !== null && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function detailLines(hasText: boolean, hasAudio: boolean, seconds: number | null) {
  if (hasAudio) {
    const duration = measured(seconds);
    return duration === null
      ? { shown: "Audio · duration unknown", spoken: "Audio, duration unknown" }
      : { shown: `${formatDuration(duration)} audio`, spoken: `${formatDurationSpoken(duration)} of audio` };
  }
  const line = hasText ? "Text only" : "No text or narration yet";
  return { shown: line, spoken: line };
}

/**
 * A chapter in the queue shows where it is in the slot, over Reading Now
 * too: it is brief, and the Reading row keeps its ember edge. Otherwise the
 * state's own item.
 */
function trailingFor(state: ChapterState, hasAudio: boolean, download: RowDownload): ChapterRowTrailing {
  if (state.kind !== "locked") {
    if (download.kind === "queued") return "queued";
    if (download.kind === "downloading") return "progress";
    if (download.kind === "failed") return "failed";
  }
  switch (state.kind) {
    case "locked":
    case "reading":
    case "downloaded":
      return state.kind;
    case "unlocked":
      return hasAudio ? "listen" : null;
  }
}

/** A queued chapter's state in words, before the row's state. */
function downloadWords(download: RowDownload): string | null {
  switch (download.kind) {
    case "queued":
      return "Queued for download";
    case "downloading":
      return `Downloading, ${download.percent}%`;
    case "failed":
      return "Download failed";
    default:
      return null;
  }
}

function rowDownload(chapterId: string, downloads: ChapterListDownloads): RowDownload {
  const item = downloads.queue.find((candidate) => candidate.chapterId === chapterId && candidate.kind === "download");
  // Paused with its bytes kept (the app left, or the network went): it
  // carries on from there, so it keeps its percentage.
  if (item?.status === "queued") {
    return item.progress > 0 ? { kind: "downloading", percent: Math.floor(item.progress * 100) } : { kind: "queued" };
  }
  if (item?.status === "downloading") return { kind: "downloading", percent: Math.floor(item.progress * 100) };
  if (downloads.downloaded.has(chapterId)) return { kind: "downloaded" };
  if (item?.status === "failed" && item.failure !== null) return { kind: "failed", failure: item.failure };
  return { kind: "none" };
}

/**
 * One row per chapter, in the order given: `chapterListByBookOptions()`
 * returns them oldest first. Rows without an id or a number are the view's
 * nullable typing and are dropped, as on M4.
 *
 * Every state goes through `chapterStateFor()`, the one lock rule, the
 * subscription included: Locked beats Reading Now, and a null `access` is
 * Locked.
 */
export function buildChapterRows(
  chapters: readonly ChapterListItemRow[],
  inputs: ChapterLockInputs,
  readingChapterId: string | null,
  downloads: ChapterListDownloads = NO_DOWNLOADS,
): ChapterListRow[] {
  return chapters.flatMap((row) => {
    if (row.id === null || row.number === null) return [];
    const { id, number } = row;
    const hasText = row.has_text === true;
    const hasAudio = row.has_audio === true;
    const title = row.title?.trim() || null;

    const download = rowDownload(id, downloads);
    const state = chapterStateFor({ id, number, access: row.access }, inputs, {
      isCurrentlyReading: id === readingChapterId,
      isDownloaded: download.kind === "downloaded",
    });
    const detail = detailLines(hasText, hasAudio, row.audio_duration_seconds);
    const mode: ParitySourceMode | null = hasText ? "text" : hasAudio ? "audio" : null;
    const locked = state.kind === "locked";
    const byPlan = !locked && openedByPlan({ id, number, access: row.access }, inputs);

    return [
      {
        id,
        number,
        title: title ? `Ch. ${number}: ${title}` : `Chapter ${number}`,
        detail: detail.shown,
        accessibilityLabel: `${[
          title ? `Chapter ${number}: ${title}` : `Chapter ${number}`,
          detail.spoken,
          locked ? null : downloadWords(download),
          STATE_WORDS[state.kind],
          byPlan ? `With ${PLAN_NAME}` : null,
        ]
          .filter((part) => part !== null)
          .join(". ")}.`,
        state,
        byPlan,
        trailing: trailingFor(state, hasAudio, download),
        opens:
          mode === null
            ? null
            : locked
              ? { kind: "paywall", mode }
              : { kind: mode === "text" ? "reader" : "player" },
        hasAudio,
        download,
        hasSheet: !locked && mode !== null,
      },
    ];
  });
}

/** What a row's sheet, and a screen reader's actions on the row, offer. */
export type ChapterRowAction = "listen" | "download" | "cancel" | "remove";

/**
 * A row's sheet, in order: Listen when the chapter has narration (the
 * Downloaded disc takes the headphone's place), then the one download action
 * its state allows. None for a row without a sheet (Locked, or nothing in it).
 */
export function chapterRowActions(row: ChapterListRow): ChapterRowAction[] {
  if (!row.hasSheet) return [];
  const actions: ChapterRowAction[] = row.hasAudio ? ["listen"] : [];
  switch (row.download.kind) {
    case "downloaded":
      actions.push("remove");
      break;
    case "queued":
    case "downloading":
      actions.push("cancel");
      break;
    case "none":
    case "failed":
      actions.push("download");
      break;
  }
  return actions;
}

/** What M9's "Download all" slot shows. */
export type DownloadAllState =
  /** Nothing in this book can be downloaded by this reader: no slot. */
  | { kind: "hidden" }
  /** `count` chapters the reader can open aren't downloaded yet. */
  | { kind: "ready"; count: number }
  /** A run is going: "12 of 41", and Cancel. */
  | { kind: "running"; done: number; total: number }
  /** Every chapter the reader can open is downloaded: "All downloaded", disabled. */
  | { kind: "done" };

/**
 * The slot's state from M9's rows and this book's reader downloads in the
 * queue. A run counts its chapters until the book has nothing left waiting:
 * done ones, those still to come, and failed ones.
 */
export function downloadAllState(rows: readonly ChapterListRow[], bookQueue: readonly QueueItem[]): DownloadAllState {
  const run = bookQueue.filter((item) => item.kind === "download" && item.status !== "cancelled");
  if (run.some((item) => item.status === "queued" || item.status === "downloading")) {
    return { kind: "running", done: run.filter((item) => item.status === "done").length, total: run.length };
  }
  const withSheet = rows.filter((row) => row.hasSheet);
  if (withSheet.length === 0) return { kind: "hidden" };
  const count = withSheet.filter((row) => row.download.kind === "none" || row.download.kind === "failed").length;
  return count > 0 ? { kind: "ready", count } : { kind: "done" };
}

const FAILURE_ORDER: readonly DownloadFailure[] = ["disk_full", "refused", "network", "other"];

/**
 * The line under M9's sort bar after chapters failed, for the most telling
 * failure among them; null when none did. Every failure is said in words.
 */
export function downloadFailureMessage(bookQueue: readonly QueueItem[]): string | null {
  const failed = bookQueue.filter((item) => item.kind === "download" && item.status === "failed");
  if (failed.length === 0) return null;
  const kinds = new Set(failed.map((item) => item.failure));
  const failure = FAILURE_ORDER.find((kind) => kinds.has(kind)) ?? "other";
  const count = failed.length === 1 ? "A chapter" : `${failed.length} chapters`;
  switch (failure) {
    case "disk_full":
      return "Not enough free space on this phone. Free some space, then try again.";
    case "refused":
      return `${count} couldn't be downloaded on this account.`;
    case "network":
      return `${count} didn't download. Check your connection and try again.`;
    case "other":
      return `${count} didn't download. Try again.`;
  }
}

/** The header's "{M} unlocked": every row that isn't Locked. */
export function unlockedCount(rows: readonly ChapterListRow[]): number {
  return rows.filter((row) => row.state.kind !== "locked").length;
}

/** Oldest first is the order the rows came in; newest first reverses it, with no re-query. */
export function sortChapterRows(rows: readonly ChapterListRow[], order: ChapterSortOrder): ChapterListRow[] {
  return order === "oldest" ? [...rows] : [...rows].reverse();
}

/**
 * Where M9 opens: scrolled so the Reading Now row is at the top, or as near
 * as the list can scroll. A list starts drawing at `initialScrollIndex` even
 * when it cannot scroll that far, leaving the rows above as a blank gap that
 * never fills, so the index is clamped to the last row that can reach the
 * top. A list that fits on the screen opens at the top. Undefined means the
 * top. Every row is `rowHeight` tall and the list has no padding, so the
 * content is exactly `rowCount * rowHeight`.
 */
export function openingRowIndex(
  readingIndex: number,
  rowCount: number,
  rowHeight: number,
  viewportHeight: number,
): number | undefined {
  const lastTopIndex = Math.floor((rowCount * rowHeight - viewportHeight) / rowHeight);
  const index = Math.min(readingIndex, lastTopIndex);
  return index > 0 ? index : undefined;
}
