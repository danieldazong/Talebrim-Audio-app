import { create } from "zustand";

// SERVER COPY — added by the parity prompt.
//
// `reading_positions` does not exist yet (AGENTS.md Data Contract), so this
// store is the ONLY copy of a user's position right now — there is no server
// row to reconcile against and no last-write-wins comparison to make. It is
// written so that a server sync can be layered on without changing this
// public API: a future write here becomes "write local, then debounce a
// push to Supabase"; a future read gains "resolve against the server
// timestamp, last-write-wins" (AGENTS.md § State Management Rules, Read/listen
// parity algorithm, steps 2–4).
//
// Deliberately NOT persisted to AsyncStorage (prompt 07 step 8): a stale
// on-device position that later loses to the server on last-write-wins is
// worse than no local position at all, so it must not survive an app
// restart until there is a server copy to reconcile against.

export type ParitySourceMode = "text" | "audio";

export interface ChapterParityPosition {
  chapterId: string;
  /** Character offset into `chapters.script_text`. */
  textOffset: number;
  /** Playback position in milliseconds. */
  audioMs: number;
  /** Which mode last wrote this position — lets a mode switch map from the authoritative side. */
  lastWrittenBy: ParitySourceMode;
  updatedAt: number;
}

interface ParityState {
  /** Keyed by chapterId — one authoritative position per chapter in this session. */
  positions: Record<string, ChapterParityPosition>;
  setPosition: (position: ChapterParityPosition) => void;
  getPosition: (chapterId: string) => ChapterParityPosition | undefined;
  clear: () => void;
}

export const useParityStore = create<ParityState>()((set, get) => ({
  positions: {},
  setPosition: (position) =>
    set((state) => ({
      positions: { ...state.positions, [position.chapterId]: position },
    })),
  getPosition: (chapterId) => get().positions[chapterId],
  clear: () => set({ positions: {} }),
}));
