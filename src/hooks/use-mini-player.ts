import { router } from "expo-router";

import { useLoadedChapter, usePlaybackStatus } from "@/hooks/use-audio";
import { togglePlayback, type LoadedChapter } from "@/lib/audio/player";
import type { PlaybackStatus } from "@/lib/audio/rules";

export type MiniPlayerTrack = {
  chapterId: string;
  /** Null when the book has no cover: a flat `surface` box, never the local art. */
  coverUrl: string | null;
  /** "{book} · Ch. {n}". */
  title: string;
  author: string | null;
};

function toTrack(chapter: LoadedChapter): MiniPlayerTrack {
  return {
    chapterId: chapter.chapterId,
    coverUrl: chapter.coverUrl,
    title: `${chapter.bookTitle} · Ch. ${chapter.number}`,
    author: chapter.author,
  };
}

/**
 * The mini player's data: the player's loaded chapter, as its lock screen
 * shows it, and the same status M6 reads. Null until something plays, and
 * after sign-out.
 */
export function useMiniPlayer(): {
  track: MiniPlayerTrack | null;
  status: PlaybackStatus;
  togglePlay: () => void;
  open: () => void;
} {
  const chapter = useLoadedChapter();
  const status = usePlaybackStatus();

  return {
    track: chapter === null ? null : toTrack(chapter),
    status,
    togglePlay: togglePlayback,
    open: () => {
      if (chapter !== null) {
        router.push({ pathname: "/player/[chapterId]", params: { chapterId: chapter.chapterId } });
      }
    },
  };
}
