/// <reference types="jest" />

import { chapterStateFor, lockStateFor, resolveChapterState, type LockableChapter } from "@/types/states";

// The one lock rule (prompt 22 step 6): free by access, free by position,
// unlocked, subscribed, and "can't tell yet" while the unlocks or the
// entitlement load.

const FREE_AT_START = 3;
const NONE: ReadonlySet<string> = new Set();

function chapter(number: number, access: LockableChapter["access"] = "locked"): LockableChapter {
  return { id: `chapter-${number}`, number, access };
}

describe("resolveChapterState", () => {
  const base = { access: "locked", chapterNumber: 9, freeChaptersAtStart: FREE_AT_START } as const;

  it("opens a chapter free by access, free by position, unlocked or subscribed", () => {
    expect(resolveChapterState({ ...base, access: "free" }).kind).toBe("unlocked");
    expect(resolveChapterState({ ...base, chapterNumber: 3 }).kind).toBe("unlocked");
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
    const inputs = { freeChaptersAtStart: FREE_AT_START, unlockedChapterIds: new Set(["chapter-1"]), isSubscribed: true };
    expect(chapterStateFor(chapter(1, null), inputs).kind).toBe("locked");
  });

  it("opens every chapter for a subscriber", () => {
    const inputs = { freeChaptersAtStart: FREE_AT_START, unlockedChapterIds: NONE, isSubscribed: true };
    expect([4, 20, 200].map((number) => chapterStateFor(chapter(number), inputs).kind)).toEqual([
      "unlocked",
      "unlocked",
      "unlocked",
    ]);
  });
});

describe("lockStateFor", () => {
  it("opens a chapter free by access or by position without waiting for anything", () => {
    expect(lockStateFor(chapter(9, "free"), FREE_AT_START, undefined, undefined)?.kind).toBe("unlocked");
    expect(lockStateFor(chapter(2), FREE_AT_START, undefined, undefined)?.kind).toBe("unlocked");
  });

  it("opens an unlocked chapter, even while the subscription is unknown", () => {
    expect(lockStateFor(chapter(9), FREE_AT_START, new Set(["chapter-9"]), undefined)?.kind).toBe("unlocked");
    expect(lockStateFor(chapter(9), FREE_AT_START, new Set(["chapter-9"]), false)?.kind).toBe("unlocked");
  });

  it("opens every chapter for a subscriber, even while the unlocks are unknown", () => {
    expect(lockStateFor(chapter(9), FREE_AT_START, undefined, true)?.kind).toBe("unlocked");
    expect(lockStateFor(chapter(9), FREE_AT_START, NONE, true)?.kind).toBe("unlocked");
  });

  it("can't tell while the subscription is unknown: never locked, so no paywall flashes", () => {
    expect(lockStateFor(chapter(9), FREE_AT_START, NONE, undefined)).toBeNull();
  });

  it("can't tell while the unlocks are unknown", () => {
    expect(lockStateFor(chapter(9), FREE_AT_START, undefined, false)).toBeNull();
  });

  it("locks once both are known and neither opens it", () => {
    expect(lockStateFor(chapter(9), FREE_AT_START, NONE, false)?.kind).toBe("locked");
    expect(lockStateFor(chapter(9), FREE_AT_START, new Set(["chapter-8"]), false)?.kind).toBe("locked");
  });

  it("keeps a null access locked once everything is known, subscribed or not", () => {
    expect(lockStateFor(chapter(1, null), FREE_AT_START, NONE, true)?.kind).toBe("locked");
    expect(lockStateFor(chapter(1, null), FREE_AT_START, undefined, undefined)).toBeNull();
  });
});
