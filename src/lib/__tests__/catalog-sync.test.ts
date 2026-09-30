/// <reference types="jest" />

import { changeTouchesChapter } from "@/lib/catalog-sync";

// Which catalog changes concern one chapter: the downloads check and the
// player's loaded chapter (2026-09-30) both ask.

describe("changeTouchesChapter", () => {
  it("is true for a change that names the chapter", () => {
    expect(changeTouchesChapter({ bookIds: ["book-1"], chapterIds: ["ch-1", "ch-2"] }, "ch-1", "book-1")).toBe(true);
  });

  it("is false for a change to other chapters of the same book", () => {
    expect(changeTouchesChapter({ bookIds: ["book-1"], chapterIds: ["ch-3"] }, "ch-1", "book-1")).toBe(false);
  });

  it("is true for a change to the book itself, or to too many of its chapters to list", () => {
    // Published → draft arrives as the book with no chapters.
    expect(changeTouchesChapter({ bookIds: ["book-1"], chapterIds: [] }, "ch-1", "book-1")).toBe(true);
    expect(changeTouchesChapter({ bookIds: ["book-1"], chapterIds: null }, "ch-1", "book-1")).toBe(true);
  });

  it("is false for another book", () => {
    expect(changeTouchesChapter({ bookIds: ["book-2"], chapterIds: null }, "ch-1", "book-1")).toBe(false);
  });
});
