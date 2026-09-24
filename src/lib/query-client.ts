import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient, onlineManager } from "@tanstack/react-query";

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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_TIME_MS,
      // Must exceed maxAge below, or entries are evicted before the
      // persister can restore them.
      gcTime: GC_TIME_MS,
      retry: 2,
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
