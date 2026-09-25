/// <reference types="jest" />

import { QueryClient, onlineManager } from "@tanstack/react-query";

import {
  chapterProgress,
  continuePosition,
  followsLoadedChapter,
  gridItemLabel,
  itemsInSegment,
  libraryPositions,
  newestPositionByBook,
  progressLine,
  resumeLabel,
  resumeTarget,
  secondsLeft,
  segmentCounts,
  withBookAdded,
  withBookRemoved,
  type LibraryPosition,
  type LoadedPlace,
  type ResumeLockInputs,
} from "@/lib/library";
import type { LibraryItem } from "@/lib/queries/library-items";
import type { RecentPosition } from "@/lib/queries/reading-position";

function item(bookId: string, audioCount: number | null = 0, overrides: Partial<LibraryItem["book"]> = {}): LibraryItem {
  return {
    id: `item-${bookId}`,
    book_id: bookId,
    created_at: "2026-09-25T10:00:00+00:00",
    book: {
      id: bookId,
      title: `Title ${bookId}`,
      author: `Author ${bookId}`,
      cover_path: null,
      chapter_count: 10,
      audio_count: audioCount,
      ...overrides,
    },
  };
}

function row(
  bookId: string,
  number: number | null,
  lastMode: "text" | "audio" = "text",
  chapter: Partial<RecentPosition["chapter"]> = {},
): RecentPosition {
  return {
    id: `position-${bookId}-${number}`,
    chapter_id: `chapter-${bookId}-${number}`,
    book_id: bookId,
    audio_ms: lastMode === "audio" ? 1000 : null,
    text_offset: lastMode === "text" ? 100 : null,
    last_mode: lastMode,
    updated_at: "2026-09-25T10:00:00+00:00",
    chapter: { number, access: "free", has_text: true, has_audio: true, audio_duration_seconds: 600, ...chapter },
  };
}

function position(overrides: Partial<LibraryPosition> = {}): LibraryPosition {
  return {
    chapterId: "chapter-1",
    bookId: "book-1",
    number: 5,
    access: "locked",
    hasText: true,
    hasAudio: true,
    lastMode: "text",
    audioMs: null,
    audioDurationSeconds: null,
    ...overrides,
  };
}

/** Five free chapters by position; nothing unlocked. */
const LOADED: ResumeLockInputs = { freeChaptersAtStart: 5, unlockedChapterIds: new Set() };

describe("segments", () => {
  const items = [item("a", 3), item("b", 0), item("c", null), item("d", 1)];

  it("counts every item in Books, and only narrated ones in Audiobooks", () => {
    expect(segmentCounts(items)).toEqual({ books: 4, audiobooks: 2 });
    expect(itemsInSegment(items, "books").map((entry) => entry.book_id)).toEqual(["a", "b", "c", "d"]);
    expect(itemsInSegment(items, "audiobooks").map((entry) => entry.book_id)).toEqual(["a", "d"]);
  });

  it("drops an item whose book has no id", () => {
    const withBroken = [item("a", 1), item("b", 1, { id: null })];
    expect(segmentCounts(withBroken)).toEqual({ books: 1, audiobooks: 1 });
  });
});

describe("positions", () => {
  it("drops rows without a book id or a chapter number", () => {
    const rows = libraryPositions([row("a", 3), row("b", null), row("", 2)]);
    expect(rows.map((entry) => entry.bookId)).toEqual(["a"]);
  });

  it("flattens the chapter, and reads a null flag as false", () => {
    const [entry] = libraryPositions([row("a", 3, "audio", { has_text: null, has_audio: true })]);
    expect(entry).toEqual({
      chapterId: "chapter-a-3",
      bookId: "a",
      number: 3,
      access: "free",
      hasText: false,
      hasAudio: true,
      lastMode: "audio",
      audioMs: 1000,
      audioDurationSeconds: 600,
    });
  });

  it("gives Books the newest row, and Audiobooks the newest audio row, not the newest row", () => {
    const rows = libraryPositions([row("a", 4, "text"), row("b", 2, "audio"), row("c", 7, "audio")]);
    expect(continuePosition(rows, "books")?.bookId).toBe("a");
    expect(continuePosition(rows, "audiobooks")?.bookId).toBe("b");
  });

  it("collapses Continue with no row, or no audio row for Audiobooks", () => {
    expect(continuePosition([], "books")).toBeNull();
    expect(continuePosition(libraryPositions([row("a", 1, "text")]), "audiobooks")).toBeNull();
  });

  it("keeps each book's newest row, and a book with no row has none", () => {
    const byBook = newestPositionByBook(libraryPositions([row("a", 9), row("b", 2), row("a", 3)]));
    expect(byBook.get("a")?.number).toBe(9);
    expect(byBook.get("b")?.number).toBe(2);
    expect(byBook.has("z")).toBe(false);
  });
});

