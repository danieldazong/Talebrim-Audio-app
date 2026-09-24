// Text ↔ audio mapping for read/listen parity. Pure: no React, no hooks, no
// JSX (AGENTS.md § lib/).
//
// The data has no alignment: no per-paragraph timings. Per chapter it has the
// text length and the narration's measured duration, so a position maps
// proportionally within its chapter. Positions are chapter-scoped, so the
// error never exceeds one chapter. Without a duration there is no basis at
// all, and the mapping falls back to the chapter's start — and says so, so
// the handoff can tell the user rather than pretend.
import { blockIndexAtOffset, type ReaderBlock } from "@/lib/chapter-text";
import type { ChapterParityPosition } from "@/store/parity-store";

/** How far before the mapped point playback starts, so the lead-in is heard rather than missed. */
export const AUDIO_LEAD_IN_MS = 3_000;

/** A mapped position, and whether it is a proportional estimate or the chapter-start fallback. */
export type MappedPosition = { value: number; basis: "estimate" | "chapter-start" };

/** What a chapter offers to map against. */
export type ChapterTimeline = {
  /** `script_text.length`, in the same JavaScript string units as the offsets. */
  textLength: number;
  /** The parsed chapter, for snapping to a paragraph's start. */
  blocks: readonly ReaderBlock[];
  /** `audio_duration_seconds`; null when it was never measured. */
  durationSeconds: number | null;
};

const CHAPTER_START: MappedPosition = { value: 0, basis: "chapter-start" };

function durationMsOf(durationSeconds: number | null): number | null {
  if (durationSeconds === null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  return durationSeconds * 1000;
}

function isPosition(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

/**
 * Where playback starts for a character offset: the same fraction of the
 * narration, less the lead-in. An offset past the end of the text clamps to
 * the end.
 */
export function textOffsetToAudioMs(offset: number, timeline: ChapterTimeline): MappedPosition {
  const durationMs = durationMsOf(timeline.durationSeconds);
  if (durationMs === null || timeline.textLength <= 0 || !isPosition(offset)) return CHAPTER_START;

  const fraction = Math.min(1, offset / timeline.textLength);
  return {
    value: Math.max(0, Math.round(fraction * durationMs) - AUDIO_LEAD_IN_MS),
    basis: "estimate",
  };
}

/**
 * The paragraph a playback position falls in, as its starting character
 * offset: the same fraction of the text, snapped back so the reader starts at
 * the paragraph's beginning. A position past the end of the narration clamps
 * to the last paragraph.
 */
export function audioMsToTextOffset(ms: number, timeline: ChapterTimeline): MappedPosition {
  const durationMs = durationMsOf(timeline.durationSeconds);
  const { blocks, textLength } = timeline;
  if (durationMs === null || textLength <= 0 || blocks.length === 0 || !isPosition(ms)) {
    return CHAPTER_START;
  }

  const offset = Math.floor(Math.min(1, ms / durationMs) * textLength);
  return { value: blocks[blockIndexAtOffset(blocks, offset)].start, basis: "estimate" };
}

/**
 * Where the reader opens for a position: from the side that wrote last. Its
 * own text offset when reading wrote last; the audio position mapped when
 * listening did, because that is the newer place.
 */
export function textRestoreOffset(position: ChapterParityPosition, timeline: ChapterTimeline): number | null {
  if (position.lastWrittenBy === "audio" && position.audioMs !== null) {
    return audioMsToTextOffset(position.audioMs, timeline).value;
  }
  return position.textOffset;
}
