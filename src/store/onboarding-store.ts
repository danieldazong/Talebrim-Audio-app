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

/**
 * Version 1 saved display names ("Dark Romance"); version 2 saves the
 * dashboard's slugs. Mafia, Royalty and Forbidden have no slug — the
 * dashboard cannot tag them — so they are dropped. If nothing survives,
 * "Picked for You" falls back to the unfiltered catalogue, as after Skip.
 */
const V1_GENRE_SLUGS: Partial<Record<string, Genre>> = {
  Romance: "romance",
  Werewolf: "werewolf",
  Vampire: "vampire",
  Fantasy: "fantasy",
  Billionaire: "billionaire",
  Possessive: "possessive_alpha",
  "Dark Romance": "dark_romance",
  Shifter: "shifter",
};

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
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as OnboardingState;
        if (version >= 2) return state;

        const saved: unknown[] = Array.isArray(state.selectedGenres) ? state.selectedGenres : [];
        return {
          ...state,
          selectedGenres: saved.flatMap((name) => {
            const slug = typeof name === "string" ? V1_GENRE_SLUGS[name] : undefined;
            return slug ? [slug] : [];
          }),
        };
      },
      onRehydrateStorage: () => () => {
        markStoreHydrated(STORE_NAME);
      },
    },
  ),
);
