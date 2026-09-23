import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { markStoreHydrated, registerHydratingStore } from "@/store/hydration";

const STORE_NAME = "splash";
const SPLASH_STORAGE_KEY = "talebrim.store.splash";

interface SplashState {
  /**
   * Whether the pre-sign-in marketing splash (`(auth)/onboarding.tsx`,
   * "Read it. Or hear it.") has ever been shown on this device. Device-scoped
   * like `reader`, not per-account like `onboarding-store` — signing out
   * must not bring the splash back for the next person on this phone.
   */
  hasSeenSplash: boolean;
  markSplashSeen: () => void;
}

registerHydratingStore(STORE_NAME);

export const useSplashStore = create<SplashState>()(
  persist(
    (set) => ({
      hasSeenSplash: false,
      markSplashSeen: () => set({ hasSeenSplash: true }),
    }),
    {
      name: SPLASH_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      migrate: (persisted) => persisted as SplashState,
      onRehydrateStorage: () => () => {
        markStoreHydrated(STORE_NAME);
      },
    },
  ),
);
