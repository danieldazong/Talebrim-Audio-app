import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { normalizeSearchTerm, tidySearchInput } from "@/lib/search";

export const SEARCH_STORAGE_KEY = "talebrim.store.search";

const MAX_RECENT_SEARCHES = 8;

// M8 recent searches — local-only. There is no search-history table and
// none should be built; a term is never written to the database.
//
// Deliberately NOT registered with `store/hydration.ts`: that gate exists
// for routing-critical state, and a store registering after `AuthGate` has
// opened would unmount the navigator until it rehydrates. Recent searches
// arriving a frame late is harmless.
interface SearchState {
  /** Most recent first, as the user typed them (tidied, not lower-cased). */
  recentSearches: string[];
  addRecentSearch: (input: string) => void;
  removeRecentSearch: (term: string) => void;
  clear: () => void;
}

type PersistedSearchState = Pick<SearchState, "recentSearches">;

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      recentSearches: [],
      addRecentSearch: (input) =>
        set((state) => {
          const term = tidySearchInput(input);
          if (!term) return state;
          const key = normalizeSearchTerm(term);
          const rest = state.recentSearches.filter(
            (existing) => normalizeSearchTerm(existing) !== key,
          );
          return {
            recentSearches: [term, ...rest].slice(0, MAX_RECENT_SEARCHES),
          };
        }),
      removeRecentSearch: (term) =>
        set((state) => ({
          recentSearches: state.recentSearches.filter(
            (existing) => existing !== term,
          ),
        })),
      clear: () => set({ recentSearches: [] }),
    }),
    {
      name: SEARCH_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state): PersistedSearchState => ({
        recentSearches: state.recentSearches,
      }),
      // No shape change yet — here so a future one has somewhere to go.
      migrate: (persisted) => persisted as PersistedSearchState,
    },
  ),
);
