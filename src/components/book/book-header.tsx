import { Ionicons } from "@expo/vector-icons";
import { Fragment } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Button, Cover } from "@/components/ui";
import type { ChapterTarget } from "@/hooks/use-book-detail";
import { formatDurationCompact } from "@/lib/format";
import { genreLabel, maturityLabel } from "@/lib/labels";
import { colors, layout } from "@/theme";
import type { BookDetailRow } from "@/types/catalog";

/** 2:3 → 210dp tall, measured from material/6.png. */
export const BOOK_COVER_WIDTH = 140;

/**
 * Where the cover starts: 8dp below the floating top bar (14dp down, 44dp
 * tall). material/6.png measures 48, which only worked while every button
 * was round: the My List pill reaches over the cover's top corner.
 */
export const BOOK_CONTENT_TOP = 66;

export type MyListToggle = {
  title: string;
  isOnList: boolean;
  onToggle: () => void;
};

type BookTopBarProps = {
  onBack: () => void;
  /** `null` hides Share — nothing to share until the book has loaded. */
  onShare: (() => void) | null;
  /** `null` hides My List — until the book and My List are both known (`useMyList()`). */
  myList: MyListToggle | null;
};

/**
 * M4's round back and share buttons, and the My List pill. They float over
 * the scroll content so Back stays reachable deep in the chapter list;
 * `box-none` lets touches between them reach the content underneath.
 *
 * No frame draws My List (AGENTS.md § Decisions — 2026-09-25, "M7"). A bare
 * plus could mean follow, download or anything else, so the pill names the
 * list Library shows: "+ My List", then "✓ In My List", which is also the
 * confirmation. Outlined like Share, in `body`: Read is M4's one ember
 * action, and teal is for audio. No bookmark: M5's bookmark marks a place in
 * a chapter.
 */
