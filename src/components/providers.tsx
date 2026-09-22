import { useAuth } from "@clerk/expo";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode, useEffect, useMemo } from "react";

import {
  PERSIST_MAX_AGE_MS,
  createPersister,
  queryClient,
} from "@/lib/query-client";
import { setClerkTokenGetter } from "@/lib/supabase";

/**
 * Bridges Clerk into the two things that need it:
 *  - the Supabase singleton's `accessToken` callback
 *  - the persisted Query cache key, namespaced by user id
 *
 * Must render INSIDE ClerkProvider (it calls useAuth).
 */
export function AuthedQueryProvider({ children }: { children: ReactNode }) {
  const { getToken, userId, isLoaded } = useAuth();

  // Hand Clerk's live getToken to the Supabase client. Re-runs when the
  // session changes so a signed-out client stops sending a stale token.
  useEffect(() => {
    setClerkTokenGetter(getToken);
    return () => setClerkTokenGetter(null);
  }, [getToken]);

  // Re-created per user so one account never restores another's rows.
  const persistOptions = useMemo(
    () => ({
      persister: createPersister(userId),
      maxAge: PERSIST_MAX_AGE_MS,
      buster: userId ?? "anonymous",
    }),
    [userId],
  );

  // Waiting for Clerk avoids restoring the anonymous bucket and then
  // immediately swapping it for the user's.
  if (!isLoaded) return null;

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      onSuccess={() => {
        void queryClient.resumePausedMutations();
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
