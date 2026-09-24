import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearParityQueue } from "@/lib/parity/writer";
import { QUERY_CACHE_PREFIX, queryClient } from "@/lib/query-client";
import {
  ONBOARDING_STORAGE_KEY,
  useOnboardingStore,
} from "@/store/onboarding-store";
import { useParityStore } from "@/store/parity-store";
import { usePlaybackStore } from "@/store/playback-store";
import { SEARCH_STORAGE_KEY, useSearchStore } from "@/store/search-store";

/**
 * Removes every user-scoped local artifact.
 *
 * This is the ONLY place that erases per-user local state. Sign-out and the
 * dev clear-storage button (prompt 07 step 9) both call this — do not add a
 * second implementation.
 *
 * Cleared (user-scoped):
 *  - the persisted TanStack Query cache, every user's bucket
 *    (`QUERY_CACHE_PREFIX.*` in AsyncStorage, plus the in-memory client)
 *  - the persisted `onboarding` Zustand slice — `hasCompletedOnboarding` and
 *    `selectedGenres` are per-account choices; the next person to sign in on
 *    this device must see M2 again, not the previous account's genres
 *  - the persisted `search` Zustand slice — M8's recent searches are what
 *    one account typed, not something the next account should see
 *  - the in-memory `parity` and `playback` slices — never persisted to disk
 *    in the first place (prompt 07 steps 3 and 8), but still reset here so a
 *    stale chapter/position from the old account can't linger in memory
 *    across a sign-out/sign-in within the same app session
 *  - the parity writer's queue — `useSignOut` flushed it first; anything
 *    still queued belongs to the old account and must never be sent
 *
 * Kept (device-scoped, not user data):
 *  - the persisted `reader` Zustand slice — font size, theme, line spacing,
 *    the Atkinson toggle are reading preferences for whoever holds this
 *    phone, not for one account. AGENTS.md draws this line at "local-only
 *    concerns" vs. per-user server data; reader prefs are the former.
 */
export async function clearUserScopedState(): Promise<void> {
  // In-memory first, and unconditionally: a storage failure below must
  // never leave the previous account's rows or onboarding state live in
  // memory, even if the disk write can't be cleared.
  queryClient.clear();
  clearParityQueue();
  useParityStore.getState().clear();
  usePlaybackStore.getState().reset();
  useSearchStore.getState().clear();
  useOnboardingStore.setState({
    hasCompletedOnboarding: false,
    selectedGenres: [],
  });

  try {
    const keys = await AsyncStorage.getAllKeys();

    const userScoped = keys.filter(
      (key) =>
        // Every persisted Query bucket, whichever user id it is namespaced by.
        key.startsWith(QUERY_CACHE_PREFIX) ||
        key === ONBOARDING_STORAGE_KEY ||
        key === SEARCH_STORAGE_KEY,
    );

    if (userScoped.length > 0) {
      await AsyncStorage.multiRemove(userScoped);
    }
  } catch {
    // Best-effort: a storage failure must never block sign-out.
  }
}
