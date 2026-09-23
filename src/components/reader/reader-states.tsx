import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { ReaderPill } from "@/components/reader/reader-pill";
import type { ReaderPalette } from "@/components/reader/reader-theme";
import type { ReaderStatus } from "@/types/states";

// M5's non-reading states — prompt 14 step 18. Prompt 15 wires them to the
// queries and may not change them. Every one sits on the ACTIVE theme's
// page, inside the reader shell: never a spinner, an alert or a toast.

/** About twelve body lines of varying width, with a paragraph break after the sixth. */
const BODY_BARS = [
  "w-full",
  "w-11/12",
  "w-full",
  "w-10/12",
  "w-full",
  "w-2/5",
  null,
  "w-full",
  "w-11/12",
  "w-full",
  "w-9/12",
  "w-full",
  "w-3/5",
] as const;

type ReaderSkeletonProps = {
  palette: ReaderPalette;
  fontSize: number;
  lineSpacing: number;
};

/** Loading — shaped like the chapter it stands in for, at the body line height. */
export function ReaderSkeleton({ palette, fontSize, lineSpacing }: ReaderSkeletonProps) {
  const lineHeight = fontSize * lineSpacing;

  return (
    <View
      accessible
      accessibilityLabel="Loading chapter"
      accessibilityState={{ busy: true }}
      className="flex-1 overflow-hidden px-6 pt-5"
    >
      <View className={`h-3.5 w-24 rounded-pill ${palette.skeleton}`} />
      <View className={`mt-3 h-7 w-3/5 rounded-pill ${palette.skeleton}`} />
      <View className="mt-8">
        {BODY_BARS.map((width, index) => (
          <View key={index} className="justify-center" style={{ height: lineHeight }}>
            {width ? <View className={`h-3 rounded-pill ${width} ${palette.skeleton}`} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

type Message = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  caption: string | null;
};

function messageFor(status: Exclude<ReaderStatus, "ready" | "loading">, chapterNumber: number | null): Message {
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
        caption:
          "This chapter isn't saved on this device yet. It will open when you reconnect.",
      };
    case "unavailable":
      return {
        icon: "book-outline",
        message: "This chapter isn't available.",
        caption: "It may have been taken down, or the link is out of date.",
      };
    case "no-text":
      return {
        icon: "headset-outline",
        message: "This chapter has no text yet.",
        caption: "You can listen to it instead.",
      };
    case "locked":
      return {
        icon: "lock-closed-outline",
        message: chapterNumber === null ? "This chapter is locked." : `Chapter ${chapterNumber} is locked.`,
        caption: null,
      };
  }
}

type ReaderStateMessageProps = {
  status: Exclude<ReaderStatus, "ready" | "loading">;
  palette: ReaderPalette;
  chapterNumber: number | null;
  onRetry: () => void;
  onBack: () => void;
};

/**
 * Failed, offline, not available, no text and locked. Only Failed (Retry)
 * and Not available (Go back) carry a control: offline queries resume on
 * their own, no text uses the toolbar's Listen, and locked is where the
 * paywall will open.
 */
export function ReaderStateMessage({ status, palette, chapterNumber, onRetry, onBack }: ReaderStateMessageProps) {
  const { icon, message, caption } = messageFor(status, chapterNumber);

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={32} color={palette.colors.secondary} />
      <Text className={`font-ui text-center text-base ${palette.text}`} maxFontSizeMultiplier={1.5}>
        {message}
      </Text>
      {caption ? (
        <Text className={`font-ui text-center text-sm ${palette.secondary}`} maxFontSizeMultiplier={1.5}>
          {caption}
        </Text>
      ) : null}
      {status === "failed" ? (
        <ReaderPill label="Retry" palette={palette} onPress={onRetry} className="mt-2" />
      ) : null}
      {status === "unavailable" ? (
        <ReaderPill label="Go back" palette={palette} onPress={onBack} className="mt-2" />
      ) : null}
      {/* TODO(paywall): the locked state opens the M5a paywall sheet here
          (AGENTS.md M5a). This screen does not gate or check entitlement. */}
    </View>
  );
}
