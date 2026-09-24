import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChapterBody, paragraphGap } from "@/components/reader/chapter-body";
import { ReaderSettingsSheet } from "@/components/reader/reader-settings-sheet";
import { ReaderSkeleton, ReaderStateMessage } from "@/components/reader/reader-states";
import {
  NEXT_THEME,
  READER_FACES,
  READER_PALETTES,
  type ReaderPalette,
} from "@/components/reader/reader-theme";
import {
  ReaderProgressBar,
  ReaderToolbar,
  TOOLBAR_BOTTOM_GAP,
  TOOLBAR_HEIGHT,
} from "@/components/reader/reader-toolbar";
import { ReaderTopBar } from "@/components/reader/reader-top-bar";
import { Screen } from "@/components/ui";
import { useChapterReader, type ChapterReaderView, type ReadyChapter } from "@/hooks/use-chapter-reader";
import { useReaderChrome } from "@/hooks/use-reader-chrome";
import { useReadingPosition } from "@/hooks/use-reading-position";
import { isUuid } from "@/lib/ids";
import { useReaderStore, type ReaderTheme } from "@/store/reader-store";
import type { ReaderFont } from "@/theme";

// M5 Reader — AGENTS.md M5, prompts 14 and 15.
//
// A pushed stack route outside (tabs), receiving only the chapter id. No tab
// bar and no mini player, by construction: both live in the tab shell, which
// this route never mounts inside, during the push transition or after it.
// Its data and state come from `hooks/use-chapter-reader.ts`.

/** Clear space between the end of the chapter and the toolbar's top edge. */
const TOOLBAR_CLEARANCE = 16;

/** How far through the chapter, by the position label, before the next chapter's text is prefetched. */
const PREFETCH_NEXT_AT_PERCENT = 80;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

// TODO(handoff): push M6 at the equivalent position. Not before the parity
// prompt writes positions: a handoff that loses the reader's place is worse
// than no handoff.
function listen() {}

// Replaced rather than pushed, so a long reading session does not build a
// deep back stack. A locked chapter opens in its locked state.
function openChapter(chapterId: string) {
  router.replace({ pathname: "/reader/[chapterId]", params: { chapterId } });
}

function noop() {}

export default function ReaderRoute() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();

  // A stale or hand-typed link is simply not available: there is nothing to
  // fetch and nothing a retry could fix.
  if (!isUuid(chapterId)) {
    return (
      <Reader
        view={{ status: "unavailable" }}
        bookTitle={null}
        chapterNumber={null}
        onRetry={noop}
        onNearEnd={noop}
      />
    );
  }
  return <ChapterReader key={chapterId} chapterId={chapterId} />;
}

function ChapterReader({ chapterId }: { chapterId: string }) {
  const { view, bookTitle, chapterNumber, retry, prefetchNext } = useChapterReader(chapterId);

  return (
    <Reader
      view={view}
      bookTitle={bookTitle}
      chapterNumber={chapterNumber}
      onRetry={retry}
      onNearEnd={prefetchNext}
    />
  );
}

type ReaderProps = {
  view: ChapterReaderView;
  /** The top bar's lines: shown whenever they are known, in any state. */
  bookTitle: string | null;
  chapterNumber: number | null;
  onRetry: () => void;
  /** Called once the reader is most of the way through the chapter. */
  onNearEnd: () => void;
};

