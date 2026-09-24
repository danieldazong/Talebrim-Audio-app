import { create } from "zustand";

// The session copy of read/listen parity — AGENTS.md § Read/listen parity.
//
// Session-authoritative (parity step 1): every position lands here first, and
// the reader restores from here. The server copy lives in `reading_positions`,
// and `lib/parity/writer.ts` owns both sides of the sync: it records positions
// into this slice, pushes them, and adopts a newer server row by the rule in
// `lib/parity/reconcile.ts`. Nothing else calls `setPosition`.
//
// Deliberately NOT persisted to AsyncStorage (prompt 07 step 8): a stale
// on-device position that later loses last-write-wins is worse than none. A
// new app session restores from the server row instead.
//
// No device-clock timestamp is kept, so none can be compared: the only
// ordering is the server's `updated_at` (parity step 3).

export type ParitySourceMode = "text" | "audio";

export interface ChapterParityPosition {
  chapterId: string;
  /** Character offset into `chapters.script_text`; null when unknown, never 0. */
  textOffset: number | null;
  /** Playback position in milliseconds; null when unknown, never 0. */
  audioMs: number | null;
  /** Which mode last wrote this position — lets a mode switch map from the authoritative side. */
  lastWrittenBy: ParitySourceMode;
  /** The server `updated_at` of the row last written or adopted; null if never synced. */
  syncedAt: string | null;
  /** True while this holds a change the server has not confirmed. */
  dirty: boolean;
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
