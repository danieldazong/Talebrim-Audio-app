/// <reference types="jest" />

import {
  buildChapterRows,
  chapterRowActions,
  downloadAllState,
  downloadFailureMessage,
  openingRowIndex,
  sortChapterRows,
  unlockedCount,
  type ChapterListDownloads,
} from "@/lib/chapter-list";
import type { QueueItem } from "@/lib/downloads/queue";
import type { ChapterListItemRow } from "@/types/catalog";
import type { ChapterLockInputs } from "@/types/states";

/** Chapters 1–3 are free by access, as the dashboard creates them; the rest locked. */
function chapter(number: number, overrides: Partial<ChapterListItemRow> = {}): ChapterListItemRow {
  return {
    id: `chapter-${number}`,
    number,
    title: `Title ${number}`,
    access: number <= 3 ? "free" : "locked",
    has_text: true,
    has_audio: false,
    audio_duration_seconds: null,
    ...overrides,
  };
}

function inputs(unlocked: string[] = [], isSubscribed = false): ChapterLockInputs {
  return { unlockedChapterIds: new Set(unlocked), isSubscribed };
}

/** Chapters 1–8: 1–3 free by access, 4–8 locked, so only the unlocks free those. */
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
      inputs(),
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

  it("marks nothing Downloaded without downloads", () => {
    expect(kinds(buildChapterRows(book, inputs(), null))).not.toContain("downloaded");
  });

  it("lets Locked beat Reading Now", () => {
    const rows = buildChapterRows(book, inputs(), "chapter-6");
    expect(rows[5].state.kind).toBe("locked");
    expect(kinds(rows)).not.toContain("reading");
  });

  it("treats a null access as Locked, even within the free chapters", () => {
    const rows = buildChapterRows([chapter(1, { access: null })], inputs(), "chapter-1");
    expect(rows[0].state.kind).toBe("locked");
  });

  it("keeps the dashboard's locks visible to a subscriber: those chapters, and only those, read Unlimited", () => {
    // 1–3 free by access, 4–8 locked; chapter 5 also unlocked on its own.
    const rows = buildChapterRows(book, inputs(["chapter-5"], true), null);
    expect(kinds(rows)).not.toContain("locked");
    expect(rows.map((row) => row.byPlan)).toEqual([false, false, false, true, false, true, true, true]);
    expect(rows[3].accessibilityLabel).toBe("Chapter 4: Title 4. Text only. Unlocked. With Talebrim Unlimited.");
    expect(rows[0].accessibilityLabel).toBe("Chapter 1: Title 1. Text only. Unlocked.");
    // Without the plan, the same chapters are Locked and nothing reads Unlimited.
    const free = buildChapterRows(book, inputs(), null);
    expect(kinds(free)).toEqual(["unlocked", "unlocked", "unlocked", "locked", "locked", "locked", "locked", "locked"]);
    expect(free.some((row) => row.byPlan)).toBe(false);
  });

  it("frees a chapter by its own access, never by its number", () => {
    expect(kinds(buildChapterRows(book, inputs(), null)).filter((kind) => kind !== "locked")).toHaveLength(3);
    // The owner locked chapter 2 in the dashboard: it stays locked (2026-09-30).
    const rows = buildChapterRows([chapter(1), chapter(2, { access: "locked" }), chapter(3)], inputs(), null);
    expect(kinds(rows)).toEqual(["unlocked", "locked", "unlocked"]);
  });

  it("opens a chapter that is free by access, or unlocked by the reader", () => {
    const rows = buildChapterRows(
      [chapter(7, { access: "free" }), chapter(8)],
      inputs(["chapter-8"]),
      null,
    );
    expect(kinds(rows)).toEqual(["unlocked", "unlocked"]);
  });

  it("opens every chapter for a subscriber, and shows Reading Now again", () => {
    const rows = buildChapterRows(book, inputs([], true), "chapter-6");
    expect(kinds(rows).filter((kind) => kind === "locked")).toEqual([]);
    expect(rows[5].state.kind).toBe("reading");
    expect(unlockedCount(rows)).toBe(8);
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
      inputs(),
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
      inputs(),
      "chapter-17",
    );

    expect(rows[0].title).toBe("Ch. 17: A Whispered Oath");
    expect(rows[0].accessibilityLabel).toBe(
      "Chapter 17: A Whispered Oath. 8 minutes 12 seconds of audio. Reading now.",
    );
    expect(rows[1].title).toBe("Chapter 18");
    expect(rows[1].accessibilityLabel).toBe("Chapter 18. Text only. Locked.");
  });

  it("opens the reader for text, the player for narration only, M5a when locked, and nothing otherwise", () => {
    const rows = buildChapterRows(
      [
        chapter(1, { has_audio: true, audio_duration_seconds: 60 }),
        chapter(2, { has_text: false, has_audio: true }),
        chapter(3, { has_text: false }),
        chapter(4, { has_audio: true }),
        chapter(5, { has_text: false, has_audio: true }),
        chapter(6, { has_text: false }),
      ],
      inputs(),
      null,
    );

    expect(rows.map((row) => row.opens)).toEqual([
      { kind: "reader" },
      { kind: "player" },
      null,
      { kind: "paywall", mode: "text" },
      { kind: "paywall", mode: "audio" },
      // Locked, with nothing to unlock.
      null,
    ]);
    // The locked chapter's narration gets no headphone either.
    expect(rows[3].trailing).toBe("locked");
  });

  it("drops rows without an id or a number", () => {
    const rows = buildChapterRows([chapter(1, { id: null }), chapter(2, { number: null }), chapter(3)], inputs(), null);
    expect(rows.map((row) => row.id)).toEqual(["chapter-3"]);
  });
});

