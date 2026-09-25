/// <reference types="jest" />

import {
  HERO_COUNT,
  NO_HERO_SET,
  heroBooks,
  newestHeroIds,
  nextHeroSet,
  settlePage,
  wrapPage,
  type HeroSet,
} from "@/lib/hero";
import type { CarouselBookRow } from "@/types/catalog";

function book(id: string | null, title = `Title ${id}`): CarouselBookRow {
  return {
    id,
    title,
    author: null,
    genres: null,
    cover_path: null,
    chapter_count: 5,
    audio_count: 0,
    free_chapter_count: 3,
    total_duration_seconds: null,
    created_at: null,
    updated_at: null,
  };
}

describe("newestHeroIds", () => {
  it("takes the first five with an id, in the query's newest-first order", () => {
    const books = ["a", null, "b", "c", "d", "e", "f"].map((id) => book(id));
    expect(newestHeroIds(books)).toEqual(["a", "b", "c", "d", "e"]);
    expect(HERO_COUNT).toBe(5);
  });

  it("shows fewer when fewer are published", () => {
    expect(newestHeroIds([book("a"), book("b"), book("c")])).toEqual(["a", "b", "c"]);
  });
});

describe("nextHeroSet", () => {
  const shown: HeroSet = { ids: ["a", "b"], tab: "Discover", focus: 1 };

  it("takes the first answer", () => {
    expect(nextHeroSet(NO_HERO_SET, ["a", "b"], "Discover", 1)).toEqual(shown);
  });

  it("keeps the set on screen when a story is published while the reader looks on", () => {
    expect(nextHeroSet(shown, ["new", "a", "b"], "Discover", 1)).toBeNull();
  });

  it("takes the newer set when Discover regains focus", () => {
    expect(nextHeroSet(shown, ["new", "a", "b"], "Discover", 2)).toEqual({
      ids: ["new", "a", "b"],
      tab: "Discover",
      focus: 2,
    });
  });

  it("takes a new tab's set once its own answer arrives, not the previous tab's placeholder", () => {
    expect(nextHeroSet(shown, ["a", "b"], null, 1)).toBeNull();
    expect(nextHeroSet(shown, ["w1", "w2"], "Werewolf", 1)?.ids).toEqual(["w1", "w2"]);
  });

  it("takes the first stories published into an empty tab", () => {
    const empty: HeroSet = { ids: [], tab: "Discover", focus: 1 };
    expect(nextHeroSet(empty, ["a"], "Discover", 1)?.ids).toEqual(["a"]);
    expect(nextHeroSet(empty, [], "Discover", 1)).toBeNull();
  });
});

describe("heroBooks", () => {
  it("shows the current rows, so an edit shows at once and an unpublished story leaves", () => {
    const rows = [book("a", "Edited"), book("c")];
    expect(heroBooks(["a", "b", "c"], rows).map((row) => row.title)).toEqual(["Edited", "Title c"]);
  });
});

describe("settlePage", () => {
  it("goes to the nearest page after a slow drag", () => {
    expect(settlePage(1, 1.6, 0.2, 5)).toBe(2);
    expect(settlePage(1, 1.3, 0.2, 5)).toBe(1);
  });

  it("goes the way it was flicked, however short the drag", () => {
    expect(settlePage(1, 1.1, 3, 5)).toBe(2);
    expect(settlePage(1, 0.9, -3, 5)).toBe(0);
  });

  it("never moves more than one page from where the drag started", () => {
    expect(settlePage(1, 2.8, 5, 5)).toBe(2);
    expect(settlePage(3, 1.2, -5, 5)).toBe(2);
  });

  it("reaches the copies either end of the track, and no further", () => {
    expect(settlePage(4, 4.6, 3, 5)).toBe(5);
    expect(settlePage(0, -0.4, -3, 5)).toBe(-1);
    expect(settlePage(5, 5.2, 3, 5)).toBe(5);
  });
});

describe("wrapPage", () => {
  it("turns the copies back into the real pages they show", () => {
    expect(wrapPage(5, 5)).toBe(0);
    expect(wrapPage(-1, 5)).toBe(4);
    expect(wrapPage(2, 5)).toBe(2);
    expect(wrapPage(3, 0)).toBe(0);
  });
});
