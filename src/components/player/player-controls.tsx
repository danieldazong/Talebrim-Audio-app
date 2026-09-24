import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui";
import type { ShellPlaybackStatus } from "@/hooks/use-shell-playback";
import { formatSpeed } from "@/lib/format";
import { colors } from "@/theme";

/** Measured from material/8.png. */
const PLAY_SIZE = 72;

type IconName = keyof typeof Ionicons.glyphMap;

type TransportButtonProps = {
  icon: IconName;
  label: string;
  /** The "15" under a skip arrow. */
  caption?: string;
  disabled: boolean;
  onPress: () => void;
};

/** A `muted` transport control with a 44dp target. */
function TransportButton({ icon, label, caption, disabled, onPress }: TransportButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="min-h-11 w-11 items-center justify-center"
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={24} color={colors.muted} />
      {caption ? (
        <Text className="font-ui-semibold text-muted mt-0.5 text-[11px] leading-[14px]" maxFontSizeMultiplier={1.3}>
          {caption}
        </Text>
      ) : null}
    </Pressable>
  );
}

function playLabel(status: ShellPlaybackStatus): string {
  switch (status) {
    case "paused":
      return "Play";
    case "buffering":
      return "Buffering";
    case "playing":
      return "Pause";
  }
}

type PlayerTransportProps = {
  status: ShellPlaybackStatus;
  /** The loading state: the row drawn, nothing pressable. */
  disabled?: boolean;
  onTogglePlay: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  /** Null disables it: at either end of the book, or while the neighbours load. */
  onPrevious: (() => void) | null;
  onNext: (() => void) | null;
  /** Layout classes only. */
  className?: string;
};

/**
 * M6's transport row — prompt 17 step 8: back-15, previous, play/pause, next,
 * forward-15. Every control stays in place when disabled; the row's layout is
 * fixed.
 */
export function PlayerTransport({
  status,
  disabled = false,
  onTogglePlay,
  onSkipBack,
  onSkipForward,
  onPrevious,
  onNext,
  className = "",
}: PlayerTransportProps) {
  return (
    <View className={`flex-row items-center justify-between px-7 ${className}`}>
      <TransportButton
        icon="arrow-back"
        label="Skip back 15 seconds"
        caption="15"
        disabled={disabled}
        onPress={onSkipBack}
      />
      <TransportButton
        icon="play-skip-back"
        label="Previous chapter"
        disabled={disabled || onPrevious === null}
        onPress={() => onPrevious?.()}
      />

      {/* The screen's single ember action. Its glyph is ink, never white. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playLabel(status)}
        accessibilityState={{ disabled, busy: status === "buffering" }}
        disabled={disabled}
        onPress={onTogglePlay}
        className="items-center justify-center rounded-pill"
        // The pressed fill is a Pressable state — AGENTS.md § Style Exception Rules.
        style={({ pressed }) => ({
          width: PLAY_SIZE,
          height: PLAY_SIZE,
          backgroundColor: pressed ? colors.emberPressed : colors.ember,
          opacity: disabled ? 0.5 : 1,
        })}
      >
        {status === "buffering" ? (
          <ActivityIndicator size="small" color={colors.ink} />
        ) : (
          <Ionicons
            name={status === "playing" ? "pause" : "play"}
            size={30}
            color={colors.ink}
            // The play glyph's visual centre sits left of its box.
            style={status === "playing" ? undefined : { marginLeft: 3 }}
          />
        )}
      </Pressable>

      <TransportButton
        icon="play-skip-forward"
        label="Next chapter"
        disabled={disabled || onNext === null}
        onPress={() => onNext?.()}
      />
      <TransportButton
        icon="arrow-forward"
        label="Skip forward 15 seconds"
        caption="15"
        disabled={disabled}
        onPress={onSkipForward}
      />
    </View>
  );
}

type PlayerSecondaryControlsProps = {
  speed: number;
  /** Minutes left on the sleep timer, rounded up; null when it is off. */
  sleepMinutesLeft: number | null;
  onOpenSpeed: () => void;
  onOpenSleepTimer: () => void;
  onReadInstead: () => void;
  /** Layout classes only. */
  className?: string;
};

/**
 * M6's secondary row, all teal — prompt 17 step 9. It wraps at the largest
 * text sizes rather than running off the screen. "Read instead" stays on one
 * line: the frame's two-line wrap is a design defect.
 */
export function PlayerSecondaryControls({
  speed,
  sleepMinutesLeft,
  onOpenSpeed,
  onOpenSleepTimer,
  onReadInstead,
  className = "",
}: PlayerSecondaryControlsProps) {
  return (
    <View className={`flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 ${className}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Playback speed, ${formatSpeed(speed)} times`}
        onPress={onOpenSpeed}
        className="h-11 min-w-11 items-center justify-center px-2"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text className="font-ui-semibold text-teal text-base" maxFontSizeMultiplier={1.3}>
          {`${formatSpeed(speed)}x`}
        </Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          sleepMinutesLeft === null
            ? "Sleep timer"
            : `Sleep timer, ${sleepMinutesLeft} ${sleepMinutesLeft === 1 ? "minute" : "minutes"} left`
        }
        onPress={onOpenSleepTimer}
        className="h-11 flex-row items-center gap-2 px-2"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="moon-outline" size={20} color={colors.teal} />
        <Text className="font-ui-semibold text-teal text-base" maxFontSizeMultiplier={1.3}>
          {sleepMinutesLeft === null ? "Sleep timer" : `${sleepMinutesLeft} min`}
        </Text>
      </Pressable>

      <Button
        label="Read instead"
        variant="audio"
        icon={<Ionicons name="book" size={16} color={colors.teal} />}
        onPress={onReadInstead}
        className="h-11 px-4"
      />
    </View>
  );
}
