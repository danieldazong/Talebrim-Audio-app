/// <reference types="jest" />

import { buildChapterRows, sortChapterRows, unlockedCount } from "@/lib/chapter-list";
import type { ChapterListItemRow } from "@/types/catalog";
import type { ChapterLockInputs } from "@/types/states";

function chapter(number: number, overrides: Partial<ChapterListItemRow> = {}): ChapterListItemRow {
  return {
    id: `chapter-${number}`,
    number,
    title: `Title ${number}`,
    access: "locked",
    has_text: true,
    has_audio: false,
    audio_duration_seconds: null,
    ...overrides,
  };
}

function inputs(freeChaptersAtStart = 3, unlocked: string[] = []): ChapterLockInputs {
  return { freeChaptersAtStart, unlockedChapterIds: new Set(unlocked) };
}

/** Chapters 1–8, all `locked` by access, so only the setting and the unlocks free them. */
const book = [1, 2, 3, 4, 5, 6, 7, 8].map((number) => chapter(number));

function kinds(rows: ReturnType<typeof buildChapterRows>) {
  return rows.map((row) => row.state.kind);
}

describe("buildChapterRows", () => {
  it("gives each row exactly one state and one right-hand item", () => {
    const rows = buildChapterRows(
      [
        chapter(1, { has_audio: true, audio_duration_seconds: 300 }),
        chapter(2),
        chapter(3, { has_audio: true, audio_duration_seconds: 300 }),
        chapter(4),
      ],
      inputs(3),
      "chapter-2",
    );

    expect(kinds(rows)).toEqual(["unlocked", "reading", "unlocked", "locked"]);
    expect(rows.map((row) => row.trailing)).toEqual(["listen", "reading", "listen", "locked"]);
    // One state in words per label, never two.
    for (const row of rows) {
      const said = ["Reading now", "Downloaded", "Unlocked", "Locked"].filter((word) =>
        row.accessibilityLabel.endsWith(`${word}.`),
      );
      expect(said).toHaveLength(1);
    }
  });

  it("never marks a row Downloaded yet", () => {
    expect(kinds(buildChapterRows(book, inputs(8), null))).not.toContain("downloaded");
  });

  it("lets Locked beat Reading Now", () => {
    const rows = buildChapterRows(book, inputs(3), "chapter-6");
    expect(rows[5].state.kind).toBe("locked");
    expect(kinds(rows)).not.toContain("reading");
  });

  it("treats a null access as Locked, even within the free chapters", () => {
    const rows = buildChapterRows([chapter(1, { access: null })], inputs(3), "chapter-1");
    expect(rows[0].state.kind).toBe("locked");
  });

  it("frees chapters by position under the setting it is given", () => {
    expect(kinds(buildChapterRows(book, inputs(3), null)).filter((kind) => kind !== "locked")).toHaveLength(3);
    expect(kinds(buildChapterRows(book, inputs(5), null))).toEqual([
      "unlocked",
      "unlocked",
      "unlocked",
      "unlocked",
      "unlocked",
      "locked",
      "locked",
      "locked",
    ]);
  });

  it("opens a chapter that is free by access, or unlocked by the reader", () => {
    const rows = buildChapterRows(
      [chapter(7, { access: "free" }), chapter(8)],
      inputs(3, ["chapter-8"]),
      null,
    );
    expect(kinds(rows)).toEqual(["unlocked", "unlocked"]);
  });

  it("writes the detail line for measured, unmeasured, text-only and empty chapters", () => {
    const rows = buildChapterRows(
      [
        chapter(1, { has_audio: true, audio_duration_seconds: 492 }),
        chapter(2, { has_audio: true, audio_duration_seconds: null }),
        chapter(3, { has_audio: true, audio_duration_seconds: 0 }),
        chapter(4, { access: "free" }),
        chapter(5, { access: "free", has_text: false }),
      ],
      inputs(3),
      null,
    );

    expect(rows.map((row) => row.detail)).toEqual([
      "8:12 audio",
      "Audio · duration unknown",
      "Audio · duration unknown",
      "Text only",
      "No text or narration yet",
    ]);
  });

  it("says the title, the audio and the state", () => {
    const rows = buildChapterRows(
      [
        chapter(17, { title: "A Whispered Oath", access: "free", has_audio: true, audio_duration_seconds: 492 }),
        chapter(18, { title: null }),
      ],
      inputs(3),
      "chapter-17",
    );

    expect(rows[0].title).toBe("Ch. 17: A Whispered Oath");
    expect(rows[0].accessibilityLabel).toBe(
      "Chapter 17: A Whispered Oath. 8 minutes 12 seconds of audio. Reading now.",
    );
    expect(rows[1].title).toBe("Chapter 18");
    expect(rows[1].accessibilityLabel).toBe("Chapter 18. Text only. Locked.");
  });

  it("opens the reader for text, the player for narration only, and nothing otherwise", () => {
    const rows = buildChapterRows(
      [
        chapter(1, { has_audio: true, audio_duration_seconds: 60 }),
        chapter(2, { has_text: false, has_audio: true }),
        chapter(3, { has_text: false }),
        chapter(4, { has_audio: true }),
      ],
      inputs(3),
      null,
    );

    expect(rows.map((row) => row.opens)).toEqual(["reader", "player", null, null]);
    // The locked chapter's narration gets no headphone either.
    expect(rows[3].trailing).toBe("locked");
  });

  it("drops rows without an id or a number", () => {
    const rows = buildChapterRows([chapter(1, { id: null }), chapter(2, { number: null }), chapter(3)], inputs(), null);
    expect(rows.map((row) => row.id)).toEqual(["chapter-3"]);
  });
});

describe("unlockedCount", () => {
  it("counts every row that isn't Locked", () => {
    const rows = buildChapterRows(book, inputs(3, ["chapter-7"]), "chapter-2");
    expect(unlockedCount(rows)).toBe(4);
    expect(unlockedCount([])).toBe(0);
  });
});

describe("sortChapterRows", () => {
  it("keeps oldest first as given, and reverses it for newest first", () => {
    const rows = buildChapterRows(book, inputs(), null);
    const oldest = sortChapterRows(rows, "oldest");
    const newest = sortChapterRows(rows, "newest");

    expect(oldest.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(newest).toEqual([...oldest].reverse());
    // The rows themselves are never reordered in place.
    expect(rows.map((row) => row.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