describe("chapterProgress", () => {
  it("reads chapter n of m, with the bar at n / m", () => {
    expect(chapterProgress(3, 12)).toEqual({ label: "Chapter 3 of 12", fraction: 0.25 });
  });

  it("clamps the bar to 1 when the chapter number passes the count", () => {
    expect(chapterProgress(14, 12)).toEqual({ label: "Chapter 14 of 12", fraction: 1 });
  });

  it("draws no bar with a null or 0 count", () => {
    expect(chapterProgress(3, null)).toEqual({ label: "Chapter 3", fraction: null });
    expect(chapterProgress(3, 0)).toEqual({ label: "Chapter 3", fraction: null });
  });
});

describe("the loaded chapter", () => {
  const loaded: LoadedPlace = { chapterId: "chapter-2", bookId: "book-1", number: 2, durationSeconds: 300 };

  it("takes over a listening row in the same book, as autoplay moves on", () => {
    expect(followsLoadedChapter(position({ lastMode: "audio", number: 1 }), loaded)).toBe(true);
  });

  it("never takes over a reading row, another book, or nothing loaded", () => {
    expect(followsLoadedChapter(position({ lastMode: "text" }), loaded)).toBe(false);
    expect(followsLoadedChapter(position({ lastMode: "audio", bookId: "book-2" }), loaded)).toBe(false);
    expect(followsLoadedChapter(position({ lastMode: "audio" }), null)).toBe(false);
  });
});

describe("time left", () => {
  it("counts whole seconds left, as M6 prints its remaining time", () => {
    expect(secondsLeft(528_400, 648.4)).toBe(120);
    expect(secondsLeft(0, 600)).toBe(600);
  });

  it("never goes below zero", () => {
    expect(secondsLeft(700_000, 600)).toBe(0);
  });

  it("is unknown without a place or a measured length, never 0:00", () => {
    expect(secondsLeft(null, 600)).toBeNull();
    expect(secondsLeft(10_000, null)).toBeNull();
    expect(secondsLeft(10_000, 0)).toBeNull();
  });

  it("adds the time left to the chapter, and speaks it in whole minutes", () => {
    const progress = chapterProgress(1, 13);
    expect(progressLine(progress, 120)).toEqual({
      shown: "Chapter 1 of 13 · 2:00 left",
      spoken: "Chapter 1 of 13, 2 minutes left",
    });
    expect(progressLine(progress, 45).spoken).toBe("Chapter 1 of 13, less than a minute left");
    expect(progressLine(progress, null)).toEqual({ shown: "Chapter 1 of 13", spoken: "Chapter 1 of 13" });
  });
});

