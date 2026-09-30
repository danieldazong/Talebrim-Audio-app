/// <reference types="jest" />

import {
  accessVerdict,
  chapterDownloadSize,
  downloadCandidates,
  downloadButton,
  downloadConfirmation,
  downloadingBooks,
  groupByBook,
  hasRoomFor,
  nextDownloadedChapter,
  OFFLINE_WINDOW_MS,
  planReconcile,
  refreshParts,
  totalDownloadSize,
  withinOfflineWindow,
  DISK_MARGIN_BYTES,
} from "@/lib/downloads/rules";
import type { QueueItem } from "@/lib/downloads/queue";
import type { DownloadRow } from "@/lib/queries/downloads";
import type { DownloadEntry } from "@/store/downloads-store";
import type { ChapterLockInputs } from "@/types/states";

const NOW = Date.UTC(2026, 8, 28, 12);
const DAY = 24 * 60 * 60 * 1000;

function entry(chapterId: string, overrides: Partial<DownloadEntry> = {}): DownloadEntry {
  return {
    chapterId,
    book: { id: "book-1", title: "Book", author: null, coverUrl: null },
    number: 1,
    title: null,
    hasText: true,
    hasAudio: true,
    durationSeconds: 600,
    audio: { ext: "m4a", bytes: 5_000_000, path: `book-1/${chapterId}/a.m4a` },
    text: { bytes: 20_000, length: 19_000 },
    updatedAt: "2026-09-28T10:00:00+00:00",
    verifiedAt: NOW,
    ...overrides,
  };
}

/** Chapters 1–3 are free by access, as the dashboard creates them; the rest locked. */
function row(id: string, number: number, overrides: Partial<DownloadRow> = {}): DownloadRow {
  return {
    id,
    book_id: "book-1",
    number,
    title: null,
    access: number <= 3 ? "free" : "locked",
    has_text: true,
    has_audio: true,
    audio_duration_seconds: 600,
    updated_at: "2026-09-28T10:00:00+00:00",
    audio_size_bytes: 5_000_000,
    text_bytes: 20_000,
    ...overrides,
  };
}

function inputs(unlocked: string[] = [], isSubscribed = false): ChapterLockInputs {
  return { unlockedChapterIds: new Set(unlocked), isSubscribed };
}

describe("the 30-day window", () => {
  it("opens a download offline up to 30 days after its last check, and not a moment after", () => {
    expect(withinOfflineWindow(NOW, NOW)).toBe(true);
    expect(withinOfflineWindow(NOW - 29 * DAY, NOW)).toBe(true);
    expect(withinOfflineWindow(NOW - OFFLINE_WINDOW_MS, NOW)).toBe(true);
    expect(withinOfflineWindow(NOW - OFFLINE_WINDOW_MS - 1, NOW)).toBe(false);
    expect(OFFLINE_WINDOW_MS).toBe(30 * DAY);
  });
});

describe("sizes", () => {
  it("adds the narration's recorded size to the text's", () => {
    expect(chapterDownloadSize(row("c1", 1))).toEqual({ bytes: 5_020_000, estimated: false });
  });

  it("counts a narration with no recorded size at 64 kbps, and says it estimated", () => {
    // 600 s × 64,000 bits ÷ 8 = 4,800,000 bytes.
    expect(chapterDownloadSize(row("c1", 1, { audio_size_bytes: null }))).toEqual({
      bytes: 4_820_000,
      estimated: true,
    });
  });

  it("counts nothing for a narration with neither a size nor a duration, as an estimate", () => {
    expect(
      chapterDownloadSize(row("c1", 1, { audio_size_bytes: null, audio_duration_seconds: null, text_bytes: null })),
    ).toEqual({ bytes: 0, estimated: true });
  });

  it("counts only the parts the chapter has", () => {
    expect(chapterDownloadSize(row("c1", 1, { has_audio: false }))).toEqual({ bytes: 20_000, estimated: false });
    expect(chapterDownloadSize(row("c1", 1, { has_text: false }))).toEqual({ bytes: 5_000_000, estimated: false });
  });

  it("totals chapters, estimated if any one is", () => {
    expect(totalDownloadSize([row("c1", 1), row("c2", 2, { audio_size_bytes: null })])).toEqual({
      bytes: 5_020_000 + 4_820_000,
      estimated: true,
    });
  });

  it("confirms the count and the size, 'about' when estimated, and mobile data", () => {
    expect(downloadConfirmation(12, { bytes: 48_000_000, estimated: false }, false)).toEqual({
      title: "Download 12 chapters?",
      message: "12 chapters, 48 MB. Keep Talebrim open while they download.",
    });
    expect(downloadConfirmation(1, { bytes: 4_820_000, estimated: true }, true)).toEqual({
      title: "Download 1 chapter?",
      message: "1 chapter, about 4.8 MB. You're on mobile data. Keep Talebrim open while they download.",
    });
  });

  it("needs the margin free beyond the chapter", () => {
    expect(hasRoomFor(5_000_000 + DISK_MARGIN_BYTES, 5_000_000)).toBe(true);
    expect(hasRoomFor(5_000_000 + DISK_MARGIN_BYTES - 1, 5_000_000)).toBe(false);
  });
});

