import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { useIsDeveloper } from "@/hooks/use-is-developer";
import { entitlementFrom, type Entitlement } from "@/lib/billing";
import { freeReaderPreview, onFreeReaderPreviewChange } from "@/lib/dev-preview";
import { entitlementOptions } from "@/lib/queries/billing";

/** A reader with no plan, as `entitlementFrom()` reads one: what the preview shows. */
function asFreeReader(): Entitlement {
  return entitlementFrom(null);
}

/**
 * Whether M11's development-only "View as a free reader" is on
 * (`lib/dev-preview.ts`). Only for the owner's account (`lib/developer.ts`):
 * for any other it is off however the switch was left, so it can never change
 * what another account sees.
 */
export function useFreeReaderPreview(): boolean {
  const on = useSyncExternalStore(onFreeReaderPreviewChange, freeReaderPreview, freeReaderPreview);
  return useIsDeveloper() && on;
}

/**
 * The reader's `ad_free` entitlement (`entitlementOptions()`). Its
 * `data?.active` is the lock rule's `isSubscribed`: undefined until known,
 * which `lockStateFor()` treats as "can't tell yet", never as locked.
 *
 * In a development build, with the owner's account and "View as a free
 * reader" on, it reads as no plan at all, so every screen shows the
 * dashboard's locks as a reader without the plan sees them. The cache keeps
 * the real answer.
 */
export function useEntitlement() {
  const { userId } = useAuth();
  const preview = useFreeReaderPreview();
  // Signed-in routes only, so `userId` is set.
  return useQuery({
    ...entitlementOptions(userId ?? ""),
    enabled: Boolean(userId),
    select: preview ? asFreeReader : undefined,
  });
}
