import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

import { formatDuration, formatDurationSpoken } from "@/lib/format";
import { colors } from "@/theme";

/** Measured from material/8.png. */
const TRACK_HEIGHT = 4;
const THUMB_SIZE = 14;
/** The scrubber's own height, `h-6`. With the slop above and below, a 44dp target. */
const HIT_HEIGHT = 24;
const HIT_SLOP = 10;

/** Where along the track `x` falls, from 0 to 1. */
function fractionAt(x: number, width: number): number {
  "worklet";
  if (width <= 0) return 0;
  return Math.min(1, Math.max(0, x / width));
}

type PlayerScrubberProps = {
  elapsed: number;
  /** Null when the narration was never measured: no fill, no thumb, no dragging. */
  durationSeconds: number | null;
  onSeek: (seconds: number) => void;
  /** The same 15-second skips as the transport: the screen reader's decrement and increment. */
  onSkipBack: () => void;
  onSkipForward: () => void;
  /** Layout classes only. */
  className?: string;
};

/**
 * M6's scrub bar — prompt 17 step 7. A 4dp `surface` track with an ember fill
 * and a 14dp ember thumb (progress bars are exempt from the one-ember rule),
 * built from gesture-handler and Reanimated: no slider library draws this
 * track on Android. The fill and thumb follow a drag on the UI thread; the
 * seek lands when the finger lifts, and a tap seeks too.
 *
 * With an unknown duration the track stays empty and dragging is off. Elapsed
 * still counts, the right-hand label reads "Duration unknown", and the skips
 * still work. Never "0:00", never a full bar, never a zero-length one.
 *
 * Screen readers get an adjustable control whose increment and decrement are
 * the 15-second skips, so it is operable without dragging.
 */
export function PlayerScrubber({
  elapsed,
  durationSeconds,
  onSeek,
  onSkipBack,
  onSkipForward,
  className = "",
}: PlayerScrubberProps) {
  const duration = durationSeconds;
  // The elapsed label follows a drag, whole seconds only, before the seek lands.
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? elapsed;

  const trackWidth = useSharedValue(0);
  const dragging = useSharedValue(false);
  const dragFraction = useSharedValue(0);
  const lastPreview = useSharedValue(-1);
  const fraction = duration === null ? 0 : Math.min(1, elapsed / duration);
  const progress = useSharedValue(fraction);

  useEffect(() => {
    progress.set(fraction);
  }, [fraction, progress]);

  const secondsAt = (at: number) => {
    "worklet";
    return duration === null ? 0 : Math.round(at * duration);
  };

  const follow = (x: number) => {
    "worklet";
    const at = fractionAt(x, trackWidth.get());
    dragFraction.set(at);
    const seconds = secondsAt(at);
    if (seconds === lastPreview.get()) return;
    lastPreview.set(seconds);
    scheduleOnRN(setPreview, seconds);
  };

  // No minimum distance, so a tap seeks as well as a drag.
  const pan = Gesture.Pan()
    .enabled(duration !== null)
    .minDistance(0)
    .hitSlop({ vertical: HIT_SLOP })
    .onStart((event) => {
      dragging.set(true);
      follow(event.x);
    })
    .onUpdate((event) => {
      follow(event.x);
    })
    .onEnd((_event, success) => {
      if (!success) return;
      // Holds the thumb where it was dropped until the seek comes back.
      progress.set(dragFraction.get());
      scheduleOnRN(onSeek, secondsAt(dragFraction.get()));
    })
    .onFinalize(() => {
      dragging.set(false);
      lastPreview.set(-1);
      scheduleOnRN(setPreview, null);
    });

  // Width and position are runtime values — AGENTS.md § Style Exception Rules.
  const fillStyle = useAnimatedStyle(() => ({
    width: (dragging.get() ? dragFraction.get() : progress.get()) * trackWidth.get(),
  }));
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          (dragging.get() ? dragFraction.get() : progress.get()) * trackWidth.get() - THUMB_SIZE / 2,
      },
    ],
  }));

  const spokenValue =
    duration === null
      ? `${formatDurationSpoken(shown)}, duration unknown`
      : `${formatDurationSpoken(shown)} of ${formatDurationSpoken(duration)}`;
  const remaining =
    duration === null ? formatDuration(null) : `-${formatDuration(duration - Math.floor(shown))}`;

  return (
    <View className={`px-6 ${className}`}>
      <GestureDetector gesture={pan}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Playback position"
          accessibilityValue={{ text: spokenValue }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") onSkipForward();
            else if (event.nativeEvent.actionName === "decrement") onSkipBack();
          }}
          onLayout={(event) => trackWidth.set(event.nativeEvent.layout.width)}
          className="h-6 justify-center"
        >
          <View className="h-1 rounded-pill bg-surface" />
          {duration === null ? null : (
            <>
              <Animated.View style={[styles.fill, fillStyle]} />
              <Animated.View style={[styles.thumb, thumbStyle]} />
            </>
          )}
        </View>
      </GestureDetector>

      {/* The times are in the scrubber's spoken value, so a screen reader
          skips them here. */}
      <View className="mt-0.5 flex-row items-start">
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          className="font-ui text-muted flex-1 text-sm leading-5"
          style={styles.tabular}
          maxFontSizeMultiplier={1.3}
        >
          {formatDuration(shown)}
        </Text>
        {/* STATIC — made truthful by prompt 18. */}
        <Text
          className="font-ui-semibold text-teal px-2 text-center text-sm leading-5"
          maxFontSizeMultiplier={1.3}
        >
          Shared Bookmark
        </Text>
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          className="font-ui text-muted flex-1 text-right text-sm leading-5"
          style={styles.tabular}
          maxFontSizeMultiplier={1.3}
        >
          {remaining}
        </Text>
      </View>
    </View>
  );
}

/** Loading — the empty track and the labels' height, so nothing moves when the chapter arrives. */
export function ScrubberSkeleton({ className = "" }: { className?: string }) {
  return (
    <View className={`px-6 ${className}`}>
      <View className="h-6 justify-center">
        <View className="h-1 rounded-pill bg-surface" />
      </View>
      <View className="mt-0.5 h-5" />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    left: 0,
    top: (HIT_HEIGHT - TRACK_HEIGHT) / 2,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: colors.ember,
  },
  thumb: {
    position: "absolute",
    left: 0,
    top: (HIT_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.ember,
  },
  // Digits of one width, so the times don't jitter as they count.
  tabular: { fontVariant: ["tabular-nums"] },
});
