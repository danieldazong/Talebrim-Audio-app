// New-chapter alerts — prompt 23a. The app's one push client.
// No React, no hooks, no JSX (AGENTS.md § lib/).
//
// Android only while iOS scope is open (AGENTS.md § Important Constraints).
// Push runs only in an Android build made from this project: not in the web
// build's server render (no `window`: the trap prompt 21a's analytics fell
// into), not on the web, and not in Expo Go, whose Android build dropped
// remote push in SDK 53. Everywhere else every call below is a no-op.
//
// `expo-notifications` (57.0.21) is `require`d on first use, never imported
// at the top: importing it logs a warning in Expo Go, and it starts its own
// token bookkeeping at import.
//
// This module makes the app's one permission request, from the alerts
// sheet's "Notify me" and nowhere else; playback never asks. The "New
// chapters" channel is created there, and when a reader with alerts on signs
// in, never at launch: on Android 13+ the system ties its prompt to the
// first channel.
//
// The server knows a phone's token only through `set_push_token()`
// (dashboard migration 20260928120000), which keeps one account per phone.
// Calls to it run one at a time, so a sign-out's release never lands after
// the next account's registration.
//
// MISSING ASSET: notification-icon — until `assets/Image/notification-icon.png`
// (a white logo on a transparent background, 96 × 96) is supplied, `app.json`'s
// `expo-notifications` entry has no `icon`, and Android draws the alert with a
// plain square. JSON takes no comment, so the marker lives here.
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import type * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { alertBookId, permissionFrom, type AlertsPermission } from "@/lib/alerts";
import { supabase } from "@/lib/supabase";

/** The channel the server sends on (`notify-new-chapters`). */
export const ALERTS_CHANNEL_ID = "new-chapters";

const AVAILABLE = typeof window !== "undefined" && Platform.OS === "android" && !isRunningInExpoGo();

export function pushAvailable(): boolean {
  return AVAILABLE;
}

type Sdk = typeof Notifications;

let sdk: Sdk | null = null;
/** This phone's Expo push token, once fetched this session. */
let phoneToken: string | null = null;
/** Calls to `set_push_token()`, one at a time. */
let serverQueue: Promise<unknown> = Promise.resolve();
/** Alert taps already handled, by notification id: each opens once. */
const handledTaps = new Set<string>();

function log(...args: unknown[]) {
  if (__DEV__) console.log("[push]", ...args);
}

/**
 * The SDK, loaded where push runs. Its foreground handler is set as it loads,
 * before any alert can arrive: the banner, without a sound (prompt 23a step 8).
 */
function load(): Sdk {
  if (sdk !== null) return sdk;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where push can run (see above)
  const loaded = require("expo-notifications") as Sdk;
  loaded.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  sdk = loaded;
  return loaded;
}

/**
 * "New chapters": default importance, and its content hidden on a secure lock
 * screen (every live book is `mature_17`). Creating it again only updates its
 * name and description; the reader's own settings for it stand.
 */
function ensureChannel(client: Sdk): Promise<unknown> {
  return client.setNotificationChannelAsync(ALERTS_CHANNEL_ID, {
    name: "New chapters",
    description: "New chapters of the stories on your My List.",
    importance: client.AndroidImportance.DEFAULT,
    lockscreenVisibility: client.AndroidNotificationVisibility.PRIVATE,
  });
}

/**
 * The phone's Expo push token. Asks Expo's server the first time in a session,
 * so it needs the network then. Android needs no permission for it.
 */
async function getPhoneToken(client: Sdk): Promise<string> {
  if (phoneToken !== null) return phoneToken;
  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined);
  const { data } = await client.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  phoneToken = data;
  return data;
}

/** Gives this phone's token to the signed-in reader (true), or releases it (false). */
function setServerToken(enabled: boolean): Promise<void> {
  const run = serverQueue.then(async () => {
    const token = await getPhoneToken(load());
    const { error } = await supabase.rpc("set_push_token", { p_token: token, p_enabled: enabled });
    if (error) throw error;
  });
  serverQueue = run.catch(() => undefined);
  return run;
}

/** The system's notification permission for this app, without asking. */
export async function getAlertsPermission(): Promise<AlertsPermission> {
  if (!AVAILABLE) return "can_ask";
  return permissionFrom(await load().getPermissionsAsync());
}

/**
 * "Notify me": the channel, then the system's prompt if it can still be
 * shown, then, once granted, the token to the server. Returns the permission
 * it ended with; alerts are on only when that is "granted". The registration
 * isn't waited for: offline, the next start registers (`syncAlerts()`).
 */
export async function requestAlerts(): Promise<AlertsPermission> {
  if (!AVAILABLE) return "can_ask";
  const client = load();
  await ensureChannel(client);
  let permission = permissionFrom(await client.getPermissionsAsync());
  if (permission === "can_ask") permission = permissionFrom(await client.requestPermissionsAsync());
  if (permission === "granted") {
    setServerToken(true).catch((error: unknown) => log("register failed", error));
  }
  return permission;
}

/** "Turn off": this phone stops alerting the reader. Throws when the server can't be reached. */
export function turnOffAlerts(): Promise<void> {
  if (!AVAILABLE) return Promise.resolve();
  return setServerToken(false);
}

/**
 * Each sign-in, each start signed in, and each change of the phone's token:
 * tells the server whether this phone alerts this account. `on` registers it,
 * with the channel created again in case Android's data was cleared.
 * Otherwise it is released, so a token another account left on this phone (a
 * sign-out that never reached the server) stops alerting it. Throws when the
 * server can't be reached; the next start tries again.
 */
export async function syncAlerts(on: boolean): Promise<void> {
  if (!AVAILABLE) return;
  if (on) await ensureChannel(load());
  await setServerToken(on);
}

/**
 * Sign-out, before Clerk's: this phone stops alerting the account leaving,
 * while its token still works. Bounded like the parity flush, so sign-out
 * never hangs on the network; offline, the next sign-in on this phone
 * releases or claims the token.
 */
export function releaseAlertsWithin(ms: number): Promise<void> {
  if (!AVAILABLE) return Promise.resolve();
  const release = setServerToken(false).catch((error: unknown) => log("release failed", error));
  return Promise.race([release, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

/** Every change of the phone's push token (Firebase can rotate it). Returns the unsubscribe. */
export function onPushTokenChange(listener: () => void): () => void {
  if (!AVAILABLE) return () => {};
  const subscription = load().addPushTokenListener(() => {
    phoneToken = null;
    listener();
  });
  return () => subscription.remove();
}

/**
 * Each tap on an alert, once, with the book it names: the tap that launched
 * the app (a cold start) straight away, then every later one. The listener
 * decides whether to open it. Returns the unsubscribe.
 */
export function onAlertOpened(listener: (bookId: string) => void): () => void {
  if (!AVAILABLE) return () => {};
  const client = load();
  const forward = (response: Notifications.NotificationResponse) => {
    const id = response.notification.request.identifier;
    if (handledTaps.has(id)) return;
    handledTaps.add(id);
    if (response.actionIdentifier !== client.DEFAULT_ACTION_IDENTIFIER) return;
    const bookId = alertBookId(response.notification.request.content.data);
    if (bookId !== null) listener(bookId);
  };

  const subscription = client.addNotificationResponseReceivedListener(forward);
  const launch = client.getLastNotificationResponse();
  if (launch) {
    client.clearLastNotificationResponse();
    forward(launch);
  }
  return () => subscription.remove();
}
