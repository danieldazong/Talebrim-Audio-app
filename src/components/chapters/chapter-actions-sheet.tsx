import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { chapterRowActions, type ChapterListRow, type ChapterRowAction } from "@/lib/chapter-list";
import type { DownloadFailure } from "@/lib/downloads/queue";
import { colors, layout } from "@/theme";

/** Why one chapter failed, in the sheet's status line. */
const FAILURE_WORDS: Record<DownloadFailure, string> = {
  disk_full: "Couldn't download: not enough free space on this phone.",
  refused: "Couldn't download on this account.",
  network: "Couldn't download. Check your connection and try again.",
  other: "Couldn't download. Try again.",
};

function statusLine(row: ChapterListRow): string | null {
  switch (row.download.kind) {
    case "downloaded":
      return "Downloaded. It reads and plays with no connection.";
    case "queued":
      return "Queued for download.";
    case "downloading":
      return `Downloading, ${row.download.percent}%.`;
    case "failed":
      return FAILURE_WORDS[row.download.failure];
    case "none":
      return null;
  }
}

type Item = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  accessibilityLabel: string;
  /** Teal for Listen and Download; `body` for the rest. Never ember. */
  accent: boolean;
};

function itemFor(action: ChapterRowAction, row: ChapterListRow): Item {
  switch (action) {
    case "listen":
      return { icon: "headset-outline", label: "Listen", accessibilityLabel: `Listen to chapter ${row.number}`, accent: true };
    case "download":
      return {
        icon: "download-outline",
        label: "Download chapter",
        accessibilityLabel: `Download chapter ${row.number}`,
        accent: true,
      };
    case "cancel":
      return {
        icon: "close-circle-outline",
        label: "Cancel download",
        accessibilityLabel: `Cancel the download of chapter ${row.number}`,
        accent: false,
      };
    case "remove":
      return {
        icon: "trash-outline",
        label: "Remove download",
        accessibilityLabel: `Remove the download of chapter ${row.number}`,
        accent: false,
      };
  }
}

type ChapterActionsSheetProps = {
  /** The row the sheet is for; null closes it. */
  row: ChapterListRow | null;
  /** Offline, "Download chapter" is disabled and says why. */
  online: boolean;
  onAction: (row: ChapterListRow, action: ChapterRowAction) => void;
  onClose: () => void;
};

/**
 * M9's row sheet (prompt 24 step 12), opened by long-pressing an openable
 * row or by its Downloaded disc. No frame: built on the reader settings
 * sheet's pattern, a React Native `Modal` sliding up on `raised` over a
 * `bg/60` scrim, closed by the scrim, Android back and "Done". "Listen" when
 * the chapter has narration, then "Download chapter", "Cancel download" or
 * "Remove download". Removing needs no confirmation. Teal or `muted` only,
 * never ember.
 */
export function ChapterActionsSheet({ row, online, onAction, onClose }: ChapterActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const status = row ? statusLine(row) : null;

  return (
    <Modal
      visible={row !== null}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close chapter options"
          onPress={onClose}
          className="absolute inset-0 bg-bg/60"
        />

        {row ? (
          <View className="rounded-t-card bg-raised px-6 pt-6" style={{ paddingBottom: 16 + insets.bottom }}>
            <View className="mb-1 flex-row items-center justify-between gap-4">
              <Text
                accessibilityRole="header"
                className="text-heading flex-1 text-xl"
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              >
                {row.title}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Done"
                onPress={onClose}
                // No className beside a `style` function (AGENTS.md § Style Exception Rules).
                style={({ pressed }) => [styles.done, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Text className="font-ui-semibold text-body text-[15px]" maxFontSizeMultiplier={1.3}>
                  Done
                </Text>
              </Pressable>
            </View>

            {status ? (
              <Text
                accessibilityLiveRegion="polite"
                className="font-ui text-muted mb-2 text-sm"
                maxFontSizeMultiplier={1.5}
              >
                {status}
              </Text>
            ) : null}

            {chapterRowActions(row).map((action) => {
              const item = itemFor(action, row);
              const disabled = action === "download" && !online;
              const tint = disabled ? colors.muted : item.accent ? colors.teal : colors.body;
              return (
                <Pressable
                  key={action}
                  accessibilityRole="button"
                  accessibilityLabel={disabled ? `${item.accessibilityLabel}. Not available offline` : item.accessibilityLabel}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => onAction(row, action)}
                  style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Ionicons name={item.icon} size={20} color={tint} />
                  <View className="flex-1">
                    <Text
                      className={`font-ui-medium text-[15px] ${disabled ? "text-muted" : item.accent ? "text-teal" : "text-body"}`}
                      maxFontSizeMultiplier={1.3}
                    >
                      {item.label}
                    </Text>
                    {disabled ? (
                      <Text className="font-ui text-muted text-[13px]" maxFontSizeMultiplier={1.3}>
                        Connect to the internet to download.
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  done: {
    marginRight: -12,
    height: layout.minTouchTarget,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  item: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
});
