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

  // Set during render, not in an effect: child effects run before parent
  // effects, so a screen's first query could otherwise go out without a
  // token — and RLS answers that with an empty list, not an error, which
  // then gets cached as "no books".
  setClerkTokenGetter(getToken);
  useEffect(() => () => setClerkTokenGetter(null), []);

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
