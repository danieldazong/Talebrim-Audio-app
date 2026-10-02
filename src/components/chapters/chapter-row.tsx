import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { chapterRowActions, type ChapterListRow, type ChapterRowAction } from "@/lib/chapter-list";
import { colors, layout } from "@/theme";

// Measured from material/5.png: a 64dp row, 12dp of padding above and below,
// a 20dp title line, 2dp, and an 18dp detail line.
const ROW_PADDING = 12 + 2 + 12;
const TITLE_LINE = 20;
const DETAIL_LINE = 18;
/** Both lines stop growing here, so a row's height is known before it renders. */
const MAX_FONT_SCALE = 1.3;

/**
 * Every row's height at a font scale. `getItemLayout` needs one height for
 * every row, so the title and the detail are one line each and their line
 * heights are the only part that grows with the system text size, up to
 * `MAX_FONT_SCALE` (React Native scales `lineHeight` with the font).
 */
export function chapterListRowHeight(fontScale: number): number {
  return Math.ceil(ROW_PADDING + (TITLE_LINE + DETAIL_LINE) * Math.min(fontScale, MAX_FONT_SCALE));
}

/** The screen-reader action for each of the row sheet's items. */
export const ROW_ACTION_LABELS: Record<ChapterRowAction, string> = {
  listen: "Listen",
  download: "Download chapter",
  cancel: "Cancel download",
  remove: "Remove download",
};

/** Words in the slot, in `muted`: a chapter in the download queue. */
function QueueWords({ label }: { label: string }) {
  return (
    <Text className="font-ui-medium text-muted text-xs leading-4" maxFontSizeMultiplier={MAX_FONT_SCALE}>
      {label}
    </Text>
  );
}

/** The right-hand slot, except the headphone and the Downloaded disc, which are buttons beside the row. */
function Trailing({ row }: { row: ChapterListRow }) {
  switch (row.trailing) {
    case "reading":
      return (
        <View className="rounded-pill bg-ember/10 px-2.5 py-px">
          <Text className="font-ui-semibold text-ember text-xs leading-4" maxFontSizeMultiplier={MAX_FONT_SCALE}>
            Reading
          </Text>
        </View>
      );
    case "queued":
      return <QueueWords label="Queued" />;
    case "progress":
      return <QueueWords label={`${row.download.kind === "downloading" ? row.download.percent : 0}%`} />;
    case "failed":
      return <QueueWords label="Failed" />;
    case "locked":
      return <Ionicons name="lock-closed-outline" size={16} color={colors.muted} />;
    case "downloaded":
    case "listen":
    case null:
      return null;
  }
}

type ChapterRowProps = {
  row: ChapterListRow;
  /** `chapterListRowHeight()` — the same value `getItemLayout` uses. */
  height: number;
  /** No divider under the last row. */
  isLast: boolean;
  onOpen: (row: ChapterListRow) => void;
  onListen: (row: ChapterListRow) => void;
  /** Long-press, or the Downloaded disc: the row's sheet. */
  onOpenSheet: (row: ChapterListRow) => void;
  /** A screen reader's action on the row: the sheet's items, without the sheet. */
  onAction: (row: ChapterListRow, action: ChapterRowAction) => void;
};

/**
 * One M9 row, in exactly one of its four states — prompt 20 step 7.
 *
 * The row is one screen-reader element, labelled with its title, its audio
 * and its state. An unlocked narrated row's headphone is a separate 44dp
 * button beside it, labelled on its own, and so is a Downloaded row's teal
 * disc, which opens the row's sheet. A row that opens nothing (Locked, or
 * no text and no narration) is disabled, and its label says why.
 *
 * Downloads (prompt 24 step 12): long-pressing an openable row opens its
 * sheet, and a screen reader gets the sheet's items as the row's actions.
 * No per-chapter download button: the owner settled long-press on
 * 2026-09-25. A chapter in the queue shows "Queued", its percentage or
 * "Failed" in the slot.
 *
 * Omitted from the frame (AGENTS.md § Decisions, "No UI without data behind
 * it"): "14 min read" (no word-count column), and the Reading row's
 * "34% complete" and its progress line (the list has no text length to
 * measure a character offset against).
 *
 * The Pressables take their whole style from a `style` function and no
 * `className`: NativeWind drops a function beside a className (AGENTS.md
 * § Style Exception Rules).
 */
