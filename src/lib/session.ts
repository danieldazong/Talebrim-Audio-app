import AsyncStorage from "@react-native-async-storage/async-storage";

import { QUERY_CACHE_PREFIX, queryClient } from "@/lib/query-client";

/**
 * Removes every user-scoped local artifact.
 *
 * This is the ONLY place that erases per-user local state. Sign-out (prompt
 * 06) and the dev clear-storage button (prompt 08) both call this — do not
 * add a second implementation.
 */
export async function clearUserScopedState(): Promise<void> {
  // In-memory first: dropping only the persisted copy would leave the
  // previous account's rows live in the active cache.
  queryClient.clear();

  try {
    const keys = await AsyncStorage.getAllKeys();

    const userScoped = keys.filter((key) =>
      // Every persisted Query bucket, whichever user id it is namespaced by.
      key.startsWith(QUERY_CACHE_PREFIX),
    );

    // TODO(08): add the persisted Zustand slice keys here (reader settings
    // stay device-scoped and must NOT be cleared; genre selections, library
    // filters and any parity scratch state must).

    if (userScoped.length > 0) {
      await AsyncStorage.multiRemove(userScoped);
    }
  } catch {
    // Best-effort: a storage failure must never block sign-out.
  }
}
