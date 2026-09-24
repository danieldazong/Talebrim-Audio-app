import { memo } from "react";
import { Pressable, Text, View, type LayoutChangeEvent } from "react-native";

import { ReaderPill } from "@/components/reader/reader-pill";
import type { ReaderFaces, ReaderPalette } from "@/components/reader/reader-theme";
import type { ReaderBlock, ReaderSpan } from "@/lib/chapter-text";

/**
 * Body text follows the system font size up to 1.5×. At the largest reader
 * size (28sp) that is 42sp: still a readable single column. Chrome caps at
 * 1.3, as everywhere else in the app.
 */
export const BODY_MAX_FONT_SCALE = 1.5;

/** 20dp at the default 18sp, scaled so the rhythm holds at every size. */
export function paragraphGap(fontSize: number): number {
  return fontSize * 1.1;
}

function Span({ span, faces }: { span: ReaderSpan; faces: ReaderFaces }) {
  // Bold and italic switch the font FILE, never fontWeight or fontStyle,
  // which Android fakes or drops to the system font.
  if (span.bold) return <Text className={span.italic ? faces.boldItalic : faces.bold}>{span.text}</Text>;
  if (span.italic) return <Text className={faces.italic}>{span.text}</Text>;
  return span.text;
}

type ChapterBodyProps = {
  blocks: readonly ReaderBlock[];
  chapterNumber: number;
  chapterTitle: string | null;
  palette: ReaderPalette;
  /** Literata, or Atkinson Hyperlegible when the reader turns it on. */
  faces: ReaderFaces;
  fontSize: number;
  lineSpacing: number;
  onBodyLayout: (event: LayoutChangeEvent) => void;
  onBlockLayout: (index: number, event: LayoutChangeEvent) => void;
  /** A tap anywhere on the page, which shows or hides the toolbar. */
  onTap: () => void;
  /** `null` hides the control: no next chapter, or the neighbours aren't known. */
  onNext: (() => void) | null;
  /** `null` hides the control: no previous chapter, or the neighbours aren't known. */
  onPrevious: (() => void) | null;
};

/**
 * M5's reading column — prompt 14 steps 3, 4, 8 and 12: the "CHAPTER N"
 * label, the title, the parsed body and the end-of-chapter controls.
 *
 * Every paragraph reports its layout, so the reading position can be kept
 * as a character offset. Memoised: the position label's updates never
 * re-render the chapter.
 */
export const ChapterBody = memo(function ChapterBody({
  blocks,
  chapterNumber,
  chapterTitle,
  palette,
  faces,
  fontSize,
  lineSpacing,
  onBodyLayout,
  onBlockLayout,
  onTap,
  onNext,
  onPrevious,
}: ChapterBodyProps) {
  const gap = paragraphGap(fontSize);
  const headingSize = Math.round(fontSize * 1.2);

  return (
    // Not an accessibility element: screen readers reach each paragraph.
    <Pressable accessible={false} onPress={onTap} className="px-6 pt-5">
      <Text
        className={`font-ui-medium text-sm uppercase tracking-[0.5px] ${palette.secondary}`}
        maxFontSizeMultiplier={1.3}
      >
        {`Chapter ${chapterNumber}`}
      </Text>

      {chapterTitle ? (
        <Text
          accessibilityRole="header"
          className={`font-display mt-1 text-[28px] leading-[34px] ${palette.display}`}
          maxFontSizeMultiplier={1.3}
        >
          {chapterTitle}
        </Text>
      ) : null}

      <View className="mt-8" style={{ gap }} onLayout={onBodyLayout}>
        {blocks.map((block, index) =>
          block.kind === "heading" ? (
            <Text
              key={block.start}
              accessibilityRole="header"
              onLayout={(event) => onBlockLayout(index, event)}
              className={`font-display ${palette.display}`}
              style={{ fontSize: headingSize, lineHeight: headingSize * 1.3, marginTop: gap }}
              maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
            >
              {block.spans.map((span) => span.text).join("")}
            </Text>
          ) : (
            <Text
              key={block.start}
              onLayout={(event) => onBlockLayout(index, event)}
              className={`${faces.regular} ${palette.text}`}
              style={{ fontSize, lineHeight: fontSize * lineSpacing }}
              maxFontSizeMultiplier={BODY_MAX_FONT_SCALE}
            >
              {block.spans.map((span, spanIndex) => (
                <Span key={spanIndex} span={span} faces={faces} />
              ))}
            </Text>
          ),
        )}
      </View>

      {onNext || onPrevious ? (
        <View className="mt-12 items-center">
          {onNext ? (
            <ReaderPill label="Next chapter" palette={palette} onPress={onNext} className="h-12 self-stretch" />
          ) : null}
          {onPrevious ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous chapter"
              onPress={onPrevious}
              className="mt-2 min-h-11 justify-center px-4"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className={`font-ui-medium text-[15px] ${palette.text}`} maxFontSizeMultiplier={1.3}>
                Previous chapter
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});
