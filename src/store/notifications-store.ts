import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const NOTIFICATIONS_STORAGE_KEY = "talebrim.store.notifications";

// New-chapter alerts, per account — prompt 23a. Cleared at sign-out with the
// other per-account state (`clearUserScopedState()`), so the next account on
// this phone is asked once and starts with alerts off. The server's copy is
// `push_tokens`, written through `lib/push.ts`; this slice is what the phone
// asked for.
//
// Not registered with `store/hydration.ts`, as the search slice isn't: nothing
// routes on it. `hooks/use-alerts-sync.ts` waits for it to rehydrate before
// telling the server anything, so a cold start never releases the token of a
// reader who has alerts on.
interface NotificationsState {
  /**
   * This account answered the ask: "Notify me", "Not now", or closing the
   * sheet. The app never opens it on its own again.
   */
  answered: boolean;
  /** Alerts are on for this account on this phone. */
  enabled: boolean;
  /** Alerts turned on or off. Either is an answer. */
  setEnabled: (enabled: boolean) => void;
  markAnswered: () => void;
  clear: () => void;
}

type PersistedNotificationsState = Pick<NotificationsState, "answered" | "enabled">;

export const useNotificationsStore = create<NotificationsState>()(
  persist(
    (set) => ({
      answered: false,
      enabled: false,
      setEnabled: (enabled) => set({ enabled, answered: true }),
      markAnswered: () => set({ answered: true }),
      clear: () => set({ answered: false, enabled: false }),
    }),
    {
      name: NOTIFICATIONS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state): PersistedNotificationsState => ({
        answered: state.answered,
        enabled: state.enabled,
      }),
      // No shape change yet — here so a future one has somewhere to go.
      migrate: (persisted) => persisted as PersistedNotificationsState,
    },
  ),
);
