/// <reference types="jest" />

import {
  askServerAboutPlan,
  chapterStateFor,
  lockStateFor,
  openedByPlan,
  resolveChapterState,
  textWithheld,
  type LockableChapter,
} from "@/types/states";

// The one lock rule (prompt 22 step 6): free by the chapter's own access,
// unlocked, subscribed, and "can't tell yet" while the unlocks or the
// entitlement load. Never free by position (owner, 2026-09-30).

const NONE: ReadonlySet<string> = new Set();

function chapter(number: number, access: LockableChapter["access"] = "locked"): LockableChapter {
  return { id: `chapter-${number}`, number, access };
}

describe("resolveChapterState", () => {
  const base = { access: "locked" } as const;

  it("opens a chapter free by access, unlocked or subscribed", () => {
    expect(resolveChapterState({ ...base, access: "free" }).kind).toBe("unlocked");
    expect(resolveChapterState({ ...base, isUnlockedByUser: true }).kind).toBe("unlocked");
    expect(resolveChapterState({ ...base, isSubscribed: true }).kind).toBe("unlocked");
  });

  it("locks everything else, and a locked chapter is never Reading or Downloaded", () => {
    expect(resolveChapterState(base).kind).toBe("locked");
    expect(resolveChapterState({ ...base, isCurrentlyReading: true, isDownloaded: true }).kind).toBe("locked");
  });

  it("lets Reading beat Downloaded on an open chapter", () => {
    expect(resolveChapterState({ ...base, isSubscribed: true, isCurrentlyReading: true, isDownloaded: true }).kind).toBe(
      "reading",
    );
    expect(resolveChapterState({ ...base, isSubscribed: true, isDownloaded: true }).kind).toBe("downloaded");
  });
});

describe("chapterStateFor", () => {
  it("treats a null access as locked, whatever opens other chapters", () => {
    const inputs = { unlockedChapterIds: new Set(["chapter-1"]), isSubscribed: true };
    expect(chapterStateFor(chapter(1, null), inputs).kind).toBe("locked");
  });

  it("opens every chapter for a subscriber", () => {
    const inputs = { unlockedChapterIds: NONE, isSubscribed: true };
    expect([4, 20, 200].map((number) => chapterStateFor(chapter(number), inputs).kind)).toEqual([
      "unlocked",
      "unlocked",
      "unlocked",
    ]);
  });
});

describe("openedByPlan", () => {
  it("marks a chapter the dashboard locked that only the subscription opens", () => {
    expect(openedByPlan(chapter(4), { unlockedChapterIds: NONE, isSubscribed: true })).toBe(true);
  });

  it("never marks a free chapter, one unlocked on its own, a reader without the plan, or a null access", () => {
    expect(openedByPlan(chapter(4, "free"), { unlockedChapterIds: NONE, isSubscribed: true })).toBe(false);
    expect(openedByPlan(chapter(4), { unlockedChapterIds: new Set(["chapter-4"]), isSubscribed: true })).toBe(false);
    expect(openedByPlan(chapter(4), { unlockedChapterIds: NONE, isSubscribed: false })).toBe(false);
    expect(openedByPlan(chapter(4, null), { unlockedChapterIds: NONE, isSubscribed: true })).toBe(false);
  });
});

// Prompt 22a step 8: a refusal from the server is worth asking it about the
// plan only for a chapter the plan alone opens, once per open.
describe("askServerAboutPlan", () => {
  const subscribed = { unlockedChapterIds: NONE, isSubscribed: true };

  it("asks for a chapter only the subscription opens, not yet asked this open", () => {
    expect(askServerAboutPlan(chapter(4), subscribed, false)).toBe(true);
  });

  it("asks once per open", () => {
    expect(askServerAboutPlan(chapter(4), subscribed, true)).toBe(false);
  });

  it("never asks about a free chapter, one unlocked on its own, or a reader without the plan", () => {
    expect(askServerAboutPlan(chapter(4, "free"), subscribed, false)).toBe(false);
    expect(askServerAboutPlan(chapter(4), { unlockedChapterIds: new Set(["chapter-4"]), isSubscribed: true }, false)).toBe(
      false,
    );
    expect(askServerAboutPlan(chapter(4), { unlockedChapterIds: NONE, isSubscribed: false }, false)).toBe(false);
  });

  it("never asks while the unlocks or the entitlement aren't known", () => {
    expect(askServerAboutPlan(chapter(4), null, false)).toBe(false);
  });
});

describe("textWithheld", () => {
  it("is a read with no text for a chapter whose row says it has some", () => {
    expect(textWithheld(true, null)).toBe(true);
  });

  it("is never a read not answered yet, a chapter without text, or text that came", () => {
    expect(textWithheld(true, undefined)).toBe(false);
    expect(textWithheld(false, null)).toBe(false);
    expect(textWithheld(null, null)).toBe(false);
    expect(textWithheld(true, "Once upon a time.")).toBe(false);
    // Whitespace is the chapter's own text, shown as "no text" as before.
    expect(textWithheld(true, "  ")).toBe(false);
  });
});

describe("lockStateFor", () => {
  it("opens a chapter free by access without waiting for anything", () => {
    expect(lockStateFor(chapter(9, "free"), undefined, undefined)?.kind).toBe("unlocked");
  });

  it("locks a chapter at the start of a book the owner locked: its number never opens it", () => {
    expect(lockStateFor(chapter(1), NONE, false)?.kind).toBe("locked");
    expect(lockStateFor(chapter(2), NONE, false)?.kind).toBe("locked");
    expect(lockStateFor(chapter(2), undefined, undefined)).toBeNull();
  });

  it("opens an unlocked chapter, even while the subscription is unknown", () => {
    expect(lockStateFor(chapter(9), new Set(["chapter-9"]), undefined)?.kind).toBe("unlocked");
    expect(lockStateFor(chapter(9), new Set(["chapter-9"]), false)?.kind).toBe("unlocked");
  });

  it("opens every chapter for a subscriber, even while the unlocks are unknown", () => {
    expect(lockStateFor(chapter(9), undefined, true)?.kind).toBe("unlocked");
    expect(lockStateFor(chapter(9), NONE, true)?.kind).toBe("unlocked");
  });

  it("can't tell while the subscription is unknown: never locked, so no paywall flashes", () => {
    expect(lockStateFor(chapter(9), NONE, undefined)).toBeNull();
  });

  it("can't tell while the unlocks are unknown", () => {
    expect(lockStateFor(chapter(9), undefined, false)).toBeNull();
  });

  it("locks once both are known and neither opens it", () => {
    expect(lockStateFor(chapter(9), NONE, false)?.kind).toBe("locked");
    expect(lockStateFor(chapter(9), new Set(["chapter-8"]), false)?.kind).toBe("locked");
  });

  it("keeps a null access locked once everything is known, subscribed or not", () => {
    expect(lockStateFor(chapter(1, null), NONE, true)?.kind).toBe("locked");
    expect(lockStateFor(chapter(1, null), undefined, undefined)).toBeNull();
  });
});
