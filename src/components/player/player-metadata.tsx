import { Text, View } from "react-native";

import type { NowPlayingMeta } from "@/hooks/use-now-playing";

type PlayerMetadataProps = {
  meta: NowPlayingMeta;
  /** Draws a bar for each line not known yet, instead of leaving it out. */
  loading?: boolean;
  /** Layout classes only. */
  className?: string;
};

function chapterLine({ number, title }: { number: number; title: string | null }): string {
  return title ? `Chapter ${number}: ${title}` : `Chapter ${number}`;
}

/** A skeleton bar in a box the height of the line it stands in for, so nothing moves when it loads. */
function LineBar({ boxClassName, barClassName }: { boxClassName: string; barClassName: string }) {
  return (
    <View className={`items-center justify-center ${boxClassName}`}>
      <View className={`rounded-pill bg-surface ${barClassName}`} />
    </View>
  );
}

/**
 * M6's title, chapter and author lines — prompt 17 step 6. All of it is data:
 * the frame's copy is placeholder. Each line shows whenever its value is
 * known, in every state.
 *
 * The chapter line is Inter, as the frame shows; Literata never appears on
 * this screen. The frame's "Narration by …" credit has no column behind it
 * and is omitted.
 */
export function PlayerMetadata({ meta, loading = false, className = "" }: PlayerMetadataProps) {
  const { book, chapter } = meta;

  return (
    <View className={`items-center px-6 ${className}`}>
      {book ? (
        <Text
          accessibilityRole="header"
          className="text-heading text-center text-[26px] leading-8"
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {book.title}
        </Text>
      ) : loading ? (
        <LineBar boxClassName="h-8" barClassName="h-6 w-48" />
      ) : null}

      {chapter ? (
        <Text
          className="font-ui-semibold text-body mt-1 text-center text-base leading-6"
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {chapterLine(chapter)}
        </Text>
      ) : loading ? (
        <LineBar boxClassName="mt-1 h-6" barClassName="h-4 w-40" />
      ) : null}

      {book?.author ? (
        <Text className="font-ui text-muted mt-1 text-center text-sm leading-5" maxFontSizeMultiplier={1.5}>
          By {book.author}
        </Text>
      ) : !book && loading ? (
        <LineBar boxClassName="mt-1 h-5" barClassName="h-3.5 w-28" />
      ) : null}
    </View>
  );
}
