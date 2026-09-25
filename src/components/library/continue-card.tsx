import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Cover, ProgressBar } from "@/components/ui";
import { useProgressLine, type ContinueCard, type ContinueView } from "@/hooks/use-library";
import type { LibrarySegment, ResumeTarget } from "@/lib/library";
import { colors, layout } from "@/theme";

/** Measured from material/9.png: a 62dp 2:3 cover, border included. */
const CARD_COVER_WIDTH = 60;
/** The card's bar and M7's grid lines are both 3dp in the frame. */
export const LIBRARY_PROGRESS_HEIGHT = 3;

type IconName = keyof typeof Ionicons.glyphMap;

/** The icon matches where the button goes: play for M6, an open book for M5. */
function resumeIcon(card: ContinueCard): IconName {
  switch (card.target.kind) {
    case "player":
      return "play";
    case "reader":
      return "book";
    case "locked":
      return "lock-closed";
    case "pending":
    case "none":
      return card.mode === "audio" ? "play" : "book";
  }
}

type ContinueSectionProps = {
  view: ContinueView;
  segment: LibrarySegment;
  onOpenBook: (bookId: string) => void;
  onResume: (target: ResumeTarget) => void;
};

/**
 * "Continue Reading" (Books) or "Continue Listening" (Audiobooks): the
 * reader's latest place, resumed in the mode they left it. Hidden collapses
 * the section, heading included: no empty card, no placeholder cover.
 */
export function ContinueSection({ view, segment, onOpenBook, onResume }: ContinueSectionProps) {
  if (view.status === "hidden") return null;

  return (
    <View className="mt-4 gap-3 px-4">
      {view.status === "loading" ? (
        <View className="h-6 w-44 rounded-pill bg-surface" />
      ) : (
        <Text accessibilityRole="header" className="text-heading text-lg leading-6" maxFontSizeMultiplier={1.3}>
          {segment === "books" ? "Continue Reading" : "Continue Listening"}
        </Text>
      )}
      {view.status === "loading" ? (
        <ContinueCardSkeleton />
      ) : (
        <ContinueCardView card={view.card} onOpenBook={onOpenBook} onResume={onResume} />
      )}
    </View>
  );
}

type ContinueCardViewProps = {
  card: ContinueCard;
  onOpenBook: (bookId: string) => void;
  onResume: (target: ResumeTarget) => void;
};

/**
 * From material/9.png: cover, teal eyebrow, Fraunces title, progress label,
 * ember bar, and the round ember resume button, M7's one ember action. The
 * bar is progress through the book; while listening, the label adds the time
 * left in the chapter.
 *
 * The cover-and-title area and the resume button are sibling buttons, never
 * one inside the other (AGENTS.md § Component Creation Rule).
 */
function ContinueCardView({ card, onOpenBook, onResume }: ContinueCardViewProps) {
  const eyebrow = card.mode === "audio" ? "Listening" : "Reading";
  const canResume = card.target.kind === "reader" || card.target.kind === "player";
  // "Chapter 1 of 13 · 2:00 left" while listening; live while this chapter is in the player.
  const line = useProgressLine(card);

  return (
    <View className="flex-row items-center rounded-card border border-raised bg-surface px-3 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${card.title}. ${eyebrow}, ${line.spoken}.`}
        accessibilityHint="Opens the story"
        onPress={() => onOpenBook(card.bookId)}
        style={({ pressed }) => [styles.open, { opacity: pressed ? 0.85 : 1 }]}
      >
        <View className="flex-row items-center gap-4">
          <View className="overflow-hidden rounded-cover border border-raised">
            <Cover
              source={card.coverUrl === null ? null : { uri: card.coverUrl }}
              recyclingKey={card.bookId}
              width={CARD_COVER_WIDTH}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-ui-semibold text-teal text-xs uppercase leading-4 tracking-wider"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {eyebrow}
            </Text>
            <Text className="text-heading mt-1 text-base leading-6" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {card.title}
            </Text>
            {/* Two lines at most: a long count and time left wrap rather than lose the time. */}
            <Text className="font-ui text-muted mt-0.5 text-sm leading-5" numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {line.shown}
            </Text>
            {card.progress.fraction === null ? null : (
              <ProgressBar value={card.progress.fraction} height={LIBRARY_PROGRESS_HEIGHT} className="mt-3" />
            )}
          </View>
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={card.resumeLabel}
        accessibilityState={{ disabled: !canResume, busy: card.target.kind === "pending" }}
        disabled={!canResume}
        onPress={() => onResume(card.target)}
        // Its whole style from the function, no className (AGENTS.md § Style Exception Rules).
        style={({ pressed }) => [
          styles.resume,
          {
            backgroundColor: pressed ? colors.emberPressed : colors.ember,
            opacity: canResume ? 1 : 0.6,
          },
        ]}
      >
        {/* Ember labels and icons are ink, never white (AGENTS.md § Design System). */}
        <Ionicons name={resumeIcon(card)} size={card.target.kind === "player" ? 20 : 18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

/** Loading — the card's shape, never a spinner. */
function ContinueCardSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading where you left off"
      accessibilityState={{ busy: true }}
      className="flex-row items-center gap-4 rounded-card border border-raised bg-surface px-3 py-2"
    >
      <View className="aspect-[2/3] rounded-cover bg-raised" style={{ width: CARD_COVER_WIDTH + 2 }} />
      <View className="flex-1 gap-2.5">
        <View className="h-3 w-20 rounded-pill bg-raised" />
        <View className="h-4 w-36 rounded-pill bg-raised" />
        <View className="h-3 w-28 rounded-pill bg-raised" />
      </View>
      <View className="h-11 w-11 rounded-pill bg-raised" />
    </View>
  );
}

const styles = StyleSheet.create({
  open: {
    flex: 1,
  },
  resume: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    marginLeft: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
