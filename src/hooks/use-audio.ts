import { useSyncExternalStore } from "react";

import {
  getAudioSnapshot,
  getPlaybackStatus,
  subscribeAudio,
  type AudioSnapshot,
  type LoadedChapter,
} from "@/lib/audio/player";
import type { LoadPhase, PlaybackStatus } from "@/lib/audio/rules";

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
