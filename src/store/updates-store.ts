import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const UPDATES_STORAGE_KEY = "talebrim.store.updates";

// The Updates inbox's "seen" moment on this phone (2026-09-30), per account:
// sign-out clears it with the other per-account state
// (`clearUserScopedState()`). The account keeps its own copy in Clerk's
// `unsafeMetadata`, so a sign-in or a new phone picks up where the reader
// left off (`hooks/use-updates.ts`); this copy makes it instant, and holds
// offline. A time on the server's clock (`lib/updates.ts`).
interface UpdatesState {
  /** The account `seenAt` belongs to. */
  userId: string | null;
  /** The newest chapter the reader has had in front of them, in epoch ms. */
  seenAt: number | null;
  /** Moves "seen" forward, never back. */
  markSeen: (userId: string, seenAt: number) => void;
  clear: () => void;
}

type PersistedUpdatesState = Pick<UpdatesState, "userId" | "seenAt">;

export const useUpdatesStore = create<UpdatesState>()(
  persist(
    (set, get) => ({
      userId: null,
      seenAt: null,
      markSeen: (userId, seenAt) => {
        const current = get();
        const previous = current.userId === userId ? current.seenAt : null;
        if (previous !== null && previous >= seenAt) return;
        set({ userId, seenAt });
      },
      clear: () => set({ userId: null, seenAt: null }),
    }),
    {
      name: UPDATES_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state): PersistedUpdatesState => ({ userId: state.userId, seenAt: state.seenAt }),
      // No shape change yet — here so a future one has somewhere to go.
      migrate: (persisted) => persisted as PersistedUpdatesState,
    },
  ),
);
