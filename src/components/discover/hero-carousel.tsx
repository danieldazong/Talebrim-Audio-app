import { useEffect, useState } from "react";
import { useWindowDimensions, View, type AccessibilityActionEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { HeroCard } from "@/components/discover/hero-card";
import { resolveCoverUrl } from "@/lib/covers";
import { HERO_ADVANCE_MS, HERO_SETTLE_MS, HERO_SLIDE_MS, settlePage, wrapPage } from "@/lib/hero";
import { colors } from "@/theme";
import type { CarouselBookRow } from "@/types/catalog";

/** The timer's glide: a gentle start and a long, soft landing. */
const SLIDE_EASING = Easing.bezier(0.45, 0, 0.15, 1);
/** After a swipe the page is already moving, so it only eases to a stop. */
const SETTLE_EASING = Easing.out(Easing.cubic);
/** How far past either end a drag may pull, in pages. */
const DRAG_LIMIT = 0.15;
/** Horizontal travel before a drag counts as a swipe; vertical travel first leaves it to the page's scroll. */
const SWIPE_SLOP = 12;

const DOT_SIZE = 6;
const DOT_ACTIVE_WIDTH = 16;
/** `muted/40`, as the inactive dot was drawn before it animated. */
const DOT_IDLE_COLOR = `${colors.muted}66`;

/**
 * Slides the track to `target` (one of the copies included), then settles on
 * the real page it shows and reports it. Module-level, so it never changes
 * and the timer's effect can depend on what actually matters.
 */
function slideTo(
  position: SharedValue<number>,
  target: number,
  count: number,
  timing: WithTimingConfig,
  onLanded: (page: number) => void,
) {
  "worklet";
  position.set(
    withTiming(target, timing, (finished) => {
      if (!finished) return;
      const landed = wrapPage(target, count);
      // A copy looks exactly like the page it copies, so this jump is unseen.
      if (landed !== target) position.set(landed);
      scheduleOnRN(onLanded, landed);
    }),
  );
}

const SLIDE: WithTimingConfig = { duration: HERO_SLIDE_MS, easing: SLIDE_EASING };
const SETTLE: WithTimingConfig = { duration: HERO_SETTLE_MS, easing: SETTLE_EASING };

type HeroCarouselProps = {
  /** The tab's newest stories (`useHeroBooks()`), at most five. */
  books: CarouselBookRow[];
  publicCdnDomain: string | null;
  onPressBook: (id: string) => void;
  /** Discover on screen, the app in front, no Reduce Motion, no screen reader (`useHeroAutoAdvance()`). */
  autoAdvance: boolean;
};

/**
 * M3's hero as a carousel of the tab's newest stories. The pages sit side by
 * side on one track that Reanimated slides, so the timing is ours on every
 * platform: a scroll view's own paging animation is short and fixed, and a
 * browser's smooth scroll can't be timed at all.
 *
 * Every 7 seconds it glides to the next story over 700 ms, starting gently
 * and landing softly. From the last it carries on into the first: the track
 * holds a copy of the last page before the first and of the first after the
 * last, and jumps from a copy to the real page it shows once it lands, which
 * looks like nothing. No bounce, no parallax (AGENTS.md § UI Quality Bar).
 *
 * A finger on it pauses it, and a swipe stops it for good: the reader has
 * taken over. Swipes follow the finger and settle in 350 ms; vertical drags
 * are left to the page. The dots grow and brighten with the slide.
 *
 * Screen readers reach only the page on show, and step through the stories
 * with the dots, an adjustable control ("Newest stories, 2 of 5").
 *
 * One page shows at a time, so its "Read or Listen" stays the screen's one
 * visible ember action. One story: no track to slide, no dots. The parent
 * keys it by the set of stories, so a new set starts at the first.
 */
export function HeroCarousel({ books, publicCdnDomain, onPressBook, autoAdvance }: HeroCarouselProps) {
  const { width } = useWindowDimensions();
  const count = books.length;
  const loops = count > 1;
  // The looped track: the last page's copy, every page, then the first page's copy.
  const track = loops ? [books[count - 1], ...books, books[0]] : books;
  const lead = loops ? 1 : 0;

  // The settled page, 0 to count - 1. Moves once a slide lands.
  const [page, setPage] = useState(0);
  const [touching, setTouching] = useState(false);
  const [swiped, setSwiped] = useState(false);
  // Where the track is, in pages: -1 and `count` are the copies.
  const position = useSharedValue(0);
  const dragStart = useSharedValue(0);
  const running = autoAdvance && !touching && !swiped && loops;

  // A new timer after each landing, so every story gets its full 7 seconds.
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => slideTo(position, page + 1, count, SLIDE, setPage), HERO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [running, page, count, position]);

  const pan = Gesture.Pan()
    .enabled(loops)
    .activeOffsetX([-SWIPE_SLOP, SWIPE_SLOP])
    .failOffsetY([-SWIPE_SLOP, SWIPE_SLOP])
    // Down, before it moves: a resting finger pauses the timer.
    .onBegin(() => {
      scheduleOnRN(setTouching, true);
    })
    .onStart(() => {
      cancelAnimation(position);
      dragStart.set(position.get());
      scheduleOnRN(setSwiped, true);
    })
    .onUpdate((event) => {
      const dragged = dragStart.get() - event.translationX / width;
      position.set(Math.min(Math.max(dragged, -1 - DRAG_LIMIT), count + DRAG_LIMIT));
    })
    .onEnd((event) => {
      const target = settlePage(dragStart.get(), position.get(), -event.velocityX / width, count);
      slideTo(position, target, count, SETTLE, setPage);
    })
    .onFinalize(() => {
      scheduleOnRN(setTouching, false);
    });

  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(position.get() + lead) * width }],
  }));

  function onAccessibilityAction(event: AccessibilityActionEvent) {
    const step = event.nativeEvent.actionName === "increment" ? 1 : -1;
    slideTo(position, page + step, count, SETTLE, setPage);
  }

  return (
    <View>
      <GestureDetector gesture={pan}>
        <View style={{ width, overflow: "hidden" }}>
          <Animated.View style={[{ flexDirection: "row", width: width * track.length }, trackStyle]}>
            {track.map((book, slot) => {
              const onShow = slot - lead === page;
              return (
                <View
                  key={`${book.id ?? "hero"}-${slot}`}
                  style={{ width }}
                  // Only the page on show is read out; the copies never are.
                  accessibilityElementsHidden={!onShow}
                  importantForAccessibility={onShow ? "auto" : "no-hide-descendants"}
                >
                  <HeroCard
                    book={book}
                    coverUrl={publicCdnDomain === null ? null : resolveCoverUrl(publicCdnDomain, book.cover_path)}
                    onPress={onPressBook}
                  />
                </View>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>

      {loops ? (
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Newest stories"
          accessibilityValue={{ text: `${page + 1} of ${count}` }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={onAccessibilityAction}
          className="mt-3 flex-row items-center justify-center gap-1.5"
        >
          {books.map((book, dot) => (
            <HeroDot key={book.id ?? dot} dot={dot} count={count} position={position} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

type HeroDotProps = {
  dot: number;
  count: number;
  position: SharedValue<number>;
};

/** One dot: as wide and as bright as its page is on show, following the slide as it moves. */
function HeroDot({ dot, count, position }: HeroDotProps) {
  const style = useAnimatedStyle(() => {
    // Distance around the loop, so the last dot hands over to the first.
    const offset = Math.abs(position.get() - dot);
    const distance = Math.min(offset, Math.abs(offset - count));
    const shown = Math.max(0, 1 - distance);
    return {
      width: DOT_SIZE + (DOT_ACTIVE_WIDTH - DOT_SIZE) * shown,
      backgroundColor: interpolateColor(shown, [0, 1], [DOT_IDLE_COLOR, colors.body]),
    };
  });

  return <Animated.View style={[{ height: DOT_SIZE, borderRadius: DOT_SIZE / 2 }, style]} />;
}
