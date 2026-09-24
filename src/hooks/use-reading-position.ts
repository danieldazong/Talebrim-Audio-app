import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { LayoutChangeEvent, ScrollView } from "react-native";

import { blockIndexAtOffset, type ReaderBlock } from "@/lib/chapter-text";
import { flush, recordPosition } from "@/lib/parity/writer";
import type { ReaderFont } from "@/theme";

type BlockLayout = { y: number; height: number };

/** How long the page must be still before its position counts. */
const SETTLE_MS = 150;

type UseReadingPositionInput = {
  chapterId: string;
  bookId: string;
  blocks: readonly ReaderBlock[];
  /** Where to open: a character offset from `useChapterReader`'s reconciled position, or null for the top. */
  restoreOffset: number | null;
  scrollRef: RefObject<Pick<ScrollView, "scrollTo"> | null>;
  fontSize: number;
  lineSpacing: number;
  font: ReaderFont;
  /** How far above a restored paragraph to stop, so its first line is not flush with the top bar. */
  restoreInset: number;
};

/**
 * M5's reading position — prompt 14 step 14. A CHARACTER offset (the start
 * of the paragraph at the top of the viewport), never pixels: a pixel offset
 * breaks on a font change and cannot map to audio.
 *
 * - Recorded through the parity writer (`lib/parity/writer.ts`) once the
 *   scroll settles, whatever moved it: a drag, a fling, a mouse wheel or a
 *   screen reader. Scroll-end events cannot do this: Android sends no
 *   momentum-end event here, and a wheel or a screen reader sends no drag
 *   events at all. The settle is the reader's "pause".
 * - Restored on mount by holding `restoreOffset`'s paragraph at the top.
 * - Held across a font, font size or line spacing change the same way.
 * - Flushed on unmount (a chapter change or leaving the reader): the writer
 *   sends it now instead of after its debounce.
 *
 * A held paragraph is re-applied on every layout pass until the reader
 * starts dragging, so it survives however many passes the layout takes to
 * settle.
 */
export function useReadingPosition({
  chapterId,
  bookId,
  blocks,
  restoreOffset,
  scrollRef,
  fontSize,
  lineSpacing,
  font,
  restoreInset,
}: UseReadingPositionInput) {
  // Read once, on mount: where this chapter was left, on this device or another.
  const [restoredIndex] = useState(() =>
    restoreOffset === null ? null : blockIndexAtOffset(blocks, restoreOffset),
  );
  const [percent, setPercent] = useState(0);

  const layouts = useRef<BlockLayout[]>([]);
  const bodyTop = useRef(0);
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const topIndex = useRef(restoredIndex ?? 0);
  const pendingAnchor = useRef<number | null>(restoredIndex);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestY = useRef(0);
  const typeSettings = useRef({ fontSize, lineSpacing, font });

  // Unmount is a chapter change or leaving the reader: send the position now.
  // A settle still pending records after this and goes on the writer's
  // debounce, which no unmount can cancel.
  useEffect(() => () => void flush(), []);

  // Runs after the commit that applies the new type and before the new
  // layout reports back, so the paragraph is held in time for it.
  useLayoutEffect(() => {
    const previous = typeSettings.current;
    if (
      previous.fontSize === fontSize &&
      previous.lineSpacing === lineSpacing &&
      previous.font === font
    ) {
      return;
    }
    typeSettings.current = { fontSize, lineSpacing, font };
    pendingAnchor.current = topIndex.current;
  }, [fontSize, lineSpacing, font]);

  const updatePercent = (y: number) => {
    const maxY = contentHeight.current - viewportHeight.current;
    setPercent(maxY > 0 ? Math.round(Math.min(1, Math.max(0, y / maxY)) * 100) : 0);
  };

  const applyAnchor = () => {
    const index = pendingAnchor.current;
    if (index === null) return;
    const layout = layouts.current[index];
    if (!layout) return;
    // The first paragraph anchors at the chapter's top, heading included.
    const y = index === 0 ? 0 : Math.max(0, bodyTop.current + layout.y - restoreInset);
    scrollRef.current?.scrollTo({ y, animated: false });
    updatePercent(y);
  };

  /** The paragraph whose box crosses the top edge of the viewport. */
  const blockAtY = (y: number) => {
    for (let index = 0; index < blocks.length; index += 1) {
      const layout = layouts.current[index];
      if (layout && bodyTop.current + layout.y + layout.height > y) return index;
    }
    return Math.max(0, blocks.length - 1);
  };

  const onBodyLayout = (event: LayoutChangeEvent) => {
    bodyTop.current = event.nativeEvent.layout.y;
    applyAnchor();
  };

  const onBlockLayout = (index: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    layouts.current[index] = { y, height };
    if (index === pendingAnchor.current) applyAnchor();
  };

  const onViewportLayout = (event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  };

  const onContentSizeChange = (_width: number, height: number) => {
    contentHeight.current = height;
    applyAnchor();
  };

  const onDragStart = () => {
    pendingAnchor.current = null;
  };

  const recordAt = (y: number) => {
    if (blocks.length === 0) return;
    const index = blockAtY(y);
    topIndex.current = index;
    updatePercent(y);
    recordPosition({ chapterId, bookId, mode: "text", value: blocks[index].start });
  };

  // A pending timer that fires after unmount still records where the reader
  // stopped, which is the point; React ignores the stale percent update.
  const onScrollActivity = (y: number) => {
    latestY.current = y;
    if (settleTimer.current !== null) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      recordAt(latestY.current);
    }, SETTLE_MS);
  };

  return {
    /** Progress through this chapter, 0–100, as of the last settled scroll. */
    percent,
    onBodyLayout,
    onBlockLayout,
    onViewportLayout,
    onContentSizeChange,
    onDragStart,
    onScrollActivity,
  };
}
