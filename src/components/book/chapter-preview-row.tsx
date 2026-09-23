import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { PreviewChapter } from "@/hooks/use-book-detail";
import { formatDuration } from "@/lib/format";
import { colors } from "@/theme";

/** 12dp + 20dp title + 18dp detail + 12dp, measured from material/6.png. */
export const CHAPTER_ROW_HEIGHT = 62;

type ChapterPreviewRowProps = {
  chapter: PreviewChapter;
  onOpen: (chapterId: string) => void;
};

/**
 * One M4 preview row: "{number}. {title}", plus the audio length when the
 * chapter has narration.
 *
 * Lock is the only per-user state drawn here. A chapter opened by an unlock
 * looks exactly like a free one; M9 gives Unlocked, Downloaded and Reading
 * their own visuals.
 *
 * Omitted from the frame: "8 min read" (there is no word-count column) and
 * the check mark with its "Read" label (a finished state nothing records).
 */
export function ChapterPreviewRow({ chapter, onOpen }: ChapterPreviewRowProps) {
  const locked = chapter.state.kind === "locked";
  const heading = chapter.title
    ? `${chapter.number}. ${chapter.title}`
    : `Chapter ${chapter.number}`;
  // An unmeasured file still says it is audio — "Duration unknown" alone
  // would hide that the chapter is narrated. Never "00:00".
  const audio = !chapter.hasAudio
    ? null
    : chapter.audioDurationSeconds === null
      ? "Audio · duration unknown"
      : `${formatDuration(chapter.audioDurationSeconds)} audio`;

  function open() {
    // TODO(paywall): a locked row opens M5a here. It must never open the reader.
    if (locked) return;
    onOpen(chapter.id);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        chapter.title ? `Chapter ${chapter.number}: ${chapter.title}` : heading,
        audio ?? "Text only",
        locked ? "Locked" : null,
      ]
        .filter((part) => part !== null)
        .join(". ")}
      onPress={open}
      className="flex-row items-center gap-3 rounded-card border border-raised bg-surface px-4 py-3"
      style={({ pressed }) => ({ minHeight: CHAPTER_ROW_HEIGHT, opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-1">
        <Text
          className="font-ui-semibold text-body text-sm leading-5"
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {heading}
        </Text>
        {audio ? (
          <Text
            className="font-ui text-muted text-[13px] leading-[18px]"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {audio}
          </Text>
        ) : null}
      </View>

      {locked ? <Ionicons name="lock-closed-outline" size={20} color={colors.muted} /> : null}
    </Pressable>
  );
}
