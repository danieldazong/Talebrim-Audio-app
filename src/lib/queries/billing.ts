import { queryOptions } from "@tanstack/react-query";

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
 * RevenueCat's current offering: M10's plans, whatever packages it holds.
 * Offline it waits for a connection, as the catalog does: no plan can be
 * bought without one. Never persisted.
 */
export const offeringsOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.billing.offering(userId),
    queryFn: () => getCurrentOffering(userId),
  });
