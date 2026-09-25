import { useSyncExternalStore } from "react";

import {
  getAudioSnapshot,
  getPlaybackStatus,
  subscribeAudio,
  type AudioSnapshot,
  type LoadedChapter,
} from "@/lib/audio/player";
import { chooseDuration, type LoadPhase, type PlaybackStatus } from "@/lib/audio/rules";
import { secondsLeft } from "@/lib/library";

// Screens read the app's one player through its one status listener
// (`lib/audio/player.ts`), so M6 and the mini player read the same status and
// can never disagree. Nothing here copies progress into Zustand.

/** Everything, including the position: re-renders on every status, about twice a second while playing. */
export function useAudioSnapshot(): AudioSnapshot {
  return useSyncExternalStore(subscribeAudio, getAudioSnapshot);
}

/** The loaded chapter. Re-renders only when it changes. */
export function useLoadedChapter(): LoadedChapter | null {
  return useSyncExternalStore(subscribeAudio, () => getAudioSnapshot().chapter);
}

/** The play button's state. Re-renders only when it changes. */
export function usePlaybackStatus(): PlaybackStatus {
  return useSyncExternalStore(subscribeAudio, getPlaybackStatus);
}

/** Where the player is with `chapterId`, or null when that isn't the loaded chapter. */
export function useLoadedPhase(chapterId: string): LoadPhase | null {
  return useSyncExternalStore(subscribeAudio, () => {
    const { chapter, phase } = getAudioSnapshot();
    return chapter?.chapterId === chapterId ? phase : null;
  });
}

/**
 * Whole seconds left in `chapterId` while it is the loaded chapter, as M6
 * counts its remaining time; null when another chapter is loaded, or the
 * length is unknown. A number, not an object, so it re-renders about once a
 * second while playing, and not at all while paused.
 */
export function useLoadedSecondsLeft(chapterId: string | null): number | null {
  return useSyncExternalStore(subscribeAudio, () => {
    const { chapter, phase, status, targetMs } = getAudioSnapshot();
    if (chapterId === null || chapter?.chapterId !== chapterId) return null;
    // While a load runs, where it is headed, as M6's scrubber shows it.
    const positionMs = phase !== "ready" || status === null ? targetMs : status.currentTime * 1000;
    return secondsLeft(positionMs, chooseDuration(chapter.durationSeconds, status?.duration));
  });
}
