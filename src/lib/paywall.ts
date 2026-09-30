// Every way into M5a, and out of it to the chapter — prompt 22. Navigation
// only: no React, no hooks, no JSX (AGENTS.md § lib/).
import { router } from "expo-router";

import type { ParitySourceMode } from "@/store/parity-store";

/** Where M5a was opened from: analytics' `from` on `paywall_shown`. */
export const PAYWALL_FROM = ["reader_end", "player", "book", "chapter_list", "continue", "locked_screen", "updates"] as const;
export type PaywallFrom = (typeof PAYWALL_FROM)[number];

export function isPaywallFrom(value: unknown): value is PaywallFrom {
  return PAYWALL_FROM.some((from) => from === value);
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
