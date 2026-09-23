import { create } from "zustand";

// Session-only — never persisted. AGENTS.md § store/: playback status and
// scrub position belong in Zustand but not on disk; `react-native-track-player`
// is the source of truth for the actual audio engine, this mirrors it for UI.
interface PlaybackState {
  currentChapterId: string | null;
  isPlaying: boolean;
  /** Playback rate, e.g. 1, 1.25, 1.5, 2. */
  speed: number;
  /** Minutes remaining on the sleep timer, or null when off. */
  sleepTimerMinutes: number | null;
  setCurrentChapterId: (chapterId: string | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setSpeed: (speed: number) => void;
  setSleepTimerMinutes: (minutes: number | null) => void;
  reset: () => void;
}

const DEFAULT_SPEED = 1;

const initialState = {
  currentChapterId: null,
  isPlaying: false,
  speed: DEFAULT_SPEED,
  sleepTimerMinutes: null,
} satisfies Pick<
  PlaybackState,
  "currentChapterId" | "isPlaying" | "speed" | "sleepTimerMinutes"
>;

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  ...initialState,
  setCurrentChapterId: (currentChapterId) => set({ currentChapterId }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setSpeed: (speed) => set({ speed }),
  setSleepTimerMinutes: (sleepTimerMinutes) => set({ sleepTimerMinutes }),
  reset: () => set(initialState),
}));
