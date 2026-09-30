import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Cover } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { updateAge, updateChapterLabel, type UpdateItem } from "@/lib/updates";
import { colors } from "@/theme";

/** 2:3 at 40dp wide: the chapter list's size, small enough for a long list. */
const COVER_WIDTH = 40;

type UpdateRowProps = {
  item: UpdateItem;
  coverUrl: string | null;
  /** True, false, or null while the unlocks or the entitlement load. */
  locked: boolean | null;
  /** When the screen last looked, for "5 min ago". */
  now: number;
  onOpen: (item: UpdateItem) => void;
};

/**
 * One new chapter in Updates (2026-09-30). No frame: M9's row sizes and
 * tokens. The book in `muted`, the chapter in `body`, how long ago, a teal
 * "New" pill for a chapter added since the reader last looked (teal, as M3's
 * "★ New Serial"), and a lock for a chapter the reader can't open, which
 * opens M5a. Never ember: Updates has no primary action.
 */
export function UpdateRow({ item, coverUrl, locked, now, onOpen }: UpdateRowProps) {
  const chapter = updateChapterLabel(item.number, item.chapterTitle);
  const age = updateAge(item.createdAtMs, now, formatDate(item.createdAt));
  const opens = locked ? "Opens the unlock options" : item.hasText ? "Opens the reader" : "Opens the player";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        item.bookTitle,
        chapter,
        item.isNew ? "New" : null,
        age.spoken,
        locked ? "Locked" : null,
        opens,
      ]
        .filter((part) => part)
        .join(". ")}
      onPress={() => onOpen(item)}
      // No className beside a `style` function (AGENTS.md § Style Exception Rules).
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Cover source={coverUrl === null ? null : { uri: coverUrl }} recyclingKey={item.bookId} width={COVER_WIDTH} />
      <View className="flex-1 gap-0.5">
        <Text className="font-ui text-muted text-[13px] leading-[18px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {item.bookTitle}
        </Text>
        <Text
          className="font-ui-medium text-body text-[15px] leading-5"
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {chapter}
        </Text>
        <View className="flex-row items-center gap-2 pt-0.5">
          <Text className="font-ui text-muted text-[13px] leading-[18px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {age.shown}
          </Text>
          {item.isNew ? (
            <View className="rounded-pill bg-teal/15 px-2 py-0.5">
              <Text className="font-ui-semibold text-teal text-xs" maxFontSizeMultiplier={1.3}>
                New
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      {locked ? <Ionicons name="lock-closed-outline" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    paddingVertical: 12,
  },
});
