// RevenueCat — prompt 22. The app's one billing client.
// No React, no hooks, no JSX (AGENTS.md § lib/).
//
// Android only while iOS scope is open (AGENTS.md § Important Constraints).
// Configured once, with the PUBLIC Android SDK key (`goog_…`), or in a
// development build the Test Store's (`test_…`), which a store build refuses
// (`billingKeyUsable()`). The secret key and the Google service-account key
// never enter this app, an `EXPO_PUBLIC_` variable or this repo.
//
// The App User ID is the Clerk user id, as analytics' and every reader
// table's are, so an entitlement, an `unlocks` row and a reading position all
// key off one id. Nothing is ever bought under an anonymous id.
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import type Purchases from "react-native-purchases";
import type { CustomerInfo, PurchasesOffering, PurchasesPackage } from "react-native-purchases";

import { billingKeyUsable, billingUnavailableMessage, entitlementFrom, type Entitlement } from "@/lib/billing";

/** The owner's RevenueCat entitlement identifier. Nothing else names it. */
export const ENTITLEMENT_ID = "ad_free";

const KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

/** Inside the Talebrim app on Android: not the web, not Expo Go. */
const ANDROID_APP = Platform.OS === "android" && !isRunningInExpoGo();

/**
 * Billing runs only where it can: an Android build made from this project,
 * with a key it may use. Not in the web build's server render (no `window`:
 * the trap prompt 21a's analytics fell into), not on the web, and not in Expo
 * Go, where the SDK falls back to a browser mode that takes only Test Store
 * keys. Never with a Test Store key in a store build, which RevenueCat makes
 * crash (`billingKeyUsable()`). Everywhere else every call below is a no-op,
 * so the web preview, Expo Go and tests keep running.
 */
const AVAILABLE = typeof window !== "undefined" && ANDROID_APP && billingKeyUsable(KEY, __DEV__);

export function billingAvailable(): boolean {
  return AVAILABLE;
}

/** M10's and M11's words where billing can't run (`billingUnavailableMessage()`). */
export function billingUnavailableLine(): string {
  return billingUnavailableMessage({ androidApp: ANDROID_APP });
}

/** True inside the Talebrim app on Android, where a missing plan is "coming soon". */
export function inAndroidApp(): boolean {
  return ANDROID_APP;
}

type Sdk = typeof Purchases;

let sdk: Sdk | null = null;
/** The reader the SDK is logged in as; null while signed out, or on the way out. */
let reader: string | null = null;
/** Identity changes, one at a time: a logIn never races a logOut. */
let identity: Promise<unknown> = Promise.resolve();

/**
 * The SDK, configured on first use as `userId`, so no anonymous id is made
 * first. Required here, not imported at the top: nothing loads it where
 * billing can't run, the server render above all, where it reaches for a
 * browser.
 */
function load(userId: string): Sdk {
  if (sdk !== null) return sdk;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded only where billing can run (see above)
  const loaded = (require("react-native-purchases") as { default: Sdk }).default;
  loaded.configure({ apiKey: KEY, appUserID: userId });
  reader = userId;
  sdk = loaded;
  return loaded;
}

/**
 * The SDK, logged in as `userId`. Checked with `getAppUserID()` every time,
 * so a purchase or restore never runs under an anonymous or previous id.
 */
function asReader(userId: string): Promise<Sdk> {
  const run = identity.then(async () => {
    const client = load(userId);
    if ((await client.getAppUserID()) !== userId) await client.logIn(userId);
    reader = userId;
    return client;
  });
  identity = run.catch(() => undefined);
  return run;
}

function log(...args: unknown[]) {
  if (__DEV__) console.log("[billing]", ...args);
}

/**
 * Sign-in, beside `identifyReader()` (`components/providers.tsx`). Never
 * waits: a failure is tried again by the next call that needs the reader.
 */
export function identifyBillingReader(userId: string): void {
  if (!AVAILABLE) return;
  asReader(userId).catch((error: unknown) => log("logIn failed", error));
}

/**
 * Sign-out, from `clearUserScopedState()`: the next account on this device
 * never inherits this one's subscription. The SDK refuses to log out an
 * anonymous user, which is already the state wanted, so that error is
 * swallowed. Never waits on the network.
 */
export function logOutBilling(): void {
  const client = sdk;
  reader = null;
  if (client === null) return;
  const run = identity.then(async () => {
    if (await client.isAnonymous()) return;
    await client.logOut();
  });
  identity = run.catch((error: unknown) => log("logOut failed", error));
}

/**
 * The reader's entitlement. The SDK answers from its own copy on the device
 * when there is no network, which is what serves a subscriber on a plane.
 * Without billing, no one is subscribed.
 */
export async function getEntitlement(userId: string): Promise<Entitlement> {
  if (!AVAILABLE) return entitlementFrom(null);
  const client = await asReader(userId);
  return fromCustomerInfo(await client.getCustomerInfo());
}

/**
 * Every change to the reader's customer info (a purchase, a renewal, a lapse
 * the SDK notices, a restore), as their entitlement. Only while `userId` is
 * the reader the SDK is logged in as, so the anonymous id a sign-out leaves
 * never lands under the account that left. Returns the unsubscribe.
 */
export function onEntitlementChange(userId: string, listener: (entitlement: Entitlement) => void): () => void {
  if (!AVAILABLE) return () => {};
  const client = load(userId);
  const forward = (info: CustomerInfo) => {
    if (reader === userId) listener(fromCustomerInfo(info));
  };
  client.addCustomerInfoUpdateListener(forward);
  return () => {
    client.removeCustomerInfoUpdateListener(forward);
  };
}

/** The current offering, whatever packages it holds; null when RevenueCat has none set. */
export async function getCurrentOffering(userId: string): Promise<PurchasesOffering | null> {
  if (!AVAILABLE) return null;
  const client = await asReader(userId);
  return (await client.getOfferings()).current;
}

/**
 * Buys `pkg`. A subscriber switching plans on Google Play passes the product
 * they are on (`productToReplace()`): Google's product change, with the SDK's
 * default replacement mode (none is sent). Throws the SDK's error, which
 * `outcomeOfError()` classifies.
 */
export async function buyPackage(
  userId: string,
  pkg: PurchasesPackage,
  replacingProductId: string | null,
): Promise<Entitlement> {
  if (!AVAILABLE) throw new Error("billing unavailable");
  const client = await asReader(userId);
  const { customerInfo } = await client.purchasePackage(
    pkg,
    null,
    replacingProductId === null ? null : { oldProductIdentifier: replacingProductId },
  );
  return fromCustomerInfo(customerInfo);
}

/** Restores the Google account's purchases to this reader. Throws the SDK's error. */
export async function restoreBilling(userId: string): Promise<Entitlement> {
  if (!AVAILABLE) throw new Error("billing unavailable");
  const client = await asReader(userId);
  return fromCustomerInfo(await client.restorePurchases());
}

function fromCustomerInfo(info: CustomerInfo): Entitlement {
  return entitlementFrom(
    info.entitlements.active[ENTITLEMENT_ID] ?? null,
    info.managementURL,
    Object.values(info.subscriptionsByProductIdentifier),
  );
}
