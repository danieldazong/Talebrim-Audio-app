import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";

import { entitlementOptions } from "@/lib/queries/billing";

/**
 * The reader's `ad_free` entitlement (`entitlementOptions()`). Its
 * `data?.active` is the lock rule's `isSubscribed`: undefined until known,
 * which `lockStateFor()` treats as "can't tell yet", never as locked.
 */
export function useEntitlement() {
  const { userId } = useAuth();
  // Signed-in routes only, so `userId` is set.
  return useQuery({ ...entitlementOptions(userId ?? ""), enabled: Boolean(userId) });
}