export function ChapterRow({ row, height, isLast, onOpen, onListen, onOpenSheet, onAction }: ChapterRowProps) {
  const reading = row.state.kind === "reading";
  const locked = row.state.kind === "locked";
  const listen = row.trailing === "listen";
  const disc = row.trailing === "downloaded";
  const titleColor = locked ? "text-muted" : reading ? "text-champagne" : "text-body";
  const actions = chapterRowActions(row);

  return (
    <View className={`flex-row ${reading ? "bg-surface/40" : ""}`} style={{ height }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={row.accessibilityLabel}
        accessibilityState={{ disabled: row.opens === null }}
        disabled={row.opens === null}
        onPress={() => onOpen(row)}
        onLongPress={row.hasSheet ? () => onOpenSheet(row) : undefined}
        accessibilityActions={actions.map((action) => ({ name: action, label: ROW_ACTION_LABELS[action] }))}
        onAccessibilityAction={(event) => {
          const action = actions.find((candidate) => candidate === event.nativeEvent.actionName);
          if (action) onAction(row, action);
        }}
        style={({ pressed }) => [styles.main, listen || disc ? null : styles.mainEnd, { opacity: pressed ? 0.7 : 1 }]}
      >
        <View className="flex-1 gap-0.5">
          <Text
            className={`font-ui-medium text-[15px] leading-5 ${titleColor}`}
            numberOfLines={1}
            maxFontSizeMultiplier={MAX_FONT_SCALE}
          >
            {row.title}
          </Text>
          {/* Locked in the dashboard, open through the subscription: the lock
              stays visible to a subscriber, open (Decisions — 2026-10-01). */}
          <View className="flex-row items-center gap-1">
            {row.byPlan ? <Ionicons name="lock-open-outline" size={13} color={colors.teal} /> : null}
            <Text
              className="font-ui text-muted shrink text-[13px] leading-[18px]"
              numberOfLines={1}
              maxFontSizeMultiplier={MAX_FONT_SCALE}
            >
              {row.byPlan ? <Text className="font-ui-medium text-teal">Unlimited · </Text> : null}
              {row.detail}
            </Text>
          </View>
        </View>
        <Trailing row={row} />
      </Pressable>

      {listen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Listen to chapter ${row.number}`}
          onPress={() => onListen(row)}
          style={({ pressed }) => [styles.listen, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="headset-outline" size={16} color={colors.teal} />
        </Pressable>
      ) : null}

      {disc ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Chapter ${row.number} is downloaded. Download options`}
          onPress={() => onOpenSheet(row)}
          style={({ pressed }) => [styles.listen, { opacity: pressed ? 0.6 : 1 }]}
        >
          <View className="h-5 w-5 items-center justify-center rounded-pill bg-teal">
            <Ionicons name="arrow-down" size={12} color={colors.ink} />
          </View>
        </Pressable>
      ) : null}

      {/* The resume marker: ember, filed under progress (AGENTS.md § Design System). */}
      {reading ? <View className="absolute bottom-0 left-0 top-0 w-[3px] bg-ember" /> : null}
      {isLast ? null : <View className="absolute bottom-0 left-4 right-4 h-px bg-raised" />}
    </View>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingLeft: layout.screenPadding,
  },
  mainEnd: {
    paddingRight: layout.screenPadding,
  },
  // A 44dp target whose icon lines up with the 16dp edge the other rows'
  // icons sit on: (44 - 16) / 2 = 14dp inside, plus 2dp. The Downloaded
  // disc shares it.
  listen: {
    width: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 2,
  },
});