describe("reconciling the index on start", () => {
  const index = (chapters: DownloadEntry[], userId: string | null = "user_a") => ({
    userId,
    chapters: Object.fromEntries(chapters.map((item) => [item.chapterId, item])),
  });

  it("keeps whole entries, prunes one missing a file, and deletes files no entry lists", () => {
    const plan = planReconcile(
      index([entry("c1"), entry("c2")]),
      "user_a",
      ["c1.m4a", "c1.txt", "c2.m4a", "c3.txt", "c1.m4a.part"],
    );
    expect(plan).toEqual({ wipe: false, prune: ["c2"], deleteFiles: ["c2.m4a", "c3.txt", "c1.m4a.part"] });
  });

  it("prunes an entry missing a part the chapter had", () => {
    const plan = planReconcile(index([entry("c1", { text: null })]), "user_a", ["c1.m4a"]);
    expect(plan.prune).toEqual(["c1"]);
    expect(plan.deleteFiles).toEqual(["c1.m4a"]);
  });

  it("wipes another account's index and every file", () => {
    const plan = planReconcile(index([entry("c1")], "user_b"), "user_a", ["c1.m4a", "c1.txt"]);
    expect(plan).toEqual({ wipe: true, prune: ["c1"], deleteFiles: ["c1.m4a", "c1.txt"] });
  });

  it("deletes files with no index at all", () => {
    expect(planReconcile(index([], null), "user_a", ["c9.m4a"])).toEqual({
      wipe: false,
      prune: [],
      deleteFiles: ["c9.m4a"],
    });
  });
});

describe("the access check", () => {
  it("keeps a chapter still open, unchanged", () => {
    expect(accessVerdict(entry("c1"), row("c1", 1), inputs())).toBe("keep");
  });

  it("keeps a chapter open by an unlock or the subscription", () => {
    expect(accessVerdict(entry("c5"), row("c5", 5), inputs(["c5"]))).toBe("keep");
    expect(accessVerdict(entry("c5"), row("c5", 5), inputs([], true))).toBe("keep");
  });

  it("deletes a chapter the reader lost", () => {
    expect(accessVerdict(entry("c5"), row("c5", 5), inputs())).toBe("delete");
  });

  it("deletes chapter 1 once the owner locks it: its number never keeps it open", () => {
    expect(accessVerdict(entry("c1"), row("c1", 1, { access: "locked" }), inputs())).toBe("delete");
  });

  it("deletes a chapter gone from chapters_catalog: unpublished or deleted", () => {
    expect(accessVerdict(entry("c1"), undefined, inputs())).toBe("delete");
  });

  it("refreshes a chapter edited since its download", () => {
    expect(accessVerdict(entry("c1"), row("c1", 1, { updated_at: "2026-09-28T11:00:00+00:00" }), inputs())).toBe(
      "refresh",
    );
  });

  it("fetches the text of an edited chapter again, and the narration only when its path changed", () => {
    const edited = row("c1", 1);
    expect(refreshParts(entry("c1"), edited, "book-1/c1/a.m4a")).toEqual({ text: true, audio: false });
    expect(refreshParts(entry("c1"), edited, "book-1/c1/b.m4a")).toEqual({ text: true, audio: true });
    expect(refreshParts(entry("c1", { audio: null }), edited, "book-1/c1/a.m4a")).toEqual({ text: true, audio: true });
    expect(refreshParts(entry("c1"), row("c1", 1, { has_audio: false }), null)).toEqual({ text: true, audio: false });
  });
});

describe("what Download all fetches", () => {
  it("only chapters the reader can open, with something in them, not downloaded or waiting", () => {
    const rows = [
      row("c1", 1),
      row("c2", 2, { has_text: false, has_audio: false }),
      row("c3", 3),
      row("c4", 4),
      row("c5", 5),
      row("c6", 6, { access: "free" }),
    ];
    const ids = downloadCandidates(rows, inputs(["c5"]), new Set(["c3"])).map((candidate) => candidate.id);
    expect(ids).toEqual(["c1", "c5", "c6"]);
  });
});

