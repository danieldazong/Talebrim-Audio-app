// Billing's pure parts — prompt 22. The entitlement the app reads, the plans
// M10 shows, and what a purchase or restore came to. Every price, period and
// saving comes from the store through RevenueCat: nothing here is a price, a
// currency or a plan list (AGENTS.md § Billing Rules).
// No React, no hooks, no JSX (AGENTS.md § lib/).
//
// Only types come from the SDK: importing its values would load it where
// billing can't run (`lib/revenuecat.ts`).
import type {
  PURCHASES_ERROR_CODE,
  PurchasesEntitlementInfo,
  PurchasesPackage,
  PurchasesSubscriptionInfo,
} from "react-native-purchases";

import { PLAN_NAME } from "@/constants/plan";
import { formatDate } from "@/lib/format";

// --- The store app ---------------------------------------------------------

/**
 * Whether the app may configure RevenueCat with `key`. A Test Store key
 * (`test_…`) works only in a development build: RevenueCat makes a release
 * build that carries one show an alert and crash on purpose. A store build
 * with one keeps billing off instead (Decisions — 2026-10-01, "The paywall,
 * safe for the store app").
 */
export function billingKeyUsable(key: string, isDevelopmentBuild: boolean): boolean {
  if (key.length === 0) return false;
  return isDevelopmentBuild || !key.startsWith("test_");
}

/**
 * What M10 and M11's Restore say where billing can't run. Inside the Android
 * app (no key yet, or a test key refused in a store build) the plan is on its
 * way. On the web preview and in Expo Go it lives in the Android app.
 */
export function billingUnavailableMessage(where: { androidApp: boolean }): string {
  return where.androidApp
    ? `${PLAN_NAME} is coming soon.`
    : "Subscriptions are available in the Talebrim app for Android.";
}

// --- Entitlement -----------------------------------------------------------

/** What the app needs from `customerInfo` about the `ad_free` entitlement. */
export type Entitlement = {
  active: boolean;
  /** ISO 8601; null for no expiry, or no entitlement. */
  expiresAt: string | null;
  willRenew: boolean;
  /** On Google Play, the subscription id, without its base plan. */
  productId: string | null;
  /** On Google Play, the base plan. */
  planId: string | null;
  /** Where it was bought: "PLAY_STORE", "PROMOTIONAL", and so on. */
  store: string | null;
  /** Where the reader manages it. Set once they have had a subscription. */
  managementUrl: string | null;
};

/** One of the reader's subscriptions, as `customerInfo.subscriptionsByProductIdentifier` holds it. */
export type SubscriptionRecord = Pick<
  PurchasesSubscriptionInfo,
  | "productIdentifier"
  | "productPlanIdentifier"
  | "isActive"
  | "willRenew"
  | "expiresDate"
  | "purchaseDate"
  | "originalPurchaseDate"
  | "store"
>;

/**
 * An active entitlement, as `customerInfo.entitlements.active` holds it, or
 * null for none. With several subscriptions active, its plan is the one the
 * reader started last (`newestActive()`), not the one RevenueCat names.
 */
export function entitlementFrom(
  info: Pick<
    PurchasesEntitlementInfo,
    "isActive" | "expirationDate" | "willRenew" | "productIdentifier" | "productPlanIdentifier" | "store"
  > | null,
  managementUrl: string | null = null,
  subscriptions: readonly SubscriptionRecord[] = [],
): Entitlement {
  if (info === null || !info.isActive) {
    return {
      active: false,
      expiresAt: null,
      willRenew: false,
      productId: null,
      planId: null,
      store: null,
      managementUrl,
    };
  }
  const newest = newestActive(subscriptions);
  if (newest !== null) {
    const planId = newest.productPlanIdentifier;
    return {
      active: true,
      expiresAt: newest.expiresDate,
      willRenew: newest.willRenew,
      // As the entitlement names it: the subscription without its base plan.
      productId:
        planId !== null && newest.productIdentifier.endsWith(`:${planId}`)
          ? newest.productIdentifier.slice(0, -(planId.length + 1))
          : newest.productIdentifier,
      planId,
      store: newest.store,
      managementUrl,
    };
  }
  return {
    active: true,
    expiresAt: info.expirationDate,
    willRenew: info.willRenew,
    productId: info.productIdentifier,
    planId: info.productPlanIdentifier,
    store: info.store,
    managementUrl,
  };
}

/**
 * The plan ended: an entitlement known to be active is now inactive (prompt
 * 22 step 19). A first answer that is inactive is no lapse, nor is any turn
 * the other way.
 */
export function entitlementLapsed(
  previous: Pick<Entitlement, "active"> | undefined,
  next: Pick<Entitlement, "active">,
): boolean {
  return previous?.active === true && !next.active;
}

