import { useClerk } from "@clerk/expo";
import { useCallback } from "react";

import { clearUserScopedState } from "@/lib/session";

/**
 * The app's only sign-out path.
 *
 * Clearing local state is not optional: a sign-out that leaves the persisted
 * TanStack cache behind shows the previous account's rows to the next user on
 * this device.
 */
export function useSignOut() {
  const { signOut } = useClerk();

  return useCallback(async () => {
    try {
      await signOut();
    } finally {
      // Runs even if signOut throws — local rows must not survive the attempt.
      await clearUserScopedState();
    }
  }, [signOut]);
}
