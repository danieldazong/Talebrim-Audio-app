/// <reference types="jest" />

import { fromServerRow, reconcile, serverTimeMicros } from "@/lib/parity/reconcile";
import type { ReadingPosition } from "@/lib/queries/reading-position";
import type { ChapterParityPosition } from "@/store/parity-store";

const EARLIER = "2026-09-24T10:00:00.123456+00:00";
const LATER = "2026-09-24T10:00:00.123457+00:00";

function serverRow(updatedAt: string, overrides: Partial<ReadingPosition> = {}): ReadingPosition {
  return {
    id: "row",
    chapter_id: "chapter",
    book_id: "book",
    audio_ms: null,
    text_offset: 300,
    last_mode: "text",
    updated_at: updatedAt,
    ...overrides,
  };
}

function session(overrides: Partial<ChapterParityPosition>): ChapterParityPosition {
  return {
    chapterId: "chapter",
    textOffset: 100,
    audioMs: null,
    lastWrittenBy: "text",
    syncedAt: EARLIER,
    dirty: false,
    ...overrides,
  };
}

describe("reconcile", () => {
  it("keeps the session copy when the server has no row", () => {
    expect(reconcile(session({}), null)).toBe("keep");
    expect(reconcile(undefined, null)).toBe("keep");
    expect(reconcile(session({}), undefined)).toBe("keep");
  });

  it("adopts the server row when the session has none", () => {
    expect(reconcile(undefined, serverRow(EARLIER))).toBe("adopt");
  });

  it("keeps a dirty session copy, even against a newer server row", () => {
    expect(reconcile(session({ dirty: true }), serverRow(LATER))).toBe("keep");
  });

  it("adopts a server row written after the session last synced", () => {
    expect(reconcile(session({ syncedAt: EARLIER }), serverRow(LATER))).toBe("adopt");
  });

  it("keeps the session copy against the row it last synced", () => {
    expect(reconcile(session({ syncedAt: LATER }), serverRow(LATER))).toBe("keep");
  });

  it("keeps the session copy against an older server row", () => {
    expect(reconcile(session({ syncedAt: LATER }), serverRow(EARLIER))).toBe("keep");
  });

  it("adopts the server row when a clean session copy never synced", () => {
    expect(reconcile(session({ syncedAt: null }), serverRow(EARLIER))).toBe("adopt");
  });
});

describe("serverTimeMicros", () => {
  it("orders by microseconds, which Date.parse would lose", () => {
    expect(serverTimeMicros(LATER) - serverTimeMicros(EARLIER)).toBe(1);
  });

  it("reads Z, offsets and missing fractions as the same instant", () => {
    const utc = serverTimeMicros("2026-09-24T10:00:00+00:00");
    expect(serverTimeMicros("2026-09-24T10:00:00Z")).toBe(utc);
    expect(serverTimeMicros("2026-09-24T15:30:00+05:30")).toBe(utc);
    expect(serverTimeMicros("2026-09-24T10:00:00.5+00:00")).toBe(utc + 500_000);
  });

  it("returns NaN for anything else, which never wins a comparison", () => {
    expect(serverTimeMicros("yesterday")).toBeNaN();
    expect(reconcile(session({ syncedAt: EARLIER }), serverRow("yesterday"))).toBe("keep");
  });
});

describe("fromServerRow", () => {
  it("holds both sides, clean, synced at the row's own time", () => {
    expect(fromServerRow(serverRow(LATER, { audio_ms: 9_000, last_mode: "audio" }))).toEqual({
      chapterId: "chapter",
      textOffset: 300,
      audioMs: 9_000,
      lastWrittenBy: "audio",
      syncedAt: LATER,
      dirty: false,
    });
  });
});