export function BookTopBar({ onBack, onShare, myList }: BookTopBarProps) {
  return (
    <View pointerEvents="box-none" className="absolute inset-x-3 top-3.5 flex-row justify-between">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        className="icon-btn icon-btn--round icon-btn--outline"
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Ionicons name="chevron-back" size={22} color={colors.body} />
      </Pressable>

      <View pointerEvents="box-none" className="flex-row gap-2">
        {myList ? (
          <Pressable
            accessibilityRole="button"
            // Each starts with the words on the pill, so voice control finds it by them.
            accessibilityLabel={
              myList.isOnList
                ? `In My List. Remove ${myList.title} from My List`
                : `My List. Add ${myList.title} to My List`
            }
            accessibilityState={{ selected: myList.isOnList }}
            onPress={myList.onToggle}
            // No className beside a `style` function (AGENTS.md § Style Exception Rules).
            style={({ pressed }) => [styles.myList, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name={myList.isOnList ? "checkmark" : "add"} size={18} color={colors.body} />
            <Text className="font-ui-semibold text-body text-sm" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {myList.isOnList ? "In My List" : "My List"}
            </Text>
          </Pressable>
        ) : null}

        {onShare ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Share this story"
            onPress={onShare}
            className="icon-btn icon-btn--round icon-btn--outline"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="share-social-outline" size={20} color={colors.body} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Back and Share's outline (`icon-btn--outline`), as a 44dp pill with a label. */
  myList: {
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    borderWidth: 1,
    borderColor: colors.raised,
    backgroundColor: colors.bg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 14,
    paddingRight: 16,
  },
});

/** What a screen reader hears for Read or Listen, including why it won't open. */
function actionLabel(action: "Read" | "Listen", target: ChapterTarget): string {
  switch (target.kind) {
    case "pending":
      return `${action}. Loading chapters.`;
    case "failed":
      return `${action}. Chapters couldn't load.`;
    case "none":
      return action === "Read"
        ? "Read. This story has no chapters yet."
        : "Listen. This story has no narration.";
    case "ready":
      if (target.locked) return `${action}. Chapter ${target.number} is locked.`;
      return action === "Read" ? `Read chapter ${target.number}` : `Listen to chapter ${target.number}`;
  }
}

type BookHeaderProps = {
  book: BookDetailRow;
  /** Resolved via `resolveCoverUrl()` — never built inline here. */
  coverUrl: string | null;
  read: ChapterTarget;
  listen: ChapterTarget;
  onRead: () => void;
  onListen: () => void;
};

/**
 * M4's header, top to bottom as in material/6.png: cover, title, author,
 * metadata row, genre pills, Read and Listen.
 *
 * No backdrop behind the cover — AGENTS.md § Decisions, "M4 layout".
 */
export function BookHeader({ book, coverUrl, read, listen, onRead, onListen }: BookHeaderProps) {
  const hasAudio = (book.audio_count ?? 0) > 0;
  const isMature = book.maturity === "mature_17";
  const genres = (book.genres ?? []).map(genreLabel);

  // NO BACKING METRIC — the frame's "★ 4.9" rating and teal "Ongoing" are
  // omitted: `books_catalog` has no rating column, and `status` is
  // draft | published with every row here published.
  const meta = [
    book.chapter_count === null
      ? null
      : `${book.chapter_count} ${book.chapter_count === 1 ? "Chapter" : "Chapters"}`,
    // A text-only book has nothing to measure, so "Duration unknown" would
    // misdescribe it. With audio, a null total prints the unknown label.
    hasAudio ? formatDurationCompact(book.total_duration_seconds) : null,
  ].filter((part) => part !== null);

  const metaLabel = [...meta, isMature ? maturityLabel("mature_17") : null]
    .filter((part) => part !== null)
    .join(", ");

  return (
    <View className="items-center">
      <View className="overflow-hidden rounded-cover border border-raised">
        <Cover
          source={coverUrl === null ? null : { uri: coverUrl }}
          recyclingKey={book.id ?? undefined}
          width={BOOK_COVER_WIDTH}
        />
      </View>

      <Text
        accessibilityRole="header"
        className="text-heading mt-4 px-4 text-center text-[26px] leading-8"
        maxFontSizeMultiplier={1.3}
      >
        {book.title ?? "Untitled"}
      </Text>

      {book.author ? (
        <Text
          className="font-ui text-muted mt-1 px-4 text-center text-base leading-6"
          maxFontSizeMultiplier={1.5}
        >
          By {book.author}
        </Text>
      ) : null}

      {metaLabel ? (
        <View
          accessible
          accessibilityLabel={metaLabel}
          className="mt-2 flex-row flex-wrap items-center justify-center gap-x-2.5 gap-y-2 px-4"
        >
          {meta.map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? (
                <Text className="font-ui text-muted text-sm leading-5" maxFontSizeMultiplier={1.3}>
                  ·
                </Text>
              ) : null}
              <Text className="font-ui text-muted text-sm leading-5" maxFontSizeMultiplier={1.3}>
                {part}
              </Text>
            </Fragment>
          ))}
          {/* The frame shows no maturity label; AGENTS.md § Content Rules
              asks for one per title. Never the raw enum value. */}
          {isMature ? <Badge variant="outline" label={maturityLabel("mature_17")} /> : null}
        </View>
      ) : null}

      {genres.length > 0 ? (
        // Labels, not controls — so not `Chip`, which is a Pressable
        // announced as a button. Stored values are slugs; `genreLabel()`
        // turns them into display text. Capped at the row's width, so one
        // long label truncates instead of running off the screen.
        <View
          accessible
          accessibilityLabel={`Genres: ${genres.join(", ")}`}
          className="mt-4 flex-row flex-wrap justify-center gap-2 px-4"
        >
          {genres.map((genre, index) => (
            <View
              key={`${genre}-${index}`}
              className="max-w-full rounded-pill border border-blush/40 bg-blush/20 px-4 py-2"
            >
              <Text
                className="font-ui-semibold text-blush text-[13px] leading-[18px]"
                numberOfLines={1}
                maxFontSizeMultiplier={1.3}
              >
                {genre}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View className="mt-5 flex-row gap-3 self-stretch px-4">
        {/* The screen's single ember element. */}
        <Button
          label="Read"
          variant="primary"
          icon={<Ionicons name="book" size={16} color={colors.ink} />}
          disabled={read.kind !== "ready"}
          accessibilityLabel={actionLabel("Read", read)}
          onPress={onRead}
          className="h-12 flex-1"
        />
        <Button
          label="Listen"
          variant="audio"
          icon={<Ionicons name="headset" size={16} color={colors.teal} />}
          disabled={listen.kind !== "ready"}
          accessibilityLabel={actionLabel("Listen", listen)}
          onPress={onListen}
          className="h-12 flex-1"
        />
      </View>

      {/* NOT BUILT — the frame's "You're on Chapter 12 · 34% complete" card.
          Its chapter now has data behind it (`resumeTargetOptions()`, which
          Read already resumes to), but its percentage does not: nothing
          stores progress through a book. Not rendered, mocked or given
          reserved space until a prompt decides what that percentage means. */}
    </View>
  );
}
