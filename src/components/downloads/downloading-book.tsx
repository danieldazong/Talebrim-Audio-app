import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Cover, TextLink } from "@/components/ui";
import type { DownloadingBook as DownloadingBookInfo } from "@/lib/downloads/rules";
import { colors } from "@/theme";

/** The card's cover: 48dp wide, 2:3, as `DownloadedBook`'s. */
const COVER_WIDTH = 48;

type DownloadingBookProps = {
  info: DownloadingBookInfo;
  online: boolean;
  /** M9, where each chapter's progress is. */
  onOpen: (bookId: string) => void;
  onCancel: (bookId: string) => void;
};

/**
 * A book still downloading, above the downloaded ones on the Downloads
 * screen (added 2026-09-30: a chapter under way showed nowhere here, so a
 * long one looked lost). "Downloading · 3 of 12 · 34%", or "Waiting for a
 * connection" offline. The card opens M9; Cancel is its sibling, never inside
 * it. No frame: `DownloadedBook`'s card. Teal or `muted`, never ember.
 */
export function DownloadingBook({ info, online, onOpen, onCancel }: DownloadingBookProps) {
  const { book, done, total, progress } = info;
  const percent = progress === null ? null : Math.floor(progress * 100);
  const status = online ? "Downloading" : "Waiting for a connection";
  const detail = [status, `${done} of ${total}`, online && percent !== null ? `${percent}%` : null]
    .filter((part) => part !== null)
    .join(" · ");
  const spoken = [
    status,
    `${done} of ${total} chapters`,
    online && percent !== null ? `this chapter ${percent}%` : null,
  ]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <View className="flex-row items-center gap-3 rounded-card bg-surface px-4 py-3">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${book.title}. ${spoken}. Opens the chapter list.`}
        onPress={() => onOpen(book.id)}
        style={({ pressed }) => [styles.open, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Cover source={book.coverUrl === null ? null : { uri: book.coverUrl }} recyclingKey={book.id} width={COVER_WIDTH} />
        <View className="flex-1 gap-0.5">
          <Text className="text-heading text-base leading-6" numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {book.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            {online ? <ActivityIndicator size="small" color={colors.teal} /> : null}
            <Text className="font-ui text-muted flex-1 text-[13px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {detail}
            </Text>
          </View>
        </View>
      </Pressable>
      <TextLink
        label="Cancel"
        accessibilityLabel={`Cancel the downloads of ${book.title}`}
        onPress={() => onCancel(book.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  open: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
