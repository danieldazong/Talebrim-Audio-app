import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
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
import { mockChapter } from "@/data/mock-chapter";
import { useReaderChrome } from "@/hooks/use-reader-chrome";
import { useReadingPosition } from "@/hooks/use-reading-position";
import { parseChapterText } from "@/lib/chapter-text";
import { isUuid } from "@/lib/ids";
import { useReaderStore, type ReaderTheme } from "@/store/reader-store";
import type { ReaderFont } from "@/theme";
import type { ReaderStatus } from "@/types/states";

// M5 Reader — AGENTS.md M5, prompt 14.
//
// A pushed stack route outside (tabs), receiving only the chapter id. No tab
// bar and no mini player, by construction: both live in the tab shell, which
// this route never mounts inside, during the push transition or after it.
//
// MOCK — prompt 15 fetches real script_text. Until then every valid id shows
// `data/mock-chapter.ts`, and its `status` picks the state on screen.

const mockBlocks = parseChapterText(mockChapter.scriptText);

/** Clear space between the end of the chapter and the toolbar's top edge. */
const TOOLBAR_CLEARANCE = 16;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

// TODO(handoff): push M6 at the equivalent position. Not before the parity
// prompt writes positions: a handoff that loses the reader's place is worse
// than no handoff.
function listen() {}

// Wired in prompt 15
function goToNextChapter() {}

// Wired in prompt 15
function goToPreviousChapter() {}

// Wired in prompt 15
function retry() {}

export default function ReaderRoute() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();

  // A stale or hand-typed link is simply not available: there is nothing to
  // fetch and nothing a retry could fix.
  if (!isUuid(chapterId)) return <Reader chapterId={null} />;
  return <Reader key={chapterId} chapterId={chapterId} />;
}

function Reader({ chapterId }: { chapterId: string | null }) {
  const status: ReaderStatus = chapterId === null ? "unavailable" : mockChapter.status;

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

  // The chapter's row exists in these states, so its titles are known.
  const hasChapter = status === "ready" || status === "no-text" || status === "locked";

  const cycleTheme = () => setTheme(NEXT_THEME[theme]);
  const openSettings = () => setSettingsOpen(true);

  return (
    <Screen edges={["top"]} backgroundColor={palette.colors.page}>
      {/* The app sets light icons, which vanish on a light page. This one
          unmounts with the screen, and the app's style returns. */}
      <StatusBar style={palette.statusBar} />

      <ReaderTopBar
        palette={palette}
        bookTitle={hasChapter ? mockChapter.bookTitle : null}
        chapterNumber={hasChapter ? mockChapter.chapterNumber : null}
        onBack={goBack}
        onOpenSettings={openSettings}
      />

      {status === "ready" && chapterId !== null ? (
        <ReadingView
          chapterId={chapterId}
          theme={theme}
          palette={palette}
          font={atkinsonEnabled ? "atkinson" : "literata"}
          fontSize={fontSize}
          lineSpacing={lineSpacing}
          toolbarBottom={toolbarBottom}
          onCycleTheme={cycleTheme}
          onOpenSettings={openSettings}
        />
      ) : status === "loading" ? (
        <ReaderSkeleton palette={palette} fontSize={fontSize} lineSpacing={lineSpacing} />
      ) : status === "ready" ? null : (
        <View
          className="flex-1"
          // Centred in the space the toolbar leaves, where there is one.
          style={{ paddingBottom: status === "no-text" ? toolbarBottom + TOOLBAR_HEIGHT : insets.bottom }}
        >
          <ReaderStateMessage
            status={status}
            palette={palette}
            chapterNumber={hasChapter ? mockChapter.chapterNumber : null}
            onRetry={retry}
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
  chapterId: string;
  theme: ReaderTheme;
  palette: ReaderPalette;
  font: ReaderFont;
  fontSize: number;
  lineSpacing: number;
  toolbarBottom: number;
  onCycleTheme: () => void;
  onOpenSettings: () => void;
};

/** The ready state: the chapter, the auto-hiding toolbar and the progress bar. */
function ReadingView({
  chapterId,
  theme,
  palette,
  font,
  fontSize,
  lineSpacing,
  toolbarBottom,
  onCycleTheme,
  onOpenSettings,
}: ReadingViewProps) {
  // Scoped to reading: released when this unmounts, never app-wide.
  useKeepAwake();

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const position = useReadingPosition({
    chapterId,
    blocks: mockBlocks,
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

  const { chapterNumber, chapterCount } = mockChapter;

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
          blocks={mockBlocks}
          chapterNumber={chapterNumber}
          chapterTitle={mockChapter.chapterTitle}
          palette={palette}
          faces={READER_FACES[font]}
          fontSize={fontSize}
          lineSpacing={lineSpacing}
          onBodyLayout={position.onBodyLayout}
          onBlockLayout={position.onBlockLayout}
          onTap={chrome.toggleToolbar}
          onNext={chapterNumber < chapterCount ? goToNextChapter : null}
          onPrevious={chapterNumber > 1 ? goToPreviousChapter : null}
        />
      </Animated.ScrollView>

      <ReaderToolbar
        theme={theme}
        position={{ chapterNumber, chapterCount, percent: position.percent }}
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
