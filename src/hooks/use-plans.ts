import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { PurchasesPackage } from "react-native-purchases";

import { useEntitlement } from "@/hooks/use-entitlement";
import { currentPlan, plansFrom, type Plan } from "@/lib/billing";
import { offeringsOptions } from "@/lib/queries/billing";
import { waitFor } from "@/lib/query-status";
import { billingAvailable } from "@/lib/revenuecat";

/** The plan cards' own state. "ready" always has at least one plan: never empty cards. */
export type PlansStatus = "loading" | "offline" | "failed" | "ready";

/**
 * Everything M10 reads: the reader's entitlement and the current offering's
 * plans (prompt 22 step 10). Two queries, both RevenueCat's, neither
 * persisted. An offering with no packages is a failure to load, shown with
 * Retry.
 */
export function usePlans() {
  const { userId } = useAuth();
  const available = billingAvailable();
  const entitlement = useEntitlement();
  const offering = useQuery({ ...offeringsOptions(userId ?? ""), enabled: Boolean(userId) && available });

  const plans = useMemo(() => plansFrom(offering.data?.availablePackages ?? []), [offering.data]);
  const current = entitlement.data ? currentPlan(plans, entitlement.data) : null;

  let plansStatus: PlansStatus;
  if (offering.data === undefined) plansStatus = waitFor([offering]).view.status;
  else plansStatus = plans.length > 0 ? "ready" : "failed";

  /** The store's own package behind a plan card, to buy. */
  function packageFor(plan: Plan): PurchasesPackage | null {
    return offering.data?.availablePackages.find((pkg) => pkg.identifier === plan.id) ?? null;
  }

  function retry() {
    if (entitlement.isError) void entitlement.refetch();
    if (offering.isError || offering.data === null || plans.length === 0) void offering.refetch();
  }

  return {
    /** False on the web, in Expo Go and without a key: M10 says where subscriptions are. */
    available,
    entitlement,
    plansStatus,
    plans,
    /** The reader's plan, when it is in the offering. */
    current,
    packageFor,
    retry,
  };
}
