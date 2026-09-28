// M9's rows — prompt 20. Chapter metadata, the lock inputs and where the
// reader left off, in; what each row shows, says and opens, out.
// No React, no hooks, no JSX — AGENTS.md § lib/.
import { formatDuration, formatDurationSpoken } from "@/lib/format";
import type { ParitySourceMode } from "@/store/parity-store";
import type { ChapterListItemRow } from "@/types/catalog";
import { chapterStateFor, type ChapterLockInputs, type ChapterState } from "@/types/states";

export type ChapterSortOrder = "oldest" | "newest";

/** The one thing in a row's right-hand slot. "listen" is the teal headphone, a button of its own. */
export type ChapterRowTrailing = "reading" | "downloaded" | "locked" | "listen" | null;

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
  trailing: ChapterRowTrailing;
  /** Null opens nothing: a chapter with neither text nor narration. */
  opens: ChapterRowOpens | null;
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

function trailingFor(state: ChapterState, hasAudio: boolean): ChapterRowTrailing {
  switch (state.kind) {
    case "locked":
    case "reading":
    case "downloaded":
      return state.kind;
    case "unlocked":
      return hasAudio ? "listen" : null;
  }
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
): ChapterListRow[] {
  return chapters.flatMap((row) => {
    if (row.id === null || row.number === null) return [];
    const { id, number } = row;
    const hasText = row.has_text === true;
    const hasAudio = row.has_audio === true;
    const title = row.title?.trim() || null;

    const state = chapterStateFor({ id, number, access: row.access }, inputs, {
      isCurrentlyReading: id === readingChapterId,
      // TODO(downloads): true once this chapter is stored on the device.
      isDownloaded: false,
    });
    const detail = detailLines(hasText, hasAudio, row.audio_duration_seconds);
    const mode: ParitySourceMode | null = hasText ? "text" : hasAudio ? "audio" : null;

    return [
      {
        id,
        number,
        title: title ? `Ch. ${number}: ${title}` : `Chapter ${number}`,
        detail: detail.shown,
        accessibilityLabel: `${[
          title ? `Chapter ${number}: ${title}` : `Chapter ${number}`,
          detail.spoken,
          STATE_WORDS[state.kind],
        ].join(". ")}.`,
        state,
        trailing: trailingFor(state, hasAudio),
        opens:
          mode === null
            ? null
            : state.kind === "locked"
              ? { kind: "paywall", mode }
              : { kind: mode === "text" ? "reader" : "player" },
      },
    ];
  });
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
