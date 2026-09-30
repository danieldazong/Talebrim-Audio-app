import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Cover, TextLink } from "@/components/ui";
import { withinOfflineWindow, entryBytes, type DownloadedBookGroup } from "@/lib/downloads/rules";
import { formatBytes, formatBytesSpoken } from "@/lib/format";
import type { DownloadEntry } from "@/store/downloads-store";
import { colors } from "@/theme";

/** The card's cover: 48dp wide, 2:3. */
const COVER_WIDTH = 48;

/** What a chapter's download holds, in words: "Audio and text", "Text", "Audio". */
function partsLine(entry: DownloadEntry): string {
  if (entry.audio && entry.text) return "Audio and text";
  return entry.audio ? "Audio" : "Text";
}

function chapterTitle(entry: DownloadEntry): string {
  const title = entry.title?.trim();
  return title ? `Ch. ${entry.number}: ${title}` : `Chapter ${entry.number}`;
}

type DownloadedBookProps = {
  group: DownloadedBookGroup;
  online: boolean;
  /** When the screen last looked, in epoch milliseconds: what "past its 30 days" is measured from. */
  now: number;
  onOpenChapter: (entry: DownloadEntry) => void;
  onRemoveBook: (bookId: string) => void;
};

/**
 * One downloaded book on the Downloads screen (prompt 24 step 12): its cover
 * from `expo-image`'s cache, or the flat placeholder offline (covers are
 * never downloaded), its size on disk, a remove labelled with what it
 * removes, and its chapters, each opening in M5 or M6. No frame: built from
 * M9's rows on a `surface` card. Teal or `muted`, never ember.
 */
export function DownloadedBook({ group, online, now, onOpenChapter, onRemoveBook }: DownloadedBookProps) {
  const { book, chapters, bytes } = group;
  const count = chapters.length === 1 ? "1 chapter" : `${chapters.length} chapters`;

  return (
    <View className="rounded-card bg-surface px-4 pb-1 pt-3">
      <View className="flex-row items-center gap-3">
        <Cover source={book.coverUrl === null ? null : { uri: book.coverUrl }} recyclingKey={book.id} width={COVER_WIDTH} />
        <View className="flex-1 gap-0.5">
          <Text className="text-heading text-base leading-6" numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {book.title}
          </Text>
          {book.author ? (
            <Text className="font-ui text-muted text-[13px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {book.author}
            </Text>
          ) : null}
          <Text
            accessibilityLabel={`${count}, ${formatBytesSpoken(bytes)}`}
            className="font-ui text-muted text-[13px]"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {`${count} · ${formatBytes(bytes)}`}
          </Text>
        </View>
        <TextLink
          label="Remove"
          accessibilityLabel={`Remove the downloads of ${book.title}`}
          onPress={() => onRemoveBook(book.id)}
        />
      </View>

      <View className="mt-2">
        {chapters.map((entry, index) => {
          const expired = !online && !withinOfflineWindow(entry.verifiedAt, now);
          const detail = expired ? "Connect to keep offline" : `${partsLine(entry)} · ${formatBytes(entryBytes(entry))}`;
          const spoken = expired
            ? "Connect to the internet to keep it offline"
            : `${partsLine(entry)}, ${formatBytesSpoken(entryBytes(entry))}`;
          return (
            <Pressable
              key={entry.chapterId}
              accessibilityRole="button"
              accessibilityLabel={`${chapterTitle(entry)}. ${spoken}. Opens ${entry.text ? "in the reader" : "in the player"}.`}
              onPress={() => onOpenChapter(entry)}
              style={({ pressed }) => [styles.chapter, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View className="flex-1 gap-0.5">
                <Text className="font-ui-medium text-body text-[15px] leading-5" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {chapterTitle(entry)}
                </Text>
                <Text className="font-ui text-muted text-[13px] leading-[18px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {detail}
                </Text>
              </View>
              <Ionicons
                name={expired ? "cloud-offline-outline" : entry.text ? "book-outline" : "headset-outline"}
                size={16}
                color={expired ? colors.muted : colors.teal}
              />
              {index === chapters.length - 1 ? null : <View style={styles.divider} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chapter: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  divider: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.raised,
  },
});
