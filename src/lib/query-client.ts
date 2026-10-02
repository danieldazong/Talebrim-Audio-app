import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, defaultShouldDehydrateQuery, onlineManager, type Query } from "@tanstack/react-query";
import { AppState } from "react-native";

import { queryKeys } from "@/lib/query-keys";

// App-wide, once: with no connection, queries pause instead of burning their
// retries, and resume on reconnect. A paused query with no data is how M5
// tells "offline, nothing cached" from a failed load.
// https://tanstack.com/query/latest/docs/framework/react/react-native#online-status-management
//
// `isConnected` is null while NetInfo is still finding out; that counts as
// online, TanStack's own default, so launch never starts paused.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

/**
 * Persisted cache key prefix. The Clerk user id is appended so one account
 * never reads another's cached rows on a shared device.
 */
export const QUERY_CACHE_PREFIX = "talebrim.query-cache";

/** Signed-out cache bucket, kept separate from any user's. */
const ANONYMOUS_BUCKET = "anonymous";

export function queryCacheKey(userId: string | null | undefined): string {
  return `${QUERY_CACHE_PREFIX}.${userId ?? ANONYMOUS_BUCKET}`;
}

/**
 * A non-zero staleTime is a correctness requirement here, not a tuning knob:
 * the database is a t3.nano with a measured ~450ms floor on a trivial query
 * (AGENTS.md § Performance ceiling), so refetching on every mount makes warm
 * screens wait on the network.
 */
const STALE_TIME_MS = 5 * 60 * 1000;
const GC_TIME_MS = 24 * 60 * 60 * 1000;

/**
 * The wait before a retry: TanStack's own (1, 2, 4… seconds, at most 30)
 * while the app is on screen, none in the background. React Native on
 * Android runs no timer while the app is in the background, except a
 * zero-length one, which fires at once (`JavaTimerManager`). So a delayed
 * retry there waited until the app came back: autoplay with the screen off
 * stalled on one for minutes (2026-10-02).
 */
export function retryDelayFor(failureCount: number, appState: string | null | undefined): number {
  return appState === "active" ? Math.min(1000 * 2 ** failureCount, 30_000) : 0;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      // Must exceed maxAge below, or entries are evicted before the
      // persister can restore them.
      gcTime: GC_TIME_MS,
      retry: 2,
      retryDelay: (failureCount) => retryDelayFor(failureCount, AppState.currentState),
      refetchOnWindowFocus: false,
    },
  },
});

export function createPersister(userId: string | null | undefined) {
  return createAsyncStoragePersister({
    storage: AsyncStorage,
    key: queryCacheKey(userId),
    throttleTime: 1000,
  });
}

/** How long a persisted cache stays restorable. */
export const PERSIST_MAX_AGE_MS = GC_TIME_MS;

/** Roots of keys that live in memory only. */
const NEVER_PERSISTED: readonly unknown[] = [
  queryKeys.audio.all()[0],
  queryKeys.billing.all()[0],
  queryKeys.downloads.all()[0],
];

/** Prefixes below a root, for keys that live in memory only while the rest of their root persists. */
const NEVER_PERSISTED_PREFIXES: readonly (readonly unknown[])[] = [queryKeys.chapters.textAll()];

function startsWith(key: readonly unknown[], prefix: readonly unknown[]): boolean {
  return prefix.every((segment, index) => key[index] === segment);
}

/**
 * What the persister writes to disk: the default (successful queries), less
 * every signed narration URL, everything RevenueCat answers, and chapter
 * text. A signed URL is a bearer credential, so it lives in memory only
 * (AGENTS.md § Storage buckets). The entitlement is the SDK's to keep on the
 * device: a TanStack copy could outlive a sign-out or a lapse (prompt 22 step
 * 5). Chapter text is large (a live chapter reached 314,950 characters), and
 * the whole cache is one AsyncStorage value that Android can fail to read
 * back past about 2 MB. Offline reading is what downloads are for, and they
 * keep text in files of their own (prompt 24 step 10). The rest of
 * `chapters` still persists.
 */
export function shouldPersistQuery(query: Query): boolean {
  return (
    defaultShouldDehydrateQuery(query) &&
    !NEVER_PERSISTED.includes(query.queryKey[0]) &&
    !NEVER_PERSISTED_PREFIXES.some((prefix) => startsWith(query.queryKey, prefix))
  );
}