describe("resumeTarget", () => {
  it("opens M6 for audio and M5 for text", () => {
    expect(resumeTarget(position({ lastMode: "audio", number: 2 }), LOADED)).toEqual({
      kind: "player",
      chapterId: "chapter-1",
    });
    expect(resumeTarget(position({ lastMode: "text", number: 2 }), LOADED)).toEqual({
      kind: "reader",
      chapterId: "chapter-1",
    });
  });

  it("opens the other mode when the chapter lacks the one it was left in", () => {
    expect(resumeTarget(position({ lastMode: "audio", number: 2, hasAudio: false }), LOADED).kind).toBe("reader");
    expect(resumeTarget(position({ lastMode: "text", number: 2, hasText: false }), LOADED).kind).toBe("player");
    expect(
      resumeTarget(position({ number: 2, hasText: false, hasAudio: false }), LOADED).kind,
    ).toBe("none");
  });

  it("opens nothing for a Locked chapter", () => {
    expect(resumeTarget(position({ number: 6 }), LOADED)).toEqual({ kind: "locked" });
  });

  it("opens an unlocked chapter", () => {
    const inputs = { freeChaptersAtStart: 5, unlockedChapterIds: new Set(["chapter-1"]) };
    expect(resumeTarget(position({ number: 6 }), inputs).kind).toBe("reader");
  });

  it("waits for the settings, and for the unlocks only when the chapter isn't free", () => {
    expect(resumeTarget(position({ number: 2 }), { freeChaptersAtStart: undefined, unlockedChapterIds: undefined }))
      .toEqual({ kind: "pending" });
    const noUnlocks = { freeChaptersAtStart: 5, unlockedChapterIds: undefined };
    expect(resumeTarget(position({ number: 6 }), noUnlocks)).toEqual({ kind: "pending" });
    expect(resumeTarget(position({ number: 2 }), noUnlocks).kind).toBe("reader");
    expect(resumeTarget(position({ number: 9, access: "free" }), noUnlocks).kind).toBe("reader");
  });

  it("says where it goes, or why it won't", () => {
    expect(resumeLabel({ kind: "player", chapterId: "c" }, "Dusk", 4)).toBe("Continue listening to Dusk, chapter 4");
    expect(resumeLabel({ kind: "reader", chapterId: "c" }, "Dusk", 4)).toBe("Continue reading Dusk, chapter 4");
    expect(resumeLabel({ kind: "locked" }, "Dusk", 4)).toBe("Dusk, chapter 4 is locked");
    expect(resumeLabel({ kind: "pending" }, "Dusk", 4)).toBe("Loading Dusk, chapter 4");
  });
});

describe("gridItemLabel", () => {
  it("reads as one element, with only the known parts", () => {
    expect(
      gridItemLabel({ title: "Dusk", author: "Ana Reyes", audio_count: 2 }, chapterProgress(3, 12)),
    ).toBe("Dusk by Ana Reyes. Audiobook. Chapter 3 of 12.");
    expect(gridItemLabel({ title: null, author: null, audio_count: 0 }, null)).toBe("Untitled.");
  });
});

describe("optimistic My List", () => {
  const listed = [item("a"), item("b")];

  it("puts an added book first, once", () => {
    const added = withBookAdded(listed, item("c"));
    expect(added.map((entry) => entry.book_id)).toEqual(["c", "a", "b"]);
    expect(withBookAdded(added, item("c"))).toBe(added);
  });

  it("changes nothing when the book is already on the list", () => {
    expect(withBookAdded(listed, item("b"))).toBe(listed);
  });

  it("drops a removed book", () => {
    expect(withBookRemoved(listed, "a").map((entry) => entry.book_id)).toEqual(["b"]);
    expect(withBookRemoved(listed, "z").map((entry) => entry.book_id)).toEqual(["a", "b"]);
  });
});

// Step 14: sign-out's `clearUserScopedState()` calls `queryClient.clear()`.
// A My List change paused offline must never be sent after it, or it would
// go out under the next account's token.
describe("sign-out", () => {
  afterEach(() => onlineManager.setOnline(true));

  it("drops a paused My List change, so it is never sent", async () => {
    const queryClient = new QueryClient();
    queryClient.mount();
    const mutationFn = jest.fn(async () => {});
    onlineManager.setOnline(false);

    const mutation = queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn, scope: { id: "my-list:book-1" } });
    void mutation.execute("add").catch(() => {});
    await Promise.resolve();
    expect(mutation.state.isPaused).toBe(true);

    queryClient.clear();
    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(mutationFn).not.toHaveBeenCalled();

    // Orphaned and still pending, it reschedules its gc timer forever, which
    // would keep jest from exiting. Harmless in the app.
    mutation.destroy();
    queryClient.unmount();
  });
});
