import AsyncStorage from "@react-native-async-storage/async-storage";

import { resetAnalytics } from "@/lib/analytics";
import { releaseAudio } from "@/lib/audio/player";
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
 *  - the audio player (`releaseAudio()`), first: paused, off the lock
 *    screen, its sleep timer and `currentChapterId` cleared, then released,
 *    so the next account never hears or sees this one's chapter.
 *    `useSignOut` already paused it and flushed its position
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
 *  - the analytics identity (`resetAnalytics()`): the next account starts
 *    with a new anonymous id. Events already queued keep the id they were
 *    captured under
 *
 * Kept (device-scoped, not user data):
 *  - the persisted `reader` Zustand slice — font size, theme, line spacing,
 *    the Atkinson toggle are reading preferences for whoever holds this
 *    phone, not for one account. AGENTS.md draws this line at "local-only
 *    concerns" vs. per-user server data; reader prefs are the former.
 *  - the analytics opt-out: signing out must never switch analytics back on
 */
export async function clearUserScopedState(): Promise<void> {
  // In-memory first, and unconditionally: a storage failure below must
  // never leave the previous account's rows or onboarding state live in
  // memory, even if the disk write can't be cleared. The player goes before
  // the parity queue, so nothing it reports afterwards can queue a write.
  releaseAudio();
  queryClient.clear();
  clearParityQueue();
  resetAnalytics();
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