function Reader({ view, bookTitle, chapterNumber, onRetry, onNearEnd }: ReaderProps) {
  const { status } = view;

  const theme = useReaderStore((state) => state.theme);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineSpacing = useReaderStore((state) => state.lineSpacing);
  const atkinsonEnabled = useReaderStore((state) => state.atkinsonEnabled);
  const setTheme = useReaderStore((state) => state.setTheme);
  const setFontSize = useReaderStore((state) => state.setFontSize);
  const setLineSpacing = useReaderStore((state) => state.setLineSpacing);
  const setAtkinsonEnabled = useReaderStore((state) => state.setAtkinsonEnabled);

  const insets = useSafeAreaInsets();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const palette = READER_PALETTES[theme];
  const toolbarBottom = insets.bottom + TOOLBAR_BOTTOM_GAP;

  const cycleTheme = () => setTheme(NEXT_THEME[theme]);
  const openSettings = () => setSettingsOpen(true);

  return (
    <Screen edges={["top"]} backgroundColor={palette.colors.page}>
      {/* The app sets light icons, which vanish on a light page. This one
          unmounts with the screen, and the app's style returns. */}
      <StatusBar style={palette.statusBar} />

      <ReaderTopBar
        palette={palette}
        bookTitle={bookTitle}
        chapterNumber={chapterNumber}
        onBack={goBack}
        onOpenSettings={openSettings}
      />

      {view.status === "ready" ? (
        <ReadingView
          chapter={view.chapter}
          theme={theme}
          palette={palette}
          font={atkinsonEnabled ? "atkinson" : "literata"}
          fontSize={fontSize}
          lineSpacing={lineSpacing}
          toolbarBottom={toolbarBottom}
          onCycleTheme={cycleTheme}
          onOpenSettings={openSettings}
          onNearEnd={onNearEnd}
        />
      ) : view.status === "loading" ? (
        <ReaderSkeleton palette={palette} fontSize={fontSize} lineSpacing={lineSpacing} />
      ) : (
        <View
          className="flex-1"
          // Centred in the space the toolbar leaves, where there is one.
          style={{ paddingBottom: status === "no-text" ? toolbarBottom + TOOLBAR_HEIGHT : insets.bottom }}
        >
          <ReaderStateMessage
            status={view.status}
            palette={palette}
            chapterNumber={chapterNumber}
            onRetry={onRetry}
            onBack={goBack}
          />
        </View>
      )}

      {status === "no-text" ? (
        <ReaderToolbar
          theme={theme}
          position={null}
          bottomOffset={toolbarBottom}
          onCycleTheme={cycleTheme}
          onOpenSettings={openSettings}
          onListen={listen}
        />
      ) : null}

      <ReaderSettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        atkinsonEnabled={atkinsonEnabled}
        onChangeTheme={setTheme}
        onChangeFontSize={setFontSize}
        onChangeLineSpacing={setLineSpacing}
        onChangeAtkinson={setAtkinsonEnabled}
      />
    </Screen>
  );
}

type ReadingViewProps = {
  chapter: ReadyChapter;
  theme: ReaderTheme;
  palette: ReaderPalette;
  font: ReaderFont;
  fontSize: number;
  lineSpacing: number;
  toolbarBottom: number;
  onCycleTheme: () => void;
  onOpenSettings: () => void;
  onNearEnd: () => void;
};

/** The ready state: the chapter, the auto-hiding toolbar and the progress bar. */
function ReadingView({
  chapter,
  theme,
  palette,
  font,
  fontSize,
  lineSpacing,
  toolbarBottom,
  onCycleTheme,
  onOpenSettings,
  onNearEnd,
}: ReadingViewProps) {
  // Scoped to reading: released when this unmounts, never app-wide.
  useKeepAwake();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const { id, bookId, number, title, blocks, lastChapterNumber, previousId, nextId, restoreOffset } = chapter;
  const position = useReadingPosition({
    chapterId: id,
    bookId,
    blocks,
    restoreOffset,
    scrollRef,
    fontSize,
    lineSpacing,
    font,
    restoreInset: paragraphGap(fontSize) / 2,
  });
  const chrome = useReaderChrome({
    bottomOffset: toolbarBottom,
    onDragStart: position.onDragStart,
    onScrollActivity: position.onScrollActivity,
  });

  // Clears the toolbar, its gap and the bottom inset, so the last line and
  // the end-of-chapter controls are never covered.
  const bottomPadding = toolbarBottom + TOOLBAR_HEIGHT + TOOLBAR_CLEARANCE;

  // By the settled position, so a fling past 80% prefetches once it stops.
  const nearEnd = position.percent >= PREFETCH_NEXT_AT_PERCENT;
  useEffect(() => {
    if (nearEnd) onNearEnd();
  }, [nearEnd, onNearEnd]);

  return (
    <>
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={chrome.scrollHandler}
        scrollEventThrottle={16}
        onLayout={position.onViewportLayout}
        onContentSizeChange={position.onContentSizeChange}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        <ChapterBody
          blocks={blocks}
          chapterNumber={number}
          chapterTitle={title}
          palette={palette}
          faces={READER_FACES[font]}
          fontSize={fontSize}
          lineSpacing={lineSpacing}
          onBodyLayout={position.onBodyLayout}
          onBlockLayout={position.onBlockLayout}
          onTap={chrome.toggleToolbar}
          onNext={nextId === null ? null : () => openChapter(nextId)}
          onPrevious={previousId === null ? null : () => openChapter(previousId)}
        />
      </Animated.ScrollView>

      <ReaderToolbar
        theme={theme}
        position={{ chapterNumber: number, lastChapterNumber, percent: position.percent }}
        bottomOffset={toolbarBottom}
        animatedStyle={chrome.toolbarStyle}
        onLayout={chrome.onToolbarLayout}
        onCycleTheme={onCycleTheme}
        onOpenSettings={onOpenSettings}
        onListen={listen}
      />

      <ReaderProgressBar animatedStyle={chrome.progressStyle} />
    </>
  );
}
