import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, View } from "react-native";

import { PlayerSecondaryControls, PlayerTransport } from "@/components/player/player-controls";
import { PlayerCover } from "@/components/player/player-cover";
import { PlayerHeader } from "@/components/player/player-header";
import { PlayerMetadata } from "@/components/player/player-metadata";
import { PlayerOptionsSheet, type SheetOption } from "@/components/player/player-options-sheet";
import { PlayerScrubber, ScrubberSkeleton } from "@/components/player/player-scrubber";
import { PlayerStateMessage } from "@/components/player/player-states";
import { Screen } from "@/components/ui";
import {
  useNowPlaying,
  type NowPlayingMeta,
  type NowPlayingView,
  type PlayingChapter,
} from "@/hooks/use-now-playing";
import { useAudioPlayback } from "@/hooks/use-audio-playback";
import { useHandoffNotice } from "@/hooks/use-handoff-notice";
import { onChapterAdvance, pausePlayback, setPlaybackSpeed, skipToChapter } from "@/lib/audio/player";
import { formatSpeed } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { usePlaybackStore } from "@/store/playback-store";
import { nowPlayingGradient } from "@/theme";

// M6 Now Playing — AGENTS.md M6, prompts 17 to 19.
//
// A stack route outside (tabs), presented from the bottom to match its
// down-chevron dismiss, receiving only the chapter id, plus a `play` flag
// from M5's Listen (prompt 19 step 5). No tab bar and no mini player, by
// construction. The book and chapter come from `hooks/use-now-playing.ts`;
// the playback is the app's one player (`lib/audio/player.ts`, through
// `hooks/use-audio-playback.ts`), which outlives this screen.

/** Exactly 15 seconds, for the skip controls and the scrubber's screen-reader actions. */
const SKIP_SECONDS = 15;

/** Standard player options, not taken from the frame (AGENTS.md § Decisions — 2026-09-24). */
const SPEED_OPTIONS: SheetOption<number>[] = [0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => ({
  value: speed,
  label: `${formatSpeed(speed)}x`,
  accessibilityLabel: `${formatSpeed(speed)} times`,
}));

const SLEEP_OPTIONS: SheetOption<number | null>[] = [
  ...[5, 10, 15, 30, 45, 60].map((minutes) => ({ value: minutes, label: `${minutes} minutes` })),
  { value: null, label: "Off" },
];

const NO_META: NowPlayingMeta = { book: null, chapter: null };

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

// Replaced rather than pushed, as M5's chapter navigation is. A locked
// chapter opens in its locked state.
function openChapter(chapterId: string) {
  router.replace({ pathname: "/player/[chapterId]", params: { chapterId } });
}

/**
 * The handoff to M5 (prompt 19 step 6). The route is the only payload: the
 * reader restores from the parity slice, which the pause has just recorded.
 * Replaced, so back after any number of handoffs lands where the first one
 * started.
 */
function openReader(chapterId: string) {
  router.replace({ pathname: "/reader/[chapterId]", params: { chapterId } });
}

function noop() {}

export default function PlayerRoute() {
  const { chapterId, play } = useLocalSearchParams<{ chapterId: string; play?: string }>();

  // Android back pops the player like the chevron does. With nothing to go
  // back to (a deep link), it goes home instead of leaving the app.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (router.canGoBack()) return false;
        router.replace("/");
        return true;
      });
      return () => subscription.remove();
    }, []),
  );

  // A stale or hand-typed link is simply not available: there is nothing to
  // fetch and nothing a retry could fix.
  if (!isUuid(chapterId)) {
    return <Player view={{ status: "unavailable" }} meta={NO_META} onRetry={noop} onRead={noop} />;
  }
  return <ChapterPlayer key={chapterId} chapterId={chapterId} autoplay={play === "1"} />;
}

function ChapterPlayer({ chapterId, autoplay }: { chapterId: string; autoplay: boolean }) {
  const { view, meta, retry } = useNowPlaying(chapterId);

  // M5's Listen asked for playback (prompt 19 step 5). Consumed once, by the
  // ready state, and cleared from the route so a re-render or a remount
  // never starts it again. Any other state plays nothing.
  const [autoplayPending, setAutoplayPending] = useState(autoplay);
  const consumeAutoplay = useCallback(() => {
    setAutoplayPending(false);
    router.setParams({ play: undefined });
  }, []);

  // Autoplay moved on from this chapter: follow it. Only this screen's own
  // subscription goes with it on unmount; the player keeps playing.
  useEffect(
    () =>
      onChapterAdvance((fromChapterId, toChapterId) => {
        if (fromChapterId === chapterId) openChapter(toChapterId);
      }),
    [chapterId],
  );

  // No narration: nothing plays, so there is no place to hand over. The
  // reader restores its own.
  const read = () => openReader(chapterId);

  return (
    <Player
      view={view}
      meta={meta}
      autoplay={autoplayPending}
      onAutoplay={consumeAutoplay}
      onRetry={retry}
      onRead={read}
    />
  );
}

type PlayerProps = {
  view: NowPlayingView;
  /** The metadata lines: shown whenever they are known, in any state. */
  meta: NowPlayingMeta;
  /** Start playing once the ready state shows (M5's Listen). */
  autoplay?: boolean;
  /** Called as the ready state acts on `autoplay`. */
  onAutoplay?: () => void;
  onRetry: () => void;
  /** The no-audio state's Read instead. */
  onRead: () => void;
};

