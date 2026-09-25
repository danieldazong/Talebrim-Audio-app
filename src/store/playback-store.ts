import { create } from "zustand";

// Session-only — never persisted. AGENTS.md § store/.
//
// The app's one audio player (`lib/audio/player.ts`) is the source of truth
// for what is loaded and whether it plays; this slice mirrors only what
// changes rarely. Playing, buffering and the position are read from the
// player's own status (`hooks/use-audio.ts`), never copied here on every tick.
//
// Only `lib/audio` writes this slice.
interface PlaybackState {
  /** The chapter loaded in the player, mirrored. Null until something plays, and after sign-out. */
  currentChapterId: string | null;
  /** Playback rate, e.g. 1, 1.25, 1.5, 2. The player applies it on change and after every load. */
  speed: number;
  /** When the sleep timer pauses playback, in epoch milliseconds; null when it is off. */
  sleepTimerEndsAt: number | null;
  /** The length chosen for it, in minutes: the sheet's selected option. Null when it is off. */
  sleepTimerLength: number | null;
  setCurrentChapterId: (chapterId: string | null) => void;
  setSpeed: (speed: number) => void;
  setSleepTimer: (timer: { endsAt: number; length: number } | null) => void;
  reset: () => void;
}

const DEFAULT_SPEED = 1;

const initialState = {
  currentChapterId: null,
  speed: DEFAULT_SPEED,
  sleepTimerEndsAt: null,
  sleepTimerLength: null,
} satisfies Pick<PlaybackState, "currentChapterId" | "speed" | "sleepTimerEndsAt" | "sleepTimerLength">;

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  ...initialState,
  setCurrentChapterId: (currentChapterId) => set({ currentChapterId }),
  setSpeed: (speed) => set({ speed }),
  setSleepTimer: (timer) =>
    set({ sleepTimerEndsAt: timer?.endsAt ?? null, sleepTimerLength: timer?.length ?? null }),
  reset: () => set(initialState),
}));
