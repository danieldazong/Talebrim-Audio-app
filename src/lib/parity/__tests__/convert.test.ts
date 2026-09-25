/// <reference types="jest" />

import { parseChapterText } from "@/lib/chapter-text";
import {
  AUDIO_LEAD_IN_MS,
  audioMsToTextOffset,
  textOffsetToAudioMs,
  textRestoreOffset,
  type ChapterTimeline,
} from "@/lib/parity/convert";
import type { ChapterParityPosition } from "@/store/parity-store";

// Four paragraphs of 97 characters, starting at 0, 99, 198 and 297, padded
// to 400 characters in all.
const paragraph = (letter: string) => letter.repeat(97);
const text = [paragraph("a"), paragraph("b"), paragraph("c"), paragraph("d")].join("\n\n").padEnd(400, " ");
const blocks = parseChapterText(text);
const starts = blocks.map((block) => block.start);

/** 100 seconds of narration over 400 characters: 250 ms per character. */
const timeline: ChapterTimeline = { textLength: text.length, blocks, durationSeconds: 100 };

function position(overrides: Partial<ChapterParityPosition>): ChapterParityPosition {
  return {
    chapterId: "chapter",
    textOffset: null,
    audioMs: null,
    lastWrittenBy: "text",
    syncedAt: null,
    dirty: false,
    ...overrides,
  };
}

describe("textOffsetToAudioMs", () => {
  it("maps proportionally, less the lead-in", () => {
    expect(textOffsetToAudioMs(200, timeline)).toEqual({ value: 50_000 - AUDIO_LEAD_IN_MS, basis: "estimate" });
  });

  it("never rewinds before the start", () => {
    expect(textOffsetToAudioMs(0, timeline)).toEqual({ value: 0, basis: "estimate" });
  });

  it("clamps an offset past the end of the text", () => {
    expect(textOffsetToAudioMs(10_000, timeline)).toEqual({ value: 100_000 - AUDIO_LEAD_IN_MS, basis: "estimate" });
  });

  it.each([
    ["no measured duration", { ...timeline, durationSeconds: null }, 200],
    ["a zero duration", { ...timeline, durationSeconds: 0 }, 200],
    ["an empty text", { ...timeline, textLength: 0 }, 0],
    ["a negative offset", timeline, -1],
    ["a non-number", timeline, Number.NaN],
  ])("falls back to the chapter start with %s", (_case, input, offset) => {
    expect(textOffsetToAudioMs(offset, input)).toEqual({ value: 0, basis: "chapter-start" });
  });
});

describe("audioMsToTextOffset", () => {
  it("maps proportionally and snaps to the start of the paragraph", () => {
    // 60 s of 100 is character 240, inside the third paragraph.
    expect(audioMsToTextOffset(60_000, timeline)).toEqual({ value: starts[2], basis: "estimate" });
  });

  it("opens the first paragraph at the very start", () => {
    expect(audioMsToTextOffset(0, timeline)).toEqual({ value: starts[0], basis: "estimate" });
  });

  it("clamps a position past the end of the narration to the last paragraph", () => {
    expect(audioMsToTextOffset(500_000, timeline)).toEqual({ value: starts[3], basis: "estimate" });
  });

  it.each([
    ["no measured duration", { ...timeline, durationSeconds: null }, 60_000],
    ["no paragraphs", { ...timeline, blocks: [] }, 60_000],
    ["an empty text", { ...timeline, textLength: 0 }, 60_000],
    ["a negative position", timeline, -5],
  ])("falls back to the chapter start with %s", (_case, input, ms) => {
    expect(audioMsToTextOffset(ms, input)).toEqual({ value: 0, basis: "chapter-start" });
  });
});

describe("textRestoreOffset", () => {
  it("opens at the text offset when reading wrote last, unmapped", () => {
    expect(textRestoreOffset(position({ textOffset: 123, audioMs: 90_000, lastWrittenBy: "text" }), timeline)).toEqual({
      value: 123,
      mapped: null,
    });
  });

  it("maps the audio side when listening wrote last, ignoring an older text offset", () => {
    const restored = textRestoreOffset(position({ textOffset: 5, audioMs: 60_000, lastWrittenBy: "audio" }), timeline);
    expect(restored).toEqual({ value: starts[2], mapped: "estimate" });
  });

  it("opens at the chapter start when listening wrote last and there is no duration, and says so", () => {
    const restored = textRestoreOffset(
      position({ audioMs: 60_000, lastWrittenBy: "audio" }),
      { ...timeline, durationSeconds: null },
    );
    expect(restored).toEqual({ value: 0, mapped: "chapter-start" });
  });

  it("has nothing to restore from an unknown text side", () => {
    expect(textRestoreOffset(position({ textOffset: null, lastWrittenBy: "text" }), timeline)).toBeNull();
  });
});
