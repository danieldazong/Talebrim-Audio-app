import { useAuth } from "@clerk/expo";
import { router, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AppState, Linking } from "react-native";

import { track } from "@/lib/analytics";
import { shouldAskForAlerts, type AlertsFrom, type AlertsPermission } from "@/lib/alerts";
import {
  getAlertsPermission,
  onAlertOpened,
  onPushTokenChange,
  pushAvailable,
  requestAlerts,
  syncAlerts,
  turnOffAlerts,
} from "@/lib/push";
import { useNotificationsStore } from "@/store/notifications-store";

// New-chapter alerts in the app — prompt 23a. `lib/push.ts` talks to the
// phone and the server; these hooks decide when.

function log(...args: unknown[]) {
  if (__DEV__) console.log("[alerts]", ...args);
}

export type AlertsView =
  /** The web preview or Expo Go: alerts need the Android app. */
  | { status: "unavailable" }
  /** Reading the system's permission. */
  | { status: "loading" }
  /** The ask: "Notify me" or "Not now". */
  | { status: "off" }
  | { status: "on" }
  /** Android's settings have notifications off for this app. */
  | { status: "blocked" };

export type AlertsSheet = {
  view: AlertsView;
  /** "Notify me" is waiting on the system's prompt. */
  requesting: boolean;
  notifyMe: () => void;
  notNow: () => void;
  turnOff: () => void;
  openSettings: () => void;
};

/**
 * The alerts sheet (`app/alerts.tsx`): what it shows, and its answers. Each
 * answer closes it through `close`. Closing it any other way while it asks
 * (the scrim, Android back) counts as "Not now".
 */
export function useAlertsSheet(from: AlertsFrom, close: () => void): AlertsSheet {
  const navigation = useNavigation();
  const enabled = useNotificationsStore((state) => state.enabled);
  const [permission, setPermission] = useState<AlertsPermission | null>(null);
  const [requesting, setRequesting] = useState(false);
  /** The reader answered: a close after it is no "Not now". */
  const answered = useRef(false);
  /** The ask was shown, once per open. */
  const asked = useRef(false);

  // Read now, and again when the reader comes back from Android's settings.
  useEffect(() => {
    if (!pushAvailable()) return;
    let live = true;
    const read = () =>
      getAlertsPermission()
        .then((next) => live && setPermission(next))
        .catch(() => live && setPermission("can_ask"));
    void read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void read();
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);

  const view: AlertsView = !pushAvailable()
    ? { status: "unavailable" }
    : permission === null
      ? { status: "loading" }
      : permission === "blocked"
        ? { status: "blocked" }
        : enabled && permission === "granted"
          ? { status: "on" }
          : { status: "off" };

  useEffect(() => {
    if (view.status !== "off" || asked.current) return;
    asked.current = true;
    track("notify_prompt_shown", { from });
  }, [view.status, from]);

  // The scrim, Android back, or anything else that removes the sheet.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        if (!asked.current || answered.current) return;
        answered.current = true;
        useNotificationsStore.getState().markAnswered();
        track("notify_prompt_declined", { from });
      }),
    [navigation, from],
  );

  function decline() {
    answered.current = true;
    useNotificationsStore.getState().markAnswered();
    track("notify_prompt_declined", { from });
    close();
  }

  async function notifyMe() {
    if (requesting) return;
    setRequesting(true);
    const result = await requestAlerts().catch((error: unknown) => {
      log("request failed", error);
      return null;
    });
    // A refusal closes the sheet too, and counts as "Not now".
    if (result !== "granted") {
      decline();
      return;
    }
    answered.current = true;
    useNotificationsStore.getState().setEnabled(true);
    track("notify_prompt_accepted", { from });
    close();
  }

  function turnOff() {
    // Off here at once. Offline, the next start releases the token
    // (`useAlertsSync()`), since alerts are off by then.
    useNotificationsStore.getState().setEnabled(false);
    track("alerts_turned_off", {});
    turnOffAlerts().catch((error: unknown) => log("turn off failed", error));
    close();
  }

  return {
    view,
    requesting,
    notifyMe: () => void notifyMe(),
    notNow: decline,
    turnOff,
    openSettings: () => {
      Linking.openSettings().catch(() => {});
    },
  };
}

/** The account the app last asked on its own, this session: one ask, however many adds. */
let askedFor: string | null = null;

/**
 * M4's My List add, once the server confirms it (`hooks/use-my-list.ts`):
 * opens the alerts sheet the first time, only where push runs, alerts are
 * off, the system hasn't blocked them, and this account hasn't answered.
 * Only while the screen that added it is on screen with the app in front:
 * never over another screen, never at launch.
 */
export function useAskForAlerts(): () => void {
  const { userId } = useAuth();
  const navigation = useNavigation();

  return useCallback(() => {
    if (!userId || askedFor === userId || !pushAvailable()) return;
    // Unknown until it rehydrates: never ask an account that may have answered.
    if (!useNotificationsStore.persist.hasHydrated()) return;
    getAlertsPermission()
      .then((permission) => {
        const { enabled, answered } = useNotificationsStore.getState();
        if (!shouldAskForAlerts({ available: true, enabled, answered, permission })) return;
        if (askedFor === userId || !navigation.isFocused() || AppState.currentState !== "active") return;
        askedFor = userId;
        router.push({ pathname: "/alerts", params: { from: "my_list" } });
      })
      .catch((error: unknown) => log("ask failed", error));
  }, [userId, navigation]);
}

function useNotificationsHydrated(): boolean {
  return useSyncExternalStore(useNotificationsStore.persist.onFinishHydration, () =>
    useNotificationsStore.persist.hasHydrated(),
  );
}

/**
 * The phone's token and the server, from the root navigator:
 * - at each sign-in, and each start signed in, the server learns whether this
 *   phone alerts this account (`syncAlerts()`). Alerts turned off in
 *   Android's settings since count as off, here too. Released otherwise, so
 *   a token a previous account left on this phone stops alerting it.
 * - when the phone's token changes, with alerts on, the new one is registered.
 * Offline, the next start tries again.
 */
export function useAlertsSync(): void {
  const { userId } = useAuth();
  const hydrated = useNotificationsHydrated();

  useEffect(() => {
    if (!userId || !hydrated || !pushAvailable()) return;
    getAlertsPermission()
      .then((permission) => {
        const { enabled, setEnabled } = useNotificationsStore.getState();
        const on = enabled && permission === "granted";
        if (enabled && !on) setEnabled(false);
        return syncAlerts(on);
      })
      .catch((error: unknown) => log("sync failed", error));
  }, [userId, hydrated]);

  useEffect(() => {
    if (!userId) return;
    return onPushTokenChange(() => {
      if (!useNotificationsStore.getState().enabled) return;
      syncAlerts(true).catch((error: unknown) => log("token change failed", error));
    });
  }, [userId]);
}

/**
 * A tap on an alert opens M4 for its book, once per alert, from a cold start
 * too. Only signed in and past onboarding: a signed-out phone opens nothing,
 * and the tap is not kept for later. Pushed over whatever is on screen, so
 * back returns there; Read and Listen resume from M4.
 */
export function useAlertTaps(canOpen: boolean): void {
  const canOpenRef = useRef(canOpen);
  useEffect(() => {
    canOpenRef.current = canOpen;
  }, [canOpen]);

  useEffect(
    () =>
      onAlertOpened((bookId) => {
        if (!canOpenRef.current) return;
        track("notification_opened", { book_id: bookId });
        router.push({ pathname: "/book/[id]", params: { id: bookId } });
      }),
    [],
  );
}
