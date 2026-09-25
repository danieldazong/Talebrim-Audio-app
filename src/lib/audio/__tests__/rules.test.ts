/// <reference types="jest" />

import {
  REPLAY_WITHIN_MS,
  audioRestoreMs,
  chooseDuration,
  newerPosition,
  playbackStatusOf,
  sleepSecondsLeft,
  sleepTimerDue,
  type AudioTimeline,
  type PlayerFlags,
} from "@/lib/audio/rules";
import { AUDIO_LEAD_IN_MS } from "@/lib/parity/convert";
import type { ReadingPosition } from "@/lib/queries/reading-position";
import type { ChapterParityPosition } from "@/store/parity-store";

const EARLIER = "2026-09-24T10:00:00.000001+00:00";
const LATER = "2026-09-24T10:00:05.000001+00:00";

function flags(overrides: Partial<PlayerFlags> = {}): PlayerFlags {
  return { isLoaded: true, isBuffering: false, playing: false, ...overrides };
}

function position(overrides: Partial<ChapterParityPosition> = {}): ChapterParityPosition {
  return {
    chapterId: "chapter",
    textOffset: null,
    audioMs: 60_000,
    lastWrittenBy: "audio",
    syncedAt: EARLIER,
    dirty: false,
    ...overrides,
  };
}

function serverRow(overrides: Partial<ReadingPosition> = {}): ReadingPosition {
  return {
    id: "row",
    chapter_id: "chapter",
    book_id: "book",
    audio_ms: 120_000,
    text_offset: null,
    last_mode: "audio",
    updated_at: LATER,
    ...overrides,
  };
}

describe("playbackStatusOf", () => {
  it("buffers while the chapter loads, whatever the player last said", () => {
    expect(playbackStatusOf("loading", null)).toBe("buffering");
    expect(playbackStatusOf("loading", flags({ playing: true }))).toBe("buffering");
    expect(playbackStatusOf("loading", flags({ playing: false }))).toBe("buffering");
  });

  it("buffers while the player rebuffers", () => {
    expect(playbackStatusOf("ready", flags({ isLoaded: false, isBuffering: true, playing: true }))).toBe("buffering");
  });

  it("plays while the player plays, and is paused otherwise", () => {
    expect(playbackStatusOf("ready", flags({ playing: true }))).toBe("playing");
    expect(playbackStatusOf("ready", flags({ playing: false }))).toBe("paused");
  });

  it("is paused when the load failed or waits for a connection", () => {
    expect(playbackStatusOf("failed", flags({ playing: true }))).toBe("paused");
    expect(playbackStatusOf("offline", null)).toBe("paused");
  });
});