function item(chapterId: string, overrides: Partial<QueueItem> = {}): QueueItem {
  const book = { id: "book-1", title: "Book One", author: null, coverUrl: null };
  return { chapterId, bookId: "book-1", kind: "download", status: "queued", progress: 0, failure: null, book, ...overrides };
}

function downloads(downloaded: string[], queue: QueueItem[] = []): ChapterListDownloads {
  return { downloaded: new Set(downloaded), queue };
}

describe("downloads on M9's rows", () => {
  const narrated = [1, 2, 3, 4, 5].map((number) => chapter(number, { has_audio: true, audio_duration_seconds: 300 }));

  it("marks a downloaded chapter Downloaded, with the teal disc in place of the headphone", () => {
    const rows = buildChapterRows(narrated, inputs(), null, downloads(["chapter-1"]));
    expect(rows[0].state.kind).toBe("downloaded");
    expect(rows[0].trailing).toBe("downloaded");
    expect(rows[0].accessibilityLabel.endsWith("Downloaded.")).toBe(true);
    expect(rows[1].trailing).toBe("listen");
  });

  it("lets Reading Now beat Downloaded, and Locked beat both", () => {
    const rows = buildChapterRows(narrated, inputs(), "chapter-1", downloads(["chapter-1", "chapter-4"]));
    expect(rows[0]).toMatchObject({ state: { kind: "reading" }, trailing: "reading", download: { kind: "downloaded" } });
    expect(rows[3]).toMatchObject({ state: { kind: "locked" }, trailing: "locked" });
  });

  it("shows a chapter in the queue in the slot: Queued, its percentage, or Failed", () => {
    const rows = buildChapterRows(
      narrated,
      inputs(),
      "chapter-3",
      downloads([], [
        item("chapter-1"),
        item("chapter-2", { status: "downloading", progress: 0.346 }),
        item("chapter-3", { status: "failed", failure: "network" }),
      ]),
    );
    expect(rows.slice(0, 3).map((row) => row.trailing)).toEqual(["queued", "progress", "failed"]);
    expect(rows[1].download).toEqual({ kind: "downloading", percent: 34 });
    expect(rows[1].accessibilityLabel).toContain("Downloading, 34%.");
    expect(rows[0].accessibilityLabel).toContain("Queued for download.");
    // The state still ends the label.
    expect(rows[2].accessibilityLabel.endsWith("Reading now.")).toBe(true);
  });

  it("keeps a paused chapter's percentage: it carries on from there", () => {
    const rows = buildChapterRows(narrated, inputs(), null, downloads([], [item("chapter-1", { progress: 0.5 })]));
    expect(rows[0].trailing).toBe("progress");
    expect(rows[0].download).toEqual({ kind: "downloading", percent: 50 });
  });

  it("ignores a refresh of an edited download", () => {
    const rows = buildChapterRows(narrated, inputs(), null, downloads(["chapter-1"], [item("chapter-1", { kind: "refresh" })]));
    expect(rows[0].trailing).toBe("downloaded");
  });

  it("gives a sheet only to rows the reader can open, with something in them", () => {
    const rows = buildChapterRows(
      [chapter(1), chapter(2, { has_text: false }), chapter(4)],
      inputs(),
      null,
      downloads(["chapter-1"]),
    );
    expect(rows.map((row) => row.hasSheet)).toEqual([true, false, false]);
    expect(chapterRowActions(rows[1])).toEqual([]);
    expect(chapterRowActions(rows[2])).toEqual([]);
  });

  it("offers Listen when there is narration, then the one download action the state allows", () => {
    const rows = buildChapterRows(
      narrated,
      inputs(["chapter-4", "chapter-5"]),
      null,
      downloads(["chapter-1"], [item("chapter-2"), item("chapter-3", { status: "failed", failure: "other" })]),
    );
    expect(rows.map(chapterRowActions)).toEqual([
      ["listen", "remove"],
      ["listen", "cancel"],
      ["listen", "download"],
      ["listen", "download"],
      ["listen", "download"],
    ]);
    const textOnly = buildChapterRows([chapter(1)], inputs(), null);
    expect(chapterRowActions(textOnly[0])).toEqual(["download"]);
  });
});