/**
 * The plan began, as far as this session can tell (prompt 22a step 7): the
 * session's first answer is active (a start or a sign-in), or an inactive one
 * turned active (a purchase, a restore, a plan bought on another phone). The
 * server is asked to check its copy then, which also catches a renewal whose
 * webhook it missed. An active answer after an active one is no start.
 */
export function entitlementStarted(
  previous: Pick<Entitlement, "active"> | undefined,
  next: Pick<Entitlement, "active">,
): boolean {
  return previous?.active !== true && next.active;
}

/**
 * The subscription the reader started last, when more than one is active;
 * null for one or none. RevenueCat's entitlement names the one that lasts
 * longest, so a reader who moved from Yearly to Weekly in the Test Store,
 * where a switch buys the new plan beside the old (`productToReplace()`), went
 * on seeing Yearly as their plan (found on the owner's phone, 2026-10-01).
 * Google Play replaces the old plan, so it never has two. A renewal is not a
 * start: `originalPurchaseDate` doesn't move with one.
 */
function newestActive(subscriptions: readonly SubscriptionRecord[]): SubscriptionRecord | null {
  const active = subscriptions.filter((subscription) => subscription.isActive);
  if (active.length < 2) return null;
  const started = (subscription: SubscriptionRecord) =>
    Date.parse(subscription.originalPurchaseDate ?? subscription.purchaseDate) || 0;
  return active.reduce((newest, subscription) => (started(subscription) > started(newest) ? subscription : newest));
}

// --- Periods ---------------------------------------------------------------

export type BillingPeriod = { unit: "day" | "week" | "month" | "year"; count: number };

const DAYS_PER_UNIT: Record<BillingPeriod["unit"], number> = { day: 1, week: 7, month: 365 / 12, year: 365 };

/**
 * An ISO 8601 period, as the store reports a subscription's ("P1W", "P1M",
 * "P3M", "P1Y"); null for anything else, a one-off purchase included. Days
 * in whole weeks read as weeks, and twelve months as a year.
 */
export function parsePeriod(iso: string | null): BillingPeriod | null {
  const match = iso === null ? null : /^P(\d+)([DWMY])$/.exec(iso);
  if (match === null) return null;
  const count = Number(match[1]);
  if (count <= 0) return null;
  switch (match[2]) {
    case "D":
      return count % 7 === 0 ? { unit: "week", count: count / 7 } : { unit: "day", count };
    case "W":
      return { unit: "week", count };
    case "M":
      return count % 12 === 0 ? { unit: "year", count: count / 12 } : { unit: "month", count };
    default:
      return { unit: "year", count };
  }
}

function periodDays(period: BillingPeriod): number {
  return DAYS_PER_UNIT[period.unit] * period.count;
}

function counted(count: number, unit: string): string {
  return count === 1 ? unit : `${count} ${unit}s`;
}

/** "7 days", "month", "3 months", "year": what follows "Billed every" and "Renews every". A week reads in days, as the frame's "Billed every 7 days". */
export function everyPeriod(period: BillingPeriod): string {
  return period.unit === "week" ? `${period.count * 7} days` : counted(period.count, period.unit);
}

/** "week", "month", "3 months": what follows a price's slash. */
export function perPeriod(period: BillingPeriod): string {
  return counted(period.count, period.unit);
}

