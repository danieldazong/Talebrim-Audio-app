import { useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { flush } from "@/lib/parity/writer";
import { queryKeys } from "@/lib/query-keys";

/**
 * The app-wide parity triggers — AGENTS.md § Read/listen parity, steps 2 and 3.
 *
 * - Leaving the foreground sends every queued position now. `inactive`
 *   counts too: iOS can kill an app from the switcher without it ever
 *   reaching `background`, and a second flush finds nothing to send.
 * - Returning refetches the reader's positions, so a row another device wrote
 *   meanwhile wins by the server's clock (`lib/parity/reconcile.ts`).
 */
export function useParitySync(): void {
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background" || next === "inactive") {
        void flush();
      } else if (next === "active" && previous !== "active" && userId) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.readingPosition.all(userId) });
      }
      previous = next;
    });
    return () => subscription.remove();
  }, [queryClient, userId]);
}
