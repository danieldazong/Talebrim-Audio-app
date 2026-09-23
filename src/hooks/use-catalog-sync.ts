import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";

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

/** Backoff before rebuilding a channel the server closed. */
const RECONNECT_DELAYS_MS = [1_000, 3_000, 10_000, 30_000];

function log(...args: unknown[]) {
  if (__DEV__) console.log("[catalog-sync]", ...args);
}

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
 * from background, a rebuilt channel — may follow a gap in which messages
 * were missed, so each one triggers a catch-up refresh.
 */
export function useCatalogSync(enabled: boolean): void {
  const queryClient = useQueryClient();
  const isForeground = useIsForeground();
  // `supabase.channel("catalog")` hands back an existing instance with that
  // name, including one still leaving. Each run waits for the previous run's
  // removal before creating its own.
  const previousRemoval = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (!enabled || !isForeground) return;

    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let reconnectAttempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    let queued: CatalogChange | null = null;
    let refreshEverything = false;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    // realtime-js retries a failed join on its own; refresh once per failure
    // streak, not once per retry.
    let caughtUpAfterFailure = false;

    function flush() {
      flushTimer = null;
      const change = refreshEverything ? null : queued;
      queued = null;
      refreshEverything = false;
      void invalidateCatalog(queryClient, change);
    }

    function enqueue(change: CatalogChange | null) {
      if (change === null) refreshEverything = true;
      else queued = queued ? mergeCatalogChanges(queued, change) : change;
      flushTimer ??= setTimeout(flush, FLUSH_DELAY_MS);
    }

    function scheduleReconnect() {
      const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
      reconnectAttempt += 1;
      log(`rebuilding channel in ${delay}ms`);
      reconnectTimer = setTimeout(() => void connect(), delay);
    }

    async function connect() {
      reconnectTimer = null;
      await previousRemoval.current;
      // Put a token on the socket BEFORE joining. A join sent without one is
      // refused, and realtime-js only retries it seconds later.
      await supabase.realtime.setAuth().catch((error: unknown) => log("setAuth failed", error));
      if (disposed) return;

      const current = supabase
        .channel(CATALOG_TOPIC, { config: { private: true } })
        .on("broadcast", { event: CATALOG_CHANGED_EVENT }, ({ payload }) => {
          log("change received", payload);
          enqueue(parseCatalogChange(payload));
        });
      channel = current;

      current.subscribe((status, error) => {
        log(status, error?.message ?? "");

        if (status === "SUBSCRIBED") {
          reconnectAttempt = 0;
          caughtUpAfterFailure = false;
          enqueue(null);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Can't listen right now — still refresh once, so returning to the
          // app shows current data even without a live channel.
          if (!caughtUpAfterFailure) {
            caughtUpAfterFailure = true;
            enqueue(null);
          }
        } else if (status === "CLOSED" && !disposed && current === channel) {
          // The server closed it (an expired token, a deploy, a network
          // change). realtime-js never rejoins a closed channel, so rebuild.
          channel = null;
          scheduleReconnect();
        }
      });
    }

    void connect();

    return () => {
      disposed = true;
      if (flushTimer) clearTimeout(flushTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (channel) previousRemoval.current = supabase.removeChannel(channel);
      channel = null;
    };
  }, [enabled, isForeground, queryClient]);
}
