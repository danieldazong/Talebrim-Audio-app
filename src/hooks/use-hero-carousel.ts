import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { useIsForeground } from "@/hooks/use-is-foreground";
import { useReduceMotionEnabled } from "@/hooks/use-reduce-motion-enabled";
import { useScreenReaderEnabled } from "@/hooks/use-screen-reader-enabled";
import { NO_HERO_SET, heroBooks, newestHeroIds, nextHeroSet, refocusChangesHeroSet } from "@/lib/hero";
import type { CarouselBookRow } from "@/types/catalog";

/**
 * The hero's stories for one tab: its five newest. The set holds while
 * Discover is on screen and changes when the tab's own answer arrives or
 * Discover regains focus, so a story published meanwhile never swaps a slide
 * under the reader's finger (`nextHeroSet()`). Edits to the stories on screen
 * still show at once.
 *
 * Regaining focus renders Discover again only when it brings a different set
 * (`refocusChangesHeroSet()`). Rendering the whole screen on every return made
 * each tab switch to Discover wait for it.
 *
 * `tab` is null while the list is the previous tab's placeholder.
 */
export function useHeroBooks(books: readonly CarouselBookRow[], tab: string | null): CarouselBookRow[] {
  const [focus, setFocus] = useState(0);
  const [shown, setShown] = useState(NO_HERO_SET);
  const latestIds = newestHeroIds(books);

  // The focus effect runs without a render of its own, so it reads the last
  // render's values from here.
  const current = useRef({ shown, latestIds, tab });
  useLayoutEffect(() => {
    current.current = { shown, latestIds, tab };
  });
  useFocusEffect(
    useCallback(() => {
      const last = current.current;
      if (refocusChangesHeroSet(last.shown, last.latestIds, last.tab)) setFocus((count) => count + 1);
    }, []),
  );

  const next = nextHeroSet(shown, latestIds, tab, focus);
  if (next !== null) setShown(next);

  return heroBooks(next?.ids ?? shown.ids, books);
}

/**
 * Whether the hero may move on its own, apart from Discover being on screen:
 * the app in the foreground, and neither Reduce Motion nor a screen reader on.
 * Moving content must be pausable (WCAG 2.2.2); the carousel also pauses
 * under a finger and stops once the reader swipes.
 *
 * Being on screen is left to the carousel's timer, which follows focus
 * events rather than state: leaving or returning to Discover re-renders
 * nothing, so a tab switch never waits on the carousel.
 */
export function useHeroMayAdvance(): boolean {
  const navigation = useNavigation();
  const isForeground = useIsForeground();
  const reduceMotion = useReduceMotionEnabled();
  const screenReader = useScreenReaderEnabled();

  // Why it holds still, for whoever is testing: each reason is correct
  // behaviour, and none of them shows on screen.
  useEffect(() => {
    if (!__DEV__ || !navigation.isFocused()) return;
    const reasons = [
      isForeground ? null : "the app is in the background",
      reduceMotion ? "Reduce Motion is on" : null,
      screenReader ? "a screen reader is on" : null,
    ].filter((reason) => reason !== null);
    if (reasons.length > 0) console.log("[hero] not moving on its own:", reasons.join(", "));
  }, [navigation, isForeground, reduceMotion, screenReader]);

  return isForeground && !reduceMotion && !screenReader;
}
