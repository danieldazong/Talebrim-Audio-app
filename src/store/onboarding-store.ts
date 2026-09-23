import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Genre } from "@/data/genres";
import { markStoreHydrated, registerHydratingStore } from "@/store/hydration";

const STORE_NAME = "onboarding";
export const ONBOARDING_STORAGE_KEY = "talebrim.store.onboarding";

interface OnboardingState {
  hasCompletedOnboarding: boolean;
  selectedGenres: Genre[];
  /** M2's "Start Reading" — persists the picked genres and completes M2. */
  completeOnboarding: (genres: Genre[]) => void;
  /** M2's "Skip" — also a completed state; empty selection, never re-shown. */
  skipOnboarding: () => void;
}

registerHydratingStore(STORE_NAME);

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasCompletedOnboarding: false,
      selectedGenres: [],
      completeOnboarding: (genres) =>
        set({ hasCompletedOnboarding: true, selectedGenres: genres }),
      skipOnboarding: () =>
        set({ hasCompletedOnboarding: true, selectedGenres: [] }),
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      // No shape change yet — this exists so a future field rename/removal
      // has somewhere to go instead of handing a stale object straight to a
      // component (prompt 07 step 10).
      migrate: (persisted) => persisted as OnboardingState,
      onRehydrateStorage: () => () => {
        markStoreHydrated(STORE_NAME);
      },
    },
  ),
);