const PERIOD_NAMES: Partial<Record<BillingPeriod["unit"], string>> = {
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

/**
 * The store's product title, less the app name Google Play appends in
 * parentheses ("Ad-Free Weekly (Talebrim)").
 */
export function storeTitle(title: string): string {
  return title.replace(/\s*\([^()]*\)\s*$/, "").trim() || title.trim();
}

// --- Plans ---------------------------------------------------------------

/** The parts of a package the plans are built from. */
export type PlanPackage = {
  identifier: PurchasesPackage["identifier"];
  product: Pick<
    PurchasesPackage["product"],
    "identifier" | "title" | "priceString" | "pricePerWeek" | "pricePerWeekString" | "subscriptionPeriod"
  >;
};

export type PlanBadge = { kind: "save"; percent: number } | { kind: "best-value"; percent: number };

export type Plan = {
  /** The package's identifier: what analytics sends as `package_id`. */
  id: string;
  /** The store product, "subscription:base-plan" on Google Play. */
  productId: string;
  /** "Weekly", "Monthly", "Yearly"; otherwise the store's title. */
  name: string;
  /** The store's title, less the app name. */
  title: string;
  /** The store's localized price, as it formats it. */
  price: string;
  period: BillingPeriod | null;
  badge: PlanBadge | null;
  /** "Billed every 7 days", or "$1.73/week · Save 65%". */
  subline: string;
  /** The card as one radio: name, full price, period and badge, as one sentence. */
  spoken: string;
  /**
   * The line under the button, with the amount billed: "$9.99 every month.
   * Renews automatically until you cancel in Google Play."; null without a
   * period.
   */
  renewal: string | null;
};

/** How much cheaper per week than `base`, in whole percent, rounded down so it never overstates. */
function savingPercent(perWeek: number | null, basePerWeek: number | null): number {
  if (perWeek === null || basePerWeek === null || basePerWeek <= 0) return 0;
  return Math.max(0, Math.floor((1 - perWeek / basePerWeek) * 100 + 1e-9));
}

function billedEvery(period: BillingPeriod | null): string | null {
  return period === null ? null : `Billed every ${everyPeriod(period)}`;
}

/**
 * The current offering's packages as M10's plan cards, whatever they are:
 * ordered by period, shortest first, with packages that have no period (a
 * one-off purchase) last. Never a fixed list of three.
 *
 * Savings are per week of access against the shortest plan, from the
 * store's own per-week prices. A plan that saves gets "Save N%"; the one that
 * saves most gets "Best value" instead. No saving, no badge.
 */
export function plansFrom(packages: readonly PlanPackage[]): Plan[] {
  const ordered = packages
    .map((pkg) => ({ pkg, period: parsePeriod(pkg.product.subscriptionPeriod) }))
    .sort((a, b) => (a.period ? periodDays(a.period) : Infinity) - (b.period ? periodDays(b.period) : Infinity));

  const basePerWeek = ordered[0]?.period ? ordered[0].pkg.product.pricePerWeek : null;
  const savings = ordered.map(({ pkg, period }, index) =>
    index === 0 || period === null ? 0 : savingPercent(pkg.product.pricePerWeek, basePerWeek),
  );
  const most = Math.max(0, ...savings);
  // The longest of equal savings: it is the one that locks the rate in longest.
  const bestIndex = most > 0 ? savings.lastIndexOf(most) : -1;

  return ordered.map(({ pkg, period }, index) => {
    const percent = savings[index];
    const badge: PlanBadge | null =
      index === bestIndex ? { kind: "best-value", percent } : percent > 0 ? { kind: "save", percent } : null;
    const title = storeTitle(pkg.product.title);
    const name = (period?.count === 1 ? PERIOD_NAMES[period.unit] : undefined) ?? title;
    const perWeek = pkg.product.pricePerWeekString;
    const subline =
      index === 0 || perWeek === null
        ? (billedEvery(period) ?? pkg.product.priceString)
        : `${perWeek}/week${badge?.kind === "best-value" ? ` · Save ${percent}%` : ""}`;
    const badgeWords = badge === null ? null : badge.kind === "best-value" ? `best value, save ${percent}%` : `save ${percent}%`;

    return {
      id: pkg.identifier,
      productId: pkg.product.identifier,
      name,
      title,
      price: pkg.product.priceString,
      period,
      badge,
      subline,
      spoken: `${[name, period === null ? pkg.product.priceString : `${pkg.product.priceString} every ${everyPeriod(period)}`, badgeWords]
        .filter((part) => part !== null)
        .join(", ")}.`,
      renewal:
        period === null
          ? null
          : `${pkg.product.priceString} every ${everyPeriod(period)}. Renews automatically until you cancel in Google Play.`,
    };
  });
}

/**
 * The plan the reader is on, when it is in the offering. Google Play's
 * entitlement names the subscription and its base plan apart; a package's
 * product joins them ("subscription:base-plan").
 */
export function currentPlan(plans: readonly Plan[], entitlement: Entitlement): Plan | null {
  if (!entitlement.active || entitlement.productId === null) return null;
  const joined = entitlement.planId === null ? null : `${entitlement.productId}:${entitlement.planId}`;
  return plans.find((plan) => plan.productId === joined || plan.productId === entitlement.productId) ?? null;
}

/**
 * The product a plan switch replaces: the reader's own, on Google Play, which
 * turns one base plan into another. Anywhere else a switch is a new purchase.
 * RevenueCat's Test Store refuses a replacement ("No active purchase found for
 * product", `PurchaseNotAllowedError`, on the owner's phone, 2026-10-01), so
 * there the new plan runs beside the old until that ends, and
 * `entitlementFrom()` shows the newer as the reader's plan.
 */
export function productToReplace(entitlement: Entitlement): string | null {
  if (!entitlement.active || entitlement.productId === null) return null;
  return entitlement.store === "PLAY_STORE" ? entitlement.productId : null;
}

/**
 * The status card's date line: "Renews 21 Sept 2026 · $4.99/week", with the
 * price only when the plan is in the offering, or "Ends 21 Sept 2026" once it
 * won't renew. Null with no expiry to show.
 */
export function renewalLine(entitlement: Entitlement, current: Plan | null): string | null {
  const date = entitlement.expiresAt === null ? null : formatDate(entitlement.expiresAt);
  if (date === null) return null;
  if (!entitlement.willRenew) return `Ends ${date}`;
  const price = current?.period ? ` · ${current.price}/${perPeriod(current.period)}` : "";
  return `Renews ${date}${price}`;
}

/**
 * Google Play's subscriptions page for this app, and for the reader's own
 * subscription when there is one: where "Manage in Google Play" and "Cancel
 * subscription" go without a management URL.
 */
export function playSubscriptionsUrl(packageName: string, subscriptionId: string | null): string {
  const query = [`package=${encodeURIComponent(packageName)}`];
  if (subscriptionId !== null) query.push(`sku=${encodeURIComponent(subscriptionId)}`);
  return `https://play.google.com/store/account/subscriptions?${query.join("&")}`;
}

/** What M10 selects before the reader picks: their own plan, else "Best value", else the first. */
export function defaultPlan(plans: readonly Plan[], current: Plan | null): Plan | null {
  return current ?? plans.find((plan) => plan.badge?.kind === "best-value") ?? plans[0] ?? null;
}

// --- Outcomes ------------------------------------------------------------

/** Why a purchase or restore didn't complete. Snake case: analytics sends it as `kind`. */
export type PurchaseFailure = "pending" | "already_owned" | "store_unavailable" | "network" | "other";

export type PurchaseOutcome =
  | { kind: "success" }
  /** Not an error: nothing is shown. */
  | { kind: "cancelled" }
  | { kind: "failed"; failure: PurchaseFailure };

type ErrorCodes = { [Name in keyof typeof PURCHASES_ERROR_CODE]: `${(typeof PURCHASES_ERROR_CODE)[Name]}` };

/**
 * The SDK's error codes this app tells apart, by the SDK's own names. Typed
 * against its enum, so a renamed or renumbered code fails to compile.
 */
const CODE = {
  PURCHASE_CANCELLED_ERROR: "1",
  STORE_PROBLEM_ERROR: "2",
  PURCHASE_NOT_ALLOWED_ERROR: "3",
  PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR: "5",
  PRODUCT_ALREADY_PURCHASED_ERROR: "6",
  RECEIPT_ALREADY_IN_USE_ERROR: "7",
  NETWORK_ERROR: "10",
  RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR: "13",
  PAYMENT_PENDING_ERROR: "20",
  UNSUPPORTED_ERROR: "24",
  OFFLINE_CONNECTION_ERROR: "35",
} as const satisfies Partial<ErrorCodes>;

/** A rejected purchase or restore, from the SDK's error code. Never from its message text. */
export function outcomeOfError(error: unknown): PurchaseOutcome {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : null;
  switch (code) {
    case CODE.PURCHASE_CANCELLED_ERROR:
      return { kind: "cancelled" };
    case CODE.PAYMENT_PENDING_ERROR:
      return { kind: "failed", failure: "pending" };
    case CODE.PRODUCT_ALREADY_PURCHASED_ERROR:
    case CODE.RECEIPT_ALREADY_IN_USE_ERROR:
    case CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR:
      return { kind: "failed", failure: "already_owned" };
    case CODE.STORE_PROBLEM_ERROR:
    case CODE.PURCHASE_NOT_ALLOWED_ERROR:
    case CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR:
    case CODE.UNSUPPORTED_ERROR:
      return { kind: "failed", failure: "store_unavailable" };
    case CODE.NETWORK_ERROR:
    case CODE.OFFLINE_CONNECTION_ERROR:
      return { kind: "failed", failure: "network" };
    default:
      return { kind: "failed", failure: "other" };
  }
}

/**
 * A purchase the store completed. Until the entitlement is active, Google
 * Play is still confirming it, which the listener brings in when it lands.
 */
export function outcomeOfPurchase(entitlement: Entitlement): PurchaseOutcome {
  return entitlement.active ? { kind: "success" } : { kind: "failed", failure: "pending" };
}

/** What the screen says about a failure. Never a raw store code. */
export function failureMessage(failure: PurchaseFailure): string {
  switch (failure) {
    case "pending":
      return "Google Play is still confirming your purchase. Your chapters open as soon as it's done.";
    case "already_owned":
      return "This Google account already has a subscription. Tap Restore purchase to use it here.";
    case "store_unavailable":
      return "Google Play can't take payments on this device right now.";
    case "network":
      return "We couldn't reach Google Play. Check your connection and try again.";
    case "other":
      return "The purchase didn't go through. Please try again.";
  }
}

/** A restore that found no active subscription. */
export const NOTHING_TO_RESTORE = "No active subscription was found for this Google account.";
