import { useAuth } from "@clerk/expo";
import { useEffect, useState } from "react";

import { useAudioSnapshot } from "@/hooks/use-audio";
import {
  playChapter,
  playLoadedFrom,
  seekPlayback,
  setSleepTimer,
  skipPlayback,
  togglePlayback,
  type LoadedChapter,
} from "@/lib/audio/player";
import { chooseDuration, playbackStatusOf, sleepSecondsLeft, type PlaybackStatus } from "@/lib/audio/rules";
import type { RestorePoint } from "@/lib/parity/convert";
import { usePlaybackStore } from "@/store/playback-store";

export type SleepTimer = {
  /** The option chosen in the sheet. */
  minutes: number;
  secondsLeft: number;
};

const SLEEP_TICK_MS = 1000;

/**
 * The sleep timer as M6 shows it. The timer itself lives in `lib/audio` and
 * outlives this screen; this only counts down its end time for the label.
 */
function useSleepTimer(): SleepTimer | null {
  const endsAt = usePlaybackStore((state) => state.sleepTimerEndsAt);
  const minutes = usePlaybackStore((state) => state.sleepTimerLength);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const timer = setInterval(() => setNow(Date.now()), SLEEP_TICK_MS);
    return () => clearInterval(timer);
  }, [endsAt]);

  if (endsAt === null || minutes === null) return null;
  // Never more than the length chosen: `now` can predate the choice by up to a tick.
  return { minutes, secondsLeft: Math.min(minutes * 60, sleepSecondsLeft(endsAt, now)) };
}

type Playback = {
  status: PlaybackStatus;
  /** Seconds into the chapter. */
  elapsed: number;
  /**
   * How the place the scrubber shows was mapped from reading, for the notice
   * (prompt 19 step 8); null when it is the listener's own place.
   */
  mapped: RestorePoint["mapped"];
  /** The catalog's measured length, else the player's once known; null is "Duration unknown". */
  durationSeconds: number | null;
  sleep: SleepTimer | null;
  togglePlay: () => void;
  seekTo: (seconds: number) => void;
  skipBy: (seconds: number) => void;
  setSleepTimer: (minutes: number | null) => void;
};

/**
 * M6's playback on the app's one player (`lib/audio/player.ts`): the shape the
 * prompt-17 shell had, plus the duration it plays against.
 *
 * On the LOADED chapter all of it is the player's: its status, position and
 * duration, and seeks and skips go to it. On any other chapter nothing
 * changes what is playing until Play. The scrubber shows where Play will
 * start (`restore`, moved by a seek or skip), and Play records and flushes
 * the old chapter, then loads this one there.
 *
 * `restore` on the loaded chapter is set only while reading has moved its
 * place since (prompt 19 step 4). While it is paused, the scrubber shows that
 * mapped point and Play starts there; a seek or skip moves on from it and
 * records, which makes the listener's place the newer one again.
 */
export function useAudioPlayback(chapter: LoadedChapter, restore: RestorePoint | null): Playback {
  const { userId } = useAuth();
  const audio = useAudioSnapshot();
  const [pendingSeconds, setPendingSeconds] = useState((restore?.value ?? 0) / 1000);
  const sleep = useSleepTimer();

  const isLoaded = audio.chapter?.chapterId === chapter.chapterId;
  const status = isLoaded ? playbackStatusOf(audio.phase, audio.status) : "paused";
  const durationSeconds = isLoaded
    ? chooseDuration(chapter.durationSeconds, audio.status?.duration)
    : chapter.durationSeconds;

  const clamp = (seconds: number) =>
    Math.max(0, durationSeconds === null ? seconds : Math.min(seconds, durationSeconds));

  // The loaded chapter, paused, where reading has moved the place since.
  const readingPoint =
    isLoaded && restore !== null && audio.phase === "ready" && status === "paused" ? restore.value / 1000 : null;

  // While the chapter loads, the scrubber holds where the load is headed.
  const elapsed = !isLoaded
    ? pendingSeconds
    : readingPoint !== null
      ? readingPoint
      : audio.phase !== "ready" || audio.status === null
        ? audio.targetMs / 1000
        : audio.status.currentTime;

  function togglePlay() {
    if (isLoaded) {
      if (readingPoint !== null) playLoadedFrom(Math.round(readingPoint * 1000));
      else togglePlayback();
      return;
    }
    if (!userId) return;
    // Only what the player keeps: a screen's own fields never ride along.
    const { chapterId, bookId, number, title, bookTitle, author, coverUrl } = chapter;
    playChapter(
      userId,
      { chapterId, bookId, number, title, bookTitle, author, coverUrl, durationSeconds: chapter.durationSeconds },
      Math.round(pendingSeconds * 1000),
    );
  }

  function skipBy(seconds: number) {
    if (!isLoaded) setPendingSeconds((at) => clamp(at + seconds));
    else if (readingPoint !== null) seekPlayback(clamp(readingPoint + seconds));
    else skipPlayback(seconds);
  }

  return {
    status,
    elapsed,
    mapped: isLoaded && readingPoint === null ? null : (restore?.mapped ?? null),
    durationSeconds,
    sleep,
    togglePlay,
    seekTo: (seconds) => (isLoaded ? seekPlayback(seconds) : setPendingSeconds(clamp(seconds))),
    skipBy,
    setSleepTimer,
  };
}