describe("offline autoplay", () => {
  const entries = [
    entry("c2", { number: 2 }),
    entry("c3", { number: 3, audio: null }),
    entry("c5", { number: 5 }),
    entry("c7", { number: 7, verifiedAt: NOW - 31 * DAY }),
    entry("x4", { number: 4, book: { id: "book-2", title: "Other", author: null, coverUrl: null } }),
  ];
  const current = { bookId: "book-1", number: 2 };

  it("moves to the book's next downloaded chapter with narration, by number", () => {
    expect(nextDownloadedChapter(entries, current, undefined, NOW)?.chapterId).toBe("c5");
  });

  it("takes only the chapter the cached neighbours name, and stops when it isn't downloaded", () => {
    expect(nextDownloadedChapter(entries, current, "c5", NOW)?.chapterId).toBe("c5");
    expect(nextDownloadedChapter(entries, current, "c4-missing", NOW)).toBeNull();
    expect(nextDownloadedChapter(entries, current, null, NOW)).toBeNull();
  });

  it("stops past the last playable one: a chapter offline past its 30 days never plays", () => {
    expect(nextDownloadedChapter(entries, { bookId: "book-1", number: 5 }, undefined, NOW)).toBeNull();
  });
});

describe("M4's download button", () => {
  const base = { available: true, online: true, preparing: false, prepareFailed: false };

  it("points off Android to Downloads, whatever else holds", () => {
    expect(downloadButton({ ...base, available: false, state: { kind: "ready", count: 3 } })).toEqual({
      kind: "unavailable",
    });
    expect(downloadButton({ ...base, available: false, state: null })).toEqual({ kind: "unavailable" });
  });

  it("waits for the chapter list, or says offline without one", () => {
    expect(downloadButton({ ...base, state: null })).toEqual({ kind: "loading" });
    expect(downloadButton({ ...base, state: null, online: false })).toEqual({ kind: "offline" });
  });

  it("downloads the book when there is something to download, online", () => {
    expect(downloadButton({ ...base, state: { kind: "ready", count: 3 } })).toEqual({ kind: "ready", count: 3 });
    expect(downloadButton({ ...base, state: { kind: "ready", count: 3 }, online: false })).toEqual({ kind: "offline" });
  });

  it("shows the fetch in progress, and offers it again after it failed", () => {
    expect(downloadButton({ ...base, state: { kind: "ready", count: 3 }, preparing: true })).toEqual({
      kind: "preparing",
    });
    expect(downloadButton({ ...base, state: { kind: "ready", count: 3 }, prepareFailed: true })).toEqual({
      kind: "failed",
    });
  });

  it("follows a run, then says all downloaded, offline too", () => {
    expect(downloadButton({ ...base, state: { kind: "running", done: 2, total: 5 } })).toEqual({
      kind: "running",
      done: 2,
      total: 5,
    });
    expect(downloadButton({ ...base, state: { kind: "done" }, online: false })).toEqual({ kind: "done" });
    expect(downloadButton({ ...base, state: { kind: "hidden" } })).toEqual({ kind: "hidden" });
  });
});

describe("the Downloads screen's books", () => {
  it("groups by book, chapters in reading order, with each book's size", () => {
    const other = { id: "book-2", title: "Other", author: null, coverUrl: null };
    const groups = groupByBook([
      entry("c3", { number: 3, verifiedAt: NOW - DAY }),
      entry("x1", { number: 1, book: other, verifiedAt: NOW }),
      entry("c1", { number: 1, verifiedAt: NOW - DAY }),
    ]);
    expect(groups.map((group) => group.book.id)).toEqual(["book-2", "book-1"]);
    expect(groups[1].chapters.map((chapter) => chapter.chapterId)).toEqual(["c1", "c3"]);
    expect(groups[1].bytes).toBe(2 * 5_020_000);
  });
});

describe("the Downloads screen's books under way", () => {
  const book = { id: "book-1", title: "Book One", author: null, coverUrl: null };
  const other = { id: "book-2", title: "Other", author: null, coverUrl: null };
  const item = (chapterId: string, overrides: Partial<QueueItem> = {}): QueueItem => ({
    chapterId,
    bookId: overrides.book?.id ?? "book-1",
    kind: "download",
    status: "queued",
    progress: 0,
    failure: null,
    book,
    ...overrides,
  });

  it("counts a book's run as M9 does, with the chapter under way", () => {
    const books = downloadingBooks([
      item("c1", { status: "done", progress: 1 }),
      item("c2", { status: "downloading", progress: 0.34 }),
      item("c3"),
      item("c4", { status: "cancelled" }),
      item("c5", { status: "failed", failure: "network" }),
    ]);
    expect(books).toEqual([{ book, done: 1, total: 4, progress: 0.34 }]);
  });

  it("keeps a paused chapter's percentage, and has none before a chapter starts", () => {
    expect(downloadingBooks([item("c1", { progress: 0.5 })])[0].progress).toBe(0.5);
    expect(downloadingBooks([item("c1")])[0].progress).toBeNull();
  });

  it("leaves out books with nothing left to do, and refreshes", () => {
    expect(
      downloadingBooks([
        item("c1", { status: "done", progress: 1 }),
        item("c2", { status: "failed", failure: "other" }),
        item("x1", { book: other, kind: "refresh" }),
      ]),
    ).toEqual([]);
  });
});
