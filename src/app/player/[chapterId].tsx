import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
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
import { useShellPlayback } from "@/hooks/use-shell-playback";
import { formatSpeed } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { usePlaybackStore } from "@/store/playback-store";
import { nowPlayingGradient } from "@/theme";

// M6 Now Playing — AGENTS.md M6, prompt 17.
//
// A stack route outside (tabs), presented from the bottom to match its
// down-chevron dismiss, receiving only the chapter id. No tab bar and no mini
// player, by construction. Everything it shows about the book and chapter is
// real (`hooks/use-now-playing.ts`); only the playback is mocked
// (`hooks/use-shell-playback.ts`) until prompt 18.

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

function noop() {}

export default function PlayerRoute() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();

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
  return <ChapterPlayer key={chapterId} chapterId={chapterId} />;
}

function ChapterPlayer({ chapterId }: { chapterId: string }) {
  const { view, meta, retry } = useNowPlaying(chapterId);

  // No narration: the reader restores its own place. Not the handoff, which
  // carries an audio position (prompt 19).
  const read = () => router.replace({ pathname: "/reader/[chapterId]", params: { chapterId } });

  return <Player view={view} meta={meta} onRetry={retry} onRead={read} />;
}

type PlayerProps = {
  view: NowPlayingView;
  /** The metadata lines: shown whenever they are known, in any state. */
  meta: NowPlayingMeta;
  onRetry: () => void;
  /** The no-audio state's Read instead. */
  onRead: () => void;
};

function Player({ view, meta, onRetry, onRead }: PlayerProps) {
  return (
    // The app's only full-screen gradient (AGENTS.md § Design System),
    // under the status bar and the home indicator.
    <LinearGradient colors={nowPlayingGradient} style={{ flex: 1 }}>
      <StatusBar style="light" />
      <Screen backgroundColor="transparent">
        <PlayerHeader onClose={close} />

        {view.status === "ready" ? (
          <PlayingView chapter={view.chapter} meta={meta} />
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

// TODO(handoff): open M5 at the equivalent position. Not before the handoff
// carries it through `lib/parity` (prompt 19): one that drops the listener's
// place is worse than none.
function readInstead() {}

/** The ready state: the cover, the lines, the scrubber and both control rows. */
function PlayingView({ chapter, meta }: { chapter: PlayingChapter; meta: NowPlayingMeta }) {
  const { durationSeconds, previousId, nextId } = chapter;

  // Speed is a real session preference, so it goes to the `playback` slice.
  // Nothing here sets `currentChapterId` or `isPlaying`: the mini player
  // would show a track that isn't playing.
  const speed = usePlaybackStore((state) => state.speed);
  const setSpeed = usePlaybackStore((state) => state.setSpeed);
  // SHELL — wired in prompt 18. Nothing records a position yet: prompt 18
  // records audio positions through `lib/parity`.
  const playback = useShellPlayback(durationSeconds, speed);
  const [sheet, setSheet] = useState<"speed" | "sleep" | null>(null);

  const skipBack = () => playback.skipBy(-SKIP_SECONDS);
  const skipForward = () => playback.skipBy(SKIP_SECONDS);
  const closeSheet = () => setSheet(null);

  return (
    <View className="flex-1 pb-8">
      <PlayerCover coverUrl={chapter.coverUrl} />
      <PlayerMetadata meta={meta} />

      <PlayerScrubber
        elapsed={playback.elapsed}
        durationSeconds={durationSeconds}
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
        // Prompt 18 turns these into real track changes.
        onPrevious={previousId === null ? null : () => openChapter(previousId)}
        onNext={nextId === null ? null : () => openChapter(nextId)}
        className="mt-9"
      />

      <PlayerSecondaryControls
        speed={speed}
        sleepMinutesLeft={playback.sleep === null ? null : Math.ceil(playback.sleep.secondsLeft / 60)}
        onOpenSpeed={() => setSheet("speed")}
        onOpenSleepTimer={() => setSheet("sleep")}
        onReadInstead={readInstead}
        className="mt-9"
      />

      <PlayerOptionsSheet
        visible={sheet === "speed"}
        title="Playback speed"
        options={SPEED_OPTIONS}
        value={speed}
        onSelect={setSpeed}
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
