import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors } from "@/theme";
import type { PlayerStatus } from "@/types/states";

// M6's non-playing states — prompt 17 step 11. All on the gradient, below the
// header and whichever metadata lines are known. The copy matches M5's where
// the meaning matches. Never a spinner, an alert or a toast.

type MessageStatus = Exclude<PlayerStatus, "ready" | "loading">;

type Message = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  caption: string | null;
};

function messageFor(status: MessageStatus, chapterNumber: number | null): Message {
  switch (status) {
    case "failed":
      return {
        icon: "alert-circle-outline",
        message: "We couldn't load this chapter.",
        caption: "Check your connection and try again.",
      };
    case "offline":
      return {
        icon: "cloud-offline-outline",
        message: "You're offline.",
        caption: "This chapter isn't saved on this device yet. It will open when you reconnect.",
      };
    case "unavailable":
      return {
        icon: "book-outline",
        message: "This chapter isn't available.",
        caption: "It may have been taken down, or the link is out of date.",
      };
    case "no-audio":
      return {
        icon: "volume-mute-outline",
        message: "This chapter has no narration yet.",
        caption: "You can read it instead.",
      };
    case "locked":
      return {
        icon: "lock-closed-outline",
        message: chapterNumber === null ? "This chapter is locked." : `Chapter ${chapterNumber} is locked.`,
        caption: null,
      };
  }
}

type PlayerStateMessageProps = {
  status: MessageStatus;
  chapterNumber: number | null;
  onRetry: () => void;
  onBack: () => void;
  onRead: () => void;
};

/**
 * Failed (Retry), offline (none: queries resume on their own), not available
 * (Go back), no audio (Read instead) and locked (where the paywall will open).
 */
export function PlayerStateMessage({ status, chapterNumber, onRetry, onBack, onRead }: PlayerStateMessageProps) {
  const { icon, message, caption } = messageFor(status, chapterNumber);

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {message}
      </Text>
      {caption ? (
        <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
          {caption}
        </Text>
      ) : null}
      {status === "failed" ? (
        <Button label="Retry" variant="outlined" className="mt-2" onPress={onRetry} />
      ) : null}
      {status === "unavailable" ? (
        <Button label="Go back" variant="outlined" className="mt-2" onPress={onBack} />
      ) : null}
      {status === "no-audio" ? (
        <Button
          label="Read instead"
          variant="audio"
          icon={<Ionicons name="book" size={16} color={colors.teal} />}
          className="mt-2"
          onPress={onRead}
        />
      ) : null}
      {/* TODO(paywall): the locked state opens the M5a paywall sheet here
          (AGENTS.md M5a). This screen does not gate or check entitlement. */}
    </View>
  );
}
