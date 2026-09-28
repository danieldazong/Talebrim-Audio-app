import { useClerk } from "@clerk/expo";
import { useCallback } from "react";

import { stopForSignOut } from "@/lib/audio/player";
import { flushWithin } from "@/lib/parity/writer";
import { releaseAlertsWithin } from "@/lib/push";
import { clearUserScopedState } from "@/lib/session";

/**
 * How long sign-out waits for a queued reading position, and for the phone's
 * alerts to be released, to reach the server.
 */
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
    // Pause, and record where the listener was, so the flush below sends it.
    stopForSignOut();
    // Send the reader's place, and stop this phone's new-chapter alerts, while
    // this account's token still works. Side by side, each bounded, so
    // sign-out never hangs on the network. A place still queued is dropped by
    // `clearUserScopedState()`, never sent under the next account; alerts not
    // released offline are released or claimed by the next sign-in here.
    await Promise.all([flushWithin(SIGN_OUT_FLUSH_MS), releaseAlertsWithin(SIGN_OUT_FLUSH_MS)]);
    try {
      await signOut();
    } finally {
      // Runs even if signOut throws — local rows must not survive the attempt.
      await clearUserScopedState();
    }
  }, [signOut]);
}
