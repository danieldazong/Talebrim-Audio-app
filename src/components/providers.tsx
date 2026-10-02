import { useAuth } from "@clerk/expo";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ReactNode, useEffect, useMemo } from "react";

import { identifyReader } from "@/lib/analytics";
import { recheckLoaded } from "@/lib/audio/player";
import { entitlementOptions, watchEntitlementLapses, watchEntitlementStarts } from "@/lib/queries/billing";
import {
  PERSIST_MAX_AGE_MS,
  createPersister,
  queryClient,
  shouldPersistQuery,
} from "@/lib/query-client";
import { setParityUser } from "@/lib/parity/writer";
import { identifyBillingReader, onEntitlementChange } from "@/lib/revenuecat";
import { syncServerPlan } from "@/lib/server-plan";
import { setClerkTokenGetter } from "@/lib/supabase";

/**
 * Bridges Clerk into the five things that need it:
 *  - the Supabase singleton's `accessToken` callback
 *  - the parity writer's account, so a queued reading position is only ever
 *    sent under the account that recorded it
 *  - the analytics identity, the Clerk user id and nothing else about them
 *  - RevenueCat's App User ID, the same Clerk user id, so a subscription,
 *    every `unlocks` row and every reader table key off one id
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
  setParityUser(userId ?? null);
  useEffect(
    () => () => {
      setClerkTokenGetter(null);
      setParityUser(null);
    },
    [],
  );
  // Sign-out's reset is `clearUserScopedState()`'s, with the other per-account
  // state. Each change to the reader's customer info lands in the entitlement
  // query, so a purchase opens every locked chapter at once: no polling.
  useEffect(() => {
    if (!userId) return;
    identifyReader(userId);
    identifyBillingReader(userId);
    const stopListening = onEntitlementChange(userId, (entitlement) =>
      queryClient.setQueryData(entitlementOptions(userId).queryKey, entitlement),
    );
    // A plan that ends stops a locked chapter that is playing, as a lock set
    // in the dashboard does (prompt 22 step 19). Offline, or after a failed
    // check, it plays on.
    const stopWatching = watchEntitlementLapses(queryClient, userId, () => {
      if (__DEV__) console.log("[billing] plan ended: checking the loaded chapter");
      void recheckLoaded(null);
    });
    // The server keeps its own copy of the plan, for the locked narration and
    // text it serves (prompt 22a). Once a session, and whenever the plan
    // turns active, it is asked to check its copy with RevenueCat: that
    // catches a renewal whose webhook it missed. Never waited on.
    const stopStarts = watchEntitlementStarts(queryClient, userId, () => {
      void syncServerPlan();
    });
    return () => {
      stopListening();
      stopWatching();
      stopStarts();
    };
  }, [userId]);

  // Re-created per user so one account never restores another's rows.
  const persistOptions = useMemo(
    () => ({
      persister: createPersister(userId),
      maxAge: PERSIST_MAX_AGE_MS,
      buster: userId ?? "anonymous",
      dehydrateOptions: {
        // Never a signed narration URL: it is a bearer credential.
        shouldDehydrateQuery: shouldPersistQuery,
        // Never a paused mutation. Restored, it has no `mutationFn` to run, so
        // a My List change made offline ends with the app (prompt 21 step 8).
        shouldDehydrateMutation: () => false,
      },
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
