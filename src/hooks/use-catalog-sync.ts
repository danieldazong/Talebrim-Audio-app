import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AppState } from "react-native";

import {
  CATALOG_CHANGED_EVENT,
  CATALOG_TOPIC,
  invalidateCatalog,
  mergeCatalogChanges,
  parseCatalogChange,
  type CatalogChange,
} from "@/lib/catalog-sync";
import { supabase } from "@/lib/supabase";

/** Collects a burst of broadcasts into one round of refetches. */
const FLUSH_DELAY_MS = 750;

/**
 * True unless the app is backgrounded. iOS's brief `inactive` (Control
 * Centre, the app switcher, an incoming call) counts as foreground so the
 * channel doesn't flap.
 */
function useIsForeground(): boolean {
  const [isForeground, setIsForeground] = useState(AppState.currentState !== "background");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setIsForeground(state !== "background"),
    );
    return () => subscription.remove();
  }, []);

  return isForeground;
}

/**
 * Keeps catalog data live: a title, cover, narration or script saved in the
 * dashboard reaches every open screen within about a second, with no refresh.
 * See `lib/catalog-sync.ts` for the message and what it invalidates.
 *
 * Subscribed only while signed in (the topic is private) and in the
 * foreground. Backgrounding drops the channel, and with it the socket, so an
 * idle phone holds no Realtime connection. Every join — first launch, return
 * from background, a reconnect after the network drops — may follow a gap in
 * which messages were missed, so each one triggers a catch-up refresh.
 */
export function useCatalogSync(enabled: boolean): void {
  const queryClient = useQueryClient();
  const isForeground = useIsForeground();

  useEffect(() => {
    if (!enabled || !isForeground) return;

    let queued: CatalogChange | null = null;
    let refreshEverything = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // realtime-js retries a failed join on its own; refresh once per failure
    // streak, not once per retry.
    let caughtUpAfterFailure = false;

    function flush() {
      timer = null;
      const change = refreshEverything ? null : queued;
      queued = null;
      refreshEverything = false;
      void invalidateCatalog(queryClient, change);
    }

    function enqueue(change: CatalogChange | null) {
      if (change === null) refreshEverything = true;
      else queued = queued ? mergeCatalogChanges(queued, change) : change;
      timer ??= setTimeout(flush, FLUSH_DELAY_MS);
    }

    const channel = supabase
      .channel(CATALOG_TOPIC, { config: { private: true } })
      .on("broadcast", { event: CATALOG_CHANGED_EVENT }, ({ payload }) =>
        enqueue(parseCatalogChange(payload)),
      )
      .subscribe((status, error) => {
        if (status === "SUBSCRIBED") {
          caughtUpAfterFailure = false;
          enqueue(null);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Can't listen right now — still refresh once, so returning to the
          // app shows current data even without a live channel.
          if (!caughtUpAfterFailure) {
            caughtUpAfterFailure = true;
            enqueue(null);
          }
          if (__DEV__) console.warn(`[catalog-sync] ${status}`, error?.message ?? "");
        }
      });

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [enabled, isForeground, queryClient]);
}
