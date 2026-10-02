import { isPaywallFrom, isSubscriptionFrom, paywallLines } from "@/lib/paywall";

// `lib/paywall.ts` imports expo-router for its navigation helpers; nothing
// here navigates.
jest.mock("expo-router", () => ({ router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() } }));

const CHAPTER = { number: 4, title: "The Pact" };

describe("paywallLines", () => {
  it("sells the story in the mode the tap was going to", () => {
    expect(paywallLines("text", "Whispers In the Mist", CHAPTER).headline).toBe("Keep reading Whispers In the Mist");
    expect(paywallLines("audio", "Whispers In the Mist", CHAPTER).headline).toBe(
      "Keep listening to Whispers In the Mist",
    );
  });

  it("names the locked chapter, and says it is locked to screen readers", () => {
    const lines = paywallLines("text", "Whispers In the Mist", CHAPTER);
    expect(lines.chapter).toBe("Chapter 4: The Pact");
    expect(lines.chapterSpoken).toBe("Chapter 4, The Pact, is locked.");
  });

  it("names a chapter with no title by its number", () => {
    const lines = paywallLines("text", "Whispers In the Mist", { number: 4, title: null });
    expect(lines.chapter).toBe("Chapter 4");
    expect(lines.chapterSpoken).toBe("Chapter 4 is locked.");
    expect(paywallLines("text", "Whispers In the Mist", { number: 4, title: "  " }).chapter).toBe("Chapter 4");
  });

  it("falls back to the chapter as the headline while the story isn't known", () => {
    for (const title of [null, "", "  "]) {
      const lines = paywallLines("audio", title, CHAPTER);
      expect(lines.headline).toBe("Chapter 4: The Pact");
      expect(lines.chapter).toBe("Locked");
      expect(lines.chapterSpoken).toBe("Chapter 4, The Pact, is locked.");
    }
  });
});

describe("where M5a and M10 were opened from", () => {
  it("knows M10's sources, and nothing else", () => {
    for (const from of ["paywall", "chapter_list", "profile_upsell", "profile_manage"]) {
      expect(isSubscriptionFrom(from)).toBe(true);
    }
    for (const from of [undefined, null, "", "profile", "reader_end", ["paywall"]]) {
      expect(isSubscriptionFrom(from)).toBe(false);
    }
  });

  it("keeps M5a's own sources apart from M10's", () => {
    expect(isPaywallFrom("reader_end")).toBe(true);
    expect(isPaywallFrom("profile_upsell")).toBe(false);
  });
});
