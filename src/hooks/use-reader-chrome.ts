import { useEffect } from "react";
import type { LayoutChangeEvent } from "react-native";
import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { useScreenReaderEnabled } from "@/hooks/use-screen-reader-enabled";

/** Within this distance of either end of the chapter, the toolbar shows. */
const EDGE_DISTANCE = 24;
/** Scroll travel in one direction before the toolbar changes, so a jittery finger does not flicker it. */
const DIRECTION_TRAVEL = 12;
const HIDE_DURATION_MS = 200;

type UseReaderChromeInput = {
  /** Toolbar's distance from the bottom of the screen: its gap plus the safe-area inset. */
  bottomOffset: number;
  onDragStart: () => void;
  /** Every scroll position, for the reading position's settle timer. */
  onScrollActivity: (y: number) => void;
};

/**
 * M5's scroll-driven chrome — prompt 14 steps 10, 13 and 14. Every scroll
 * event is handled on the UI thread, so the chapter never re-renders while
 * it scrolls:
 *
 * - The toolbar slides out on scroll down and returns on scroll up and at
 *   either end of the chapter. A tap on the page toggles it. 200ms timing,
 *   or no animation with reduce motion on. With a screen reader on it never
 *   hides.
 * - The progress bar follows the scroll.
 * - Each position is handed to the JavaScript thread, which records the
 *   reading position once the scroll settles. Only a timer reset runs
 *   there per event; nothing re-renders.
 */
export function useReaderChrome({ bottomOffset, onDragStart, onScrollActivity }: UseReaderChromeInput) {
  const reduceMotion = useReducedMotion();
  const screenReaderOn = useScreenReaderEnabled();

  const hidden = useSharedValue(0);
  const hiddenTarget = useSharedValue(0);
  const toolbarHeight = useSharedValue(0);
  const progress = useSharedValue(0);
  const lastY = useSharedValue(0);
  const travel = useSharedValue(0);
  // Only the reader's own scrolling hides the toolbar, never a restore.
  const userScrolling = useSharedValue(false);

  const setToolbarHidden = (next: boolean) => {
    "worklet";
    const target = next ? 1 : 0;
    if (hiddenTarget.get() === target) return;
    hiddenTarget.set(target);
    hidden.set(reduceMotion ? target : withTiming(target, { duration: HIDE_DURATION_MS }));
  };

  useEffect(() => {
    if (!screenReaderOn) return;
    hiddenTarget.set(0);
    hidden.set(0);
  }, [screenReaderOn, hidden, hiddenTarget]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const y = event.contentOffset.y;
      const maxY = event.contentSize.height - event.layoutMeasurement.height;
      progress.set(maxY > 0 ? Math.min(1, Math.max(0, y / maxY)) : 0);
      scheduleOnRN(onScrollActivity, y);

      const dy = y - lastY.get();
      lastY.set(y);

      if (screenReaderOn || y <= EDGE_DISTANCE || y >= maxY - EDGE_DISTANCE) {
        travel.set(0);
        setToolbarHidden(false);
        return;
      }
      if (!userScrolling.get()) return;

      const sameDirection = (dy > 0 && travel.get() > 0) || (dy < 0 && travel.get() < 0);
      travel.set(sameDirection ? travel.get() + dy : dy);
      if (travel.get() > DIRECTION_TRAVEL) setToolbarHidden(true);
      else if (travel.get() < -DIRECTION_TRAVEL) setToolbarHidden(false);
    },
    onBeginDrag: () => {
      userScrolling.set(true);
      scheduleOnRN(onDragStart);
    },
    onEndDrag: () => {
      userScrolling.set(false);
    },
    // iOS only. React Native enables Android momentum events only for a
    // JavaScript onMomentumScroll* prop, which a UI-thread handler is not —
    // which is also why the reading position waits for the scroll to settle
    // instead of trusting end events.
    onMomentumBegin: () => {
      userScrolling.set(true);
    },
    onMomentumEnd: () => {
      userScrolling.set(false);
    },
  });

  // Sliding down by its own height plus its bottom offset takes it off screen.
  const toolbarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hidden.get() * (toolbarHeight.get() + bottomOffset) }],
  }));

  // scaleX, not width: a transform skips layout on every frame.
  const progressStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.get() }],
  }));

  const onToolbarLayout = (event: LayoutChangeEvent) => {
    toolbarHeight.set(event.nativeEvent.layout.height);
  };

  /** A tap on the reading surface. */
  const toggleToolbar = () => {
    setToolbarHidden(!screenReaderOn && hiddenTarget.get() === 0);
  };

  return { scrollHandler, toolbarStyle, progressStyle, onToolbarLayout, toggleToolbar };
}