describe("downloadAllState", () => {
  const rowsFor = (downloaded: string[], queue: QueueItem[] = []) =>
    buildChapterRows(book, inputs(), null, downloads(downloaded, queue));

  it("counts the chapters the reader can open that aren't downloaded", () => {
    expect(downloadAllState(rowsFor(["chapter-1"]), [])).toEqual({ kind: "ready", count: 2 });
  });

  it("reads All downloaded when there is nothing left", () => {
    expect(downloadAllState(rowsFor(["chapter-1", "chapter-2", "chapter-3"]), [])).toEqual({ kind: "done" });
  });

  it("hides with nothing the reader can open", () => {
    const allLocked = book.map((row) => ({ ...row, access: "locked" as const }));
    expect(downloadAllState(buildChapterRows(allLocked, inputs(), null), [])).toEqual({ kind: "hidden" });
  });

  it("counts a run while it goes: done out of all but the cancelled", () => {
    const queue = [
      item("chapter-1", { status: "done" }),
      item("chapter-2", { status: "downloading" }),
      item("chapter-3", { status: "queued" }),
      item("chapter-5", { status: "cancelled" }),
    ];
    expect(downloadAllState(rowsFor(["chapter-1"], queue), queue)).toEqual({ kind: "running", done: 1, total: 3 });
  });

  it("offers a failed chapter again once the run is over", () => {
    const queue = [item("chapter-2", { status: "failed", failure: "network" })];
    expect(downloadAllState(rowsFor(["chapter-1", "chapter-3"], queue), queue)).toEqual({ kind: "ready", count: 1 });
  });
});

describe("downloadFailureMessage", () => {
  it("says nothing without a failure", () => {
    expect(downloadFailureMessage([item("chapter-1")])).toBeNull();
  });

  it("says the most telling failure, in words", () => {
    expect(
      downloadFailureMessage([
        item("chapter-1", { status: "failed", failure: "network" }),
        item("chapter-2", { status: "failed", failure: "disk_full" }),
      ]),
    ).toBe("Not enough free space on this phone. Free some space, then try again.");
    expect(downloadFailureMessage([item("chapter-1", { status: "failed", failure: "network" })])).toBe(
      "A chapter didn't download. Check your connection and try again.",
    );
    expect(
      downloadFailureMessage([
        item("chapter-1", { status: "failed", failure: "refused" }),
        item("chapter-2", { status: "failed", failure: "refused" }),
      ]),
    ).toBe("2 chapters couldn't be downloaded on this account.");
  });
});

describe("unlockedCount", () => {
  it("counts every row that isn't Locked", () => {
    const rows = buildChapterRows(book, inputs(["chapter-7"]), "chapter-2");
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

describe("openingRowIndex", () => {
  // 64dp rows in a 600dp list: about 9 rows fit.
  const ROW = 64;
  const VIEWPORT = 600;

  it("opens at the top with no Reading Now row, or when it is the first", () => {
    expect(openingRowIndex(-1, 40, ROW, VIEWPORT)).toBeUndefined();
    expect(openingRowIndex(0, 40, ROW, VIEWPORT)).toBeUndefined();
  });

  it("opens a list that fits on the screen at the top, never below a blank gap", () => {
    // 5 chapters, reading chapter 3: 320dp of rows in 600dp.
    expect(openingRowIndex(2, 5, ROW, VIEWPORT)).toBeUndefined();
  });

  it("puts the Reading Now row at the top when the list can scroll that far", () => {
    expect(openingRowIndex(20, 40, ROW, VIEWPORT)).toBe(20);
  });

  it("stops at the last row that can reach the top, near the end of the list", () => {
    // 13 rows are 832dp; the list scrolls 232dp at most, which puts row 3 at the top.
    expect(openingRowIndex(11, 13, ROW, VIEWPORT)).toBe(3);
  });
});
