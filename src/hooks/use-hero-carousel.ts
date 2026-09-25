import { useFocusEffect, useIsFocused } from "expo-router";
import { useCallback, useEffect, useState } from "react";

import { useIsForeground } from "@/hooks/use-is-foreground";
import { useReduceMotionEnabled } from "@/hooks/use-reduce-motion-enabled";
import { useScreenReaderEnabled } from "@/hooks/use-screen-reader-enabled";
import { NO_HERO_SET, heroBooks, newestHeroIds, nextHeroSet } from "@/lib/hero";
import type { CarouselBookRow } from "@/types/catalog";

/**
 * The hero's stories for one tab: its five newest. The set holds while
 * Discover is on screen and changes when the tab's own answer arrives or
 * Discover regains focus, so a story published meanwhile never swaps a slide
 * under the reader's finger (`nextHeroSet()`). Edits to the stories on screen
 * still show at once.
 *
 * `tab` is null while the list is the previous tab's placeholder.
 */
export function useHeroBooks(books: readonly CarouselBookRow[], tab: string | null): CarouselBookRow[] {
  const [focus, setFocus] = useState(0);
  useFocusEffect(useCallback(() => setFocus((count) => count + 1), []));

  const [shown, setShown] = useState(NO_HERO_SET);
  const next = nextHeroSet(shown, newestHeroIds(books), tab, focus);
  if (next !== null) setShown(next);

  return heroBooks(next?.ids ?? shown.ids, books);
}

/**
 * Whether the hero may move on its own: only while Discover is on screen and
 * the app in the foreground, and never with Reduce Motion or a screen reader
 * on. Moving content must be pausable (WCAG 2.2.2); the carousel also pauses
 * under a finger and stops once the reader swipes.
 */
export function useHeroAutoAdvance(): boolean {
  const isFocused = useIsFocused();
  const isForeground = useIsForeground();
  const reduceMotion = useReduceMotionEnabled();
  const screenReader = useScreenReaderEnabled();

  // Why it holds still, for whoever is testing: each reason is correct
  // behaviour, and none of them shows on screen.
  useEffect(() => {
    if (!__DEV__ || !isFocused) return;
    const reasons = [
      isForeground ? null : "the app is in the background",
      reduceMotion ? "Reduce Motion is on" : null,
      screenReader ? "a screen reader is on" : null,
    ].filter((reason) => reason !== null);
    if (reasons.length > 0) console.log("[hero] not moving on its own:", reasons.join(", "));
  }, [isFocused, isForeground, reduceMotion, screenReader]);

  return isFocused && isForeground && !reduceMotion && !screenReader;
}
