import { hashKey, queryOptions, type QueryClient } from "@tanstack/react-query";

import { entitlementLapsed, entitlementStarted, type Entitlement } from "@/lib/billing";
import { queryKeys } from "@/lib/query-keys";
import { getCurrentOffering, getEntitlement } from "@/lib/revenuecat";

/**
 * The reader's `ad_free` entitlement, from RevenueCat's `customerInfo` and
 * nothing else (AGENTS.md § Billing Rules). The one source for "subscribed"
 * in the lock rule (`types/states.ts`).
 *
 * `onEntitlementChange()` writes every update into this key
 * (`components/providers.tsx`), so a purchase opens every locked chapter at
 * once, with no polling and no refetch.
 *
 * Never persisted by TanStack (`shouldPersistQuery()`): the SDK keeps its own
 * copy on the device, which answers offline, and sign-out leaves no copy
 * behind. For the same reason it runs whatever TanStack thinks of the
 * connection. Without billing (web, Expo Go, no key) it answers "not
 * subscribed" at once.
 */
export const entitlementOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.billing.entitlement(userId),
    queryFn: () => getEntitlement(userId),
    networkMode: "always",
  });

/**
 * Calls `when(previous, next)` with each new answer to the reader's
 * entitlement query, and `onTurn()` when it says so. Watches the query
 * itself, not only the SDK's listener: a refetch (a screen opening, or the
 * player's own check) can bring an answer before the listener does, and the
 * listener would then see no change. Purchases and restores write the same
 * query. Returns the unsubscribe.
 */
function watchEntitlement(
  client: QueryClient,
  userId: string,
  when: (previous: Entitlement | undefined, next: Entitlement) => boolean,
  onTurn: () => void,
): () => void {
  const key = entitlementOptions(userId).queryKey;
  const hash = hashKey(key);
  let previous = client.getQueryData<Entitlement>(key);
  return client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || event.query.queryHash !== hash) return;
    const next = event.query.state.data as Entitlement | undefined;
    if (next === undefined || next === previous) return;
    const turned = when(previous, next);
    previous = next;
    if (turned) onTurn();
  });
}

/**
 * Calls `onLapse` each time the reader's plan ends: their entitlement query
 * turns from active to inactive (`entitlementLapsed()`), prompt 22 step 19.
 * Returns the unsubscribe.
 */
export function watchEntitlementLapses(client: QueryClient, userId: string, onLapse: () => void): () => void {
  return watchEntitlement(client, userId, entitlementLapsed, onLapse);
}

/**
 * Calls `onStart` each time the reader's plan begins, as far as this session
 * can tell: the first answer is active, or one turns active
 * (`entitlementStarted()`), prompt 22a step 7. Returns the unsubscribe.
 */
export function watchEntitlementStarts(client: QueryClient, userId: string, onStart: () => void): () => void {
  return watchEntitlement(client, userId, entitlementStarted, onStart);
}

/**
 * RevenueCat's current offering: M10's plans, whatever packages it holds.
 * Offline it waits for a connection, as the catalog does: no plan can be
 * bought without one. Never persisted.
 */
export const offeringsOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.billing.offering(userId),
    queryFn: () => getCurrentOffering(userId),
  });