function Player({ view, meta, autoplay = false, onAutoplay = noop, onRetry, onRead }: PlayerProps) {
  return (
    // The app's only full-screen gradient (AGENTS.md § Design System),
    // under the status bar and the home indicator.
    <LinearGradient colors={nowPlayingGradient} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Screen backgroundColor="transparent">
        <PlayerHeader onClose={close} syncActive={view.status === "ready" && view.chapter.isLoaded} />

        {view.status === "ready" ? (
          <PlayingView chapter={view.chapter} meta={meta} autoplay={autoplay} onAutoplay={onAutoplay} />
        ) : view.status === "loading" ? (
          <View className="flex-1 pb-8">
            <PlayerCover coverUrl={null} loading />
            <PlayerMetadata meta={meta} loading />
            <ScrubberSkeleton className="mt-8" />
            <PlayerTransport
              status="paused"
              disabled
              onTogglePlay={noop}
              onSkipBack={noop}
              onSkipForward={noop}
              onPrevious={null}
              onNext={null}
              className="mt-9"
            />
            {/* The secondary row's height, so the cover doesn't move when it arrives. */}
            <View className="mt-9 h-11" />
          </View>
        ) : (
          <View className="flex-1 pb-8">
            <PlayerMetadata meta={meta} className="pt-8" />
            <PlayerStateMessage
              status={view.status}
              chapterNumber={meta.chapter?.number ?? null}
              onRetry={onRetry}
              onBack={close}
              onRead={onRead}
            />
          </View>
        )}
      </Screen>
    </LinearGradient>
  );
}

type PlayingViewProps = {
  chapter: PlayingChapter;
  meta: NowPlayingMeta;
  autoplay: boolean;
  onAutoplay: () => void;
};

/** The ready state: the cover, the lines, the scrubber and both control rows. */
function PlayingView({ chapter, meta, autoplay, onAutoplay }: PlayingViewProps) {
  const { previousId, nextId } = chapter;

  // The `playback` slice is the source; `lib/audio` applies it to the player.
  const speed = usePlaybackStore((state) => state.speed);
  // Positions record in `lib/audio`, for the loaded chapter, through `lib/parity`.
  const playback = useAudioPlayback(chapter, chapter.restore);
  const [sheet, setSheet] = useState<"speed" | "sleep" | null>(null);
  // Opened at a place mapped from reading: said for four seconds in the
  // bookmark's slot (prompt 19 step 8).
  const notice = useHandoffNotice(playback.mapped, "Near where you were reading");

  // M5's Listen: the chapter starts at its restore point, as Play would.
  // Only from paused: a chapter already playing or loading carries on.
  const autoplayed = useRef(false);
  useEffect(() => {
    if (!autoplay || autoplayed.current) return;
    autoplayed.current = true;
    onAutoplay();
    if (playback.status === "paused") playback.togglePlay();
  }, [autoplay, onAutoplay, playback]);

  // Reading instead stops the audio on the loaded chapter: two surfaces
  // recording one chapter would fight over `last_mode`. The pause records the
  // place and starts the flush without waiting on it. Any other chapter only
  // navigates: what plays is not this screen's to stop.
  const readInstead = () => {
    if (chapter.isLoaded) pausePlayback();
    openReader(chapter.chapterId);
  };

  const skipBack = () => playback.skipBy(-SKIP_SECONDS);
  const skipForward = () => playback.skipBy(SKIP_SECONDS);
  const closeSheet = () => setSheet(null);

  // On the loaded chapter a real track change, which keeps playing if it
  // was; on any other, navigation only.
  const goToChapter = (targetId: string) => {
    if (chapter.isLoaded) void skipToChapter(targetId);
    openChapter(targetId);
  };

  return (
    <View className="flex-1 pb-8">
      <PlayerCover coverUrl={chapter.coverUrl} />
      <PlayerMetadata meta={meta} />

      <PlayerScrubber
        elapsed={playback.elapsed}
        durationSeconds={playback.durationSeconds}
        hasBookmark={chapter.hasBookmark}
        notice={notice}
        onSeek={playback.seekTo}
        onSkipBack={skipBack}
        onSkipForward={skipForward}
        className="mt-8"
      />

      <PlayerTransport
        status={playback.status}
        onTogglePlay={playback.togglePlay}
        onSkipBack={skipBack}
        onSkipForward={skipForward}
        onPrevious={previousId === null ? null : () => goToChapter(previousId)}
        onNext={nextId === null ? null : () => goToChapter(nextId)}
        className="mt-9"
      />

      <PlayerSecondaryControls
        speed={speed}
        sleepMinutesLeft={playback.sleep === null ? null : Math.ceil(playback.sleep.secondsLeft / 60)}
        onOpenSpeed={() => setSheet("speed")}
        onOpenSleepTimer={() => setSheet("sleep")}
        onReadInstead={chapter.hasText ? readInstead : null}
        className="mt-9"
      />

      <PlayerOptionsSheet
        visible={sheet === "speed"}
        title="Playback speed"
        options={SPEED_OPTIONS}
        value={speed}
        onSelect={setPlaybackSpeed}
        onClose={closeSheet}
      />
      <PlayerOptionsSheet
        visible={sheet === "sleep"}
        title="Sleep timer"
        options={SLEEP_OPTIONS}
        value={playback.sleep?.minutes ?? null}
        onSelect={playback.setSleepTimer}
        onClose={closeSheet}
      />
    </View>
  );
}
