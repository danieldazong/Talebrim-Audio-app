import { useClerk } from "@clerk/expo";
import { useCallback } from "react";

import { flushWithin } from "@/lib/parity/writer";
import { clearUserScopedState } from "@/lib/session";

/** How long sign-out waits for a queued reading position to reach the server. */
const SIGN_OUT_FLUSH_MS = 2_000;

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
    // Send the reader's place while this account's token still works. Bounded,
    // so sign-out never hangs on the network; whatever is left is dropped by
    // `clearUserScopedState()`, never sent under the next account.
    await flushWithin(SIGN_OUT_FLUSH_MS);
    try {
      await signOut();
    } finally {
      // Runs even if signOut throws — local rows must not survive the attempt.
      await clearUserScopedState();
    }
  }, [signOut]);
}