describe("audioRestoreMs", () => {
  /** Ten minutes of narration over 10,000 characters: 60 ms per character. */
  const TIMELINE: AudioTimeline = { durationSeconds: 600, textLength: 10_000 };
  const audioOnly = (durationSeconds: number | null): AudioTimeline => ({ durationSeconds, textLength: null });

  it("starts from the beginning with no position", () => {
    expect(audioRestoreMs(undefined, TIMELINE)).toEqual({ value: 0, mapped: null });
    expect(audioRestoreMs(position({ audioMs: null }), TIMELINE)).toEqual({ value: 0, mapped: null });
  });

  it("resumes at the audio position when listening wrote last, unmapped", () => {
    expect(audioRestoreMs(position({ audioMs: 90_500, textOffset: 9_000 }), TIMELINE)).toEqual({
      value: 90_500,
      mapped: null,
    });
  });

  it("starts from the beginning within five seconds of the end, or past it", () => {
    const at = (audioMs: number) => audioRestoreMs(position({ audioMs }), audioOnly(600)).value;
    expect(at(600_000 - REPLAY_WITHIN_MS)).toBe(0);
    expect(at(598_000)).toBe(0);
    expect(at(700_000)).toBe(0);
    expect(at(600_000 - REPLAY_WITHIN_MS - 1)).toBe(594_999);
  });

  it("keeps the position when the duration is unknown, with no end to measure against", () => {
    expect(audioRestoreMs(position({ audioMs: 598_000 }), audioOnly(null)).value).toBe(598_000);
  });

  describe("when reading wrote last", () => {
    const reading = (overrides: Partial<ChapterParityPosition> = {}) =>
      position({ lastWrittenBy: "text", textOffset: 5_000, audioMs: 60_000, ...overrides });

    it("maps the text offset into the narration, less the lead-in, over an older audio side", () => {
      expect(audioRestoreMs(reading(), TIMELINE)).toEqual({ value: 300_000 - AUDIO_LEAD_IN_MS, mapped: "estimate" });
    });

    it("starts the chapter with no duration to map with, and says so", () => {
      expect(audioRestoreMs(reading(), { durationSeconds: null, textLength: 10_000 })).toEqual({
        value: 0,
        mapped: "chapter-start",
      });
    });

    it("falls back to the audio side without the text length, else the chapter start", () => {
      expect(audioRestoreMs(reading(), audioOnly(600))).toEqual({ value: 60_000, mapped: null });
      expect(audioRestoreMs(reading({ audioMs: null }), audioOnly(600))).toEqual({ value: 0, mapped: "chapter-start" });
    });

    it("starts the chapter again when the mapped place is within five seconds of the end", () => {
      // The end of the text maps to the last three seconds: a finished chapter replays.
      expect(audioRestoreMs(reading({ textOffset: 10_000 }), TIMELINE)).toEqual({ value: 0, mapped: "chapter-start" });
      // The last paragraph, well before the end, still maps.
      expect(audioRestoreMs(reading({ textOffset: 9_500 }), TIMELINE)).toEqual({
        value: 570_000 - AUDIO_LEAD_IN_MS,
        mapped: "estimate",
      });
    });
  });

  it("takes the newer of the session copy and the server row", () => {
    // Clean session, older than the server row: another device wrote since.
    expect(audioRestoreMs(newerPosition(position({ audioMs: 60_000 }), serverRow()), TIMELINE).value).toBe(120_000);
    // Dirty session: it is pushed next, so it wins.
    expect(audioRestoreMs(newerPosition(position({ dirty: true }), serverRow()), TIMELINE).value).toBe(60_000);
    // Server only, and reading wrote it: mapped.
    const textRow = serverRow({ audio_ms: null, text_offset: 1_000, last_mode: "text" });
    expect(audioRestoreMs(newerPosition(undefined, textRow), TIMELINE)).toEqual({
      value: 60_000 - AUDIO_LEAD_IN_MS,
      mapped: "estimate",
    });
  });
});

describe("sleep timer", () => {
  const ENDS_AT = 1_000_000;

  it("is due at its end time and after it, never before", () => {
    expect(sleepTimerDue(ENDS_AT, ENDS_AT - 1)).toBe(false);
    expect(sleepTimerDue(ENDS_AT, ENDS_AT)).toBe(true);
    expect(sleepTimerDue(ENDS_AT, ENDS_AT + 60_000)).toBe(true);
  });

  it("is never due when off", () => {
    expect(sleepTimerDue(null, ENDS_AT)).toBe(false);
  });

  it("counts whole seconds left, never below zero", () => {
    expect(sleepSecondsLeft(ENDS_AT, ENDS_AT - 1_500)).toBe(2);
    expect(sleepSecondsLeft(ENDS_AT, ENDS_AT)).toBe(0);
    expect(sleepSecondsLeft(ENDS_AT, ENDS_AT + 5_000)).toBe(0);
  });
});

describe("chooseDuration", () => {
  it("prefers the catalog's measured duration", () => {
    expect(chooseDuration(600, 598.4)).toBe(600);
  });

  it("falls back to the player's once it is finite and above zero", () => {
    expect(chooseDuration(null, 598.4)).toBe(598.4);
    expect(chooseDuration(0, 598.4)).toBe(598.4);
  });

  it("is unknown when neither is usable", () => {
    expect(chooseDuration(null, 0)).toBeNull();
    expect(chooseDuration(null, Number.NaN)).toBeNull();
    expect(chooseDuration(null, Number.POSITIVE_INFINITY)).toBeNull();
    expect(chooseDuration(null, undefined)).toBeNull();
    expect(chooseDuration(0, null)).toBeNull();
  });
});
