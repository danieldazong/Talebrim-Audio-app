// Every way into M5a and M10, out of them to the chapter, and M5a's words —
// prompt 22. No React, no hooks, no JSX (AGENTS.md § lib/).
import { router } from "expo-router";

import type { ParitySourceMode } from "@/store/parity-store";

/** Where M5a was opened from: analytics' `from` on `paywall_shown`. */
export const PAYWALL_FROM = ["reader_end", "player", "book", "chapter_list", "continue", "locked_screen", "updates"] as const;
export type PaywallFrom = (typeof PAYWALL_FROM)[number];

export function isPaywallFrom(value: unknown): value is PaywallFrom {
  return PAYWALL_FROM.some((from) => from === value);
}

/**
 * Where M10 was opened from: analytics' `from` on `subscription_viewed`.
 * `paywall` is M5a's "See plans", which carries its chapter; the others carry
 * none.
 */
export const SUBSCRIPTION_FROM = ["paywall", "chapter_list", "profile_upsell", "profile_manage"] as const;
export type SubscriptionFrom = (typeof SUBSCRIPTION_FROM)[number];

export function isSubscriptionFrom(value: unknown): value is SubscriptionFrom {
  return SUBSCRIPTION_FROM.some((from) => from === value);
}

/** M10 from a screen with no chapter (M9's bar, M11). Pushed, so back returns there. */
export function openPlans(from: Exclude<SubscriptionFrom, "paywall">): void {
  router.push({ pathname: "/subscription", params: { source: from } });
}

/** M5a's words for a locked chapter. */
export type PaywallLines = {
  /** "Keep reading {story}", or "Keep listening to {story}" from the player. */
  headline: string;
  /** "Chapter 4: The Pact", beside a lock. */
  chapter: string;
  /** The same as screen readers hear it: "Chapter 4, The Pact, is locked." */
  chapterSpoken: string;
};

/**
 * Sells the story the reader is in, in the mode the tap was going to
 * (Decisions — 2026-10-01, "The paywall for a first visit"). Without the
 * story's title (not loaded, or failed), the chapter is the headline, as
 * before.
 */
export function paywallLines(
  mode: ParitySourceMode,
  bookTitle: string | null,
  chapter: { number: number; title: string | null },
): PaywallLines {
  const title = chapter.title?.trim() || null;
  const name = title ? `Chapter ${chapter.number}: ${title}` : `Chapter ${chapter.number}`;
  const spoken = title ? `Chapter ${chapter.number}, ${title}, is locked.` : `Chapter ${chapter.number} is locked.`;
  const story = bookTitle?.trim() || null;
  if (story === null) return { headline: name, chapter: "Locked", chapterSpoken: spoken };
  return {
    headline: mode === "audio" ? `Keep listening to ${story}` : `Keep reading ${story}`,
    chapter: name,
    chapterSpoken: spoken,
  };
}

export function isParityMode(value: unknown): value is ParitySourceMode {
  return value === "text" || value === "audio";
}

/**
 * Opens M5a over the current screen for a locked chapter. `mode` is where the
 * tap was going: the reader for "text", the player for "audio". Pushed, so
 * back returns where it was. The sheet checks the lock itself, and a chapter
 * that turns out open is shown instead.
 */
export function openPaywall(chapterId: string, mode: ParitySourceMode, from: PaywallFrom): void {
  router.push({ pathname: "/paywall/[chapterId]", params: { chapterId, mode, from } });
}

/**
 * The chapter, once it opens: replaces M5a or M10, so back from the chapter
 * returns where the paywall was opened. M5 or M6 restores the chapter's saved
 * place itself. From a chapter's own locked screen, that screen is the
 * chapter and opens by itself, so this only goes back to it: never a second
 * copy of it on the stack.
 */
export function openUnlockedChapter(chapterId: string, mode: ParitySourceMode, from: PaywallFrom | null): void {
  if (from === "locked_screen" && router.canGoBack()) {
    router.back();
    return;
  }
  router.replace({
    pathname: mode === "audio" ? "/player/[chapterId]" : "/reader/[chapterId]",
    params: { chapterId },
  });
}
