import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import type { PurchasesPackage } from "react-native-purchases";

import { track } from "@/lib/analytics";
import {
  NOTHING_TO_RESTORE,
  failureMessage,
  outcomeOfError,
  outcomeOfPurchase,
  type Entitlement,
  type PurchaseOutcome,
} from "@/lib/billing";
import { entitlementOptions } from "@/lib/queries/billing";
import { buyPackage, restoreBilling } from "@/lib/revenuecat";

export type PurchaseAction = "purchase" | "restore";

/** A restore that worked but found no active subscription is "nothing". */
export type RestoreOutcome = PurchaseOutcome | { kind: "nothing" };

/**
 * The app's one purchase path — prompt 22 step 7. M10 buys and restores
 * through it; M5a and M11 restore. There is no second one.
 *
 * Each action ends in one outcome, classified from the SDK's error codes
 * (`lib/billing.ts`). A cancel is not an error and shows nothing; every other
 * failure shows one plain line, never a raw store code, and never through an
 * alert or a toast. The returned `customerInfo` goes straight into the
 * entitlement query, as the listener's updates do, so the lock rule opens
 * every chapter at once. One action at a time, and the button never spins
 * forever: whatever the store answers ends it.
 */
export function usePurchase(from: "paywall" | "subscription" | "profile") {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [running, setRunning] = useState<PurchaseAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // A second tap lands before the re-render that disables the button.
  const busy = useRef(false);

  function start(action: PurchaseAction): string | null {
    if (!userId || busy.current) return null;
    busy.current = true;
    setRunning(action);
    setMessage(null);
    return userId;
  }

  function finish(account: string, entitlement: Entitlement | null) {
    if (entitlement !== null) queryClient.setQueryData(entitlementOptions(account).queryKey, entitlement);
    busy.current = false;
    setRunning(null);
  }

  /** Buys `pkg`; a subscriber switching plans passes the product they are on. */
  async function purchase(pkg: PurchasesPackage, replacingProductId: string | null): Promise<PurchaseOutcome | null> {
    const account = start("purchase");
    if (account === null) return null;
    const packageId = pkg.identifier;
    track("purchase_started", { package_id: packageId });

    let entitlement: Entitlement | null = null;
    let outcome: PurchaseOutcome;
    try {
      entitlement = await buyPackage(account, pkg, replacingProductId);
      outcome = outcomeOfPurchase(entitlement);
    } catch (error) {
      outcome = outcomeOfError(error);
    }
    finish(account, entitlement);

    if (outcome.kind === "success") track("purchase_completed", { package_id: packageId });
    else if (outcome.kind === "cancelled") track("purchase_cancelled", { package_id: packageId });
    else {
      track("purchase_failed", { package_id: packageId, kind: outcome.failure });
      setMessage(failureMessage(outcome.failure));
    }
    return outcome;
  }

  /** Restores the Google account's purchases to this reader. */
  async function restore(): Promise<RestoreOutcome | null> {
    const account = start("restore");
    if (account === null) return null;
    track("restore_tapped", { from });

    let entitlement: Entitlement | null = null;
    let outcome: RestoreOutcome;
    try {
      entitlement = await restoreBilling(account);
      outcome = entitlement.active ? { kind: "success" } : { kind: "nothing" };
      track("restore_completed", { entitled: entitlement.active });
    } catch (error) {
      outcome = outcomeOfError(error);
    }
    finish(account, entitlement);

    if (outcome.kind === "nothing") setMessage(NOTHING_TO_RESTORE);
    else if (outcome.kind === "failed") setMessage(failureMessage(outcome.failure));
    return outcome;
  }

  return { running, message, purchase, restore };
}
