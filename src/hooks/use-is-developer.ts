import { useUser } from "@clerk/expo";

import { isDeveloperAccount } from "@/lib/developer";

/**
 * Whether the signed-in account is the owner's (`lib/developer.ts`): the only
 * account that sees the development tools. False while Clerk loads, signed
 * out, and in a store build.
 */
export function useIsDeveloper(): boolean {
  const { isLoaded, user } = useUser();
  if (!isLoaded || !user) return false;
  const primary = user.primaryEmailAddress;
  return isDeveloperAccount(primary?.emailAddress, primary?.verification.status === "verified");
}
