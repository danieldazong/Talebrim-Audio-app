import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { colors } from "@/theme";

// M9's non-list states — prompt 20 step 12. All on `bg`, below the header,
// which stays mounted so Back always works. Never a spinner, an alert or a
// toast. Not available reuses M4's `BookNotFound`.

const SKELETON_ROWS = Array.from({ length: 10 }, (_, index) => index);
const TITLE_WIDTHS = ["w-3/5", "w-1/2", "w-2/3", "w-7/12"];

/** Loading — rows shaped like the real ones, at their real height. */
export function ChapterRowsSkeleton({ rowHeight }: { rowHeight: number }) {
  return (
    <View
      accessible
      accessibilityLabel="Loading chapters"
      accessibilityState={{ busy: true }}
      className="flex-1 overflow-hidden"
    >
      {SKELETON_ROWS.map((index) => (
        <View key={index} className="justify-center gap-2.5 px-4" style={{ height: rowHeight }}>
          <View className={`h-3.5 rounded-pill bg-surface ${TITLE_WIDTHS[index % TITLE_WIDTHS.length]}`} />
          <View className="h-3 w-24 rounded-pill bg-surface" />
          <View className="absolute bottom-0 left-4 right-4 h-px bg-raised" />
        </View>
      ))}
    </View>
  );
}

type Message = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  caption: string;
};

type MessageStatus = "offline" | "failed" | "empty";

const MESSAGES: Record<MessageStatus, Message> = {
  offline: {
    icon: "cloud-offline-outline",
    message: "You're offline.",
    caption: "This story's chapters aren't saved on this device yet. They'll load when you reconnect.",
  },
  failed: {
    icon: "alert-circle-outline",
    message: "We couldn't load the chapters.",
    caption: "Check your connection and try again.",
  },
  empty: {
    icon: "book-outline",
    message: "No chapters yet",
    caption: "New chapters appear here as soon as they're published.",
  },
};

type ChapterListMessageProps = {
  status: MessageStatus;
  onRetry: () => void;
};

/** Offline (queries resume on their own), failed (Retry) and empty. */
export function ChapterListMessage({ status, onRetry }: ChapterListMessageProps) {
  const { icon, message, caption } = MESSAGES[status];

  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {message}
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        {caption}
      </Text>
      {status === "failed" ? <Button label="Retry" variant="secondary" className="mt-2" onPress={onRetry} /> : null}
    </View>
  );
}
