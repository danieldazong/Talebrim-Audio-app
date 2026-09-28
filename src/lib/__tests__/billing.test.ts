/// <reference types="jest" />

import { PURCHASES_ERROR_CODE } from "react-native-purchases";

import {
  currentPlan,
  defaultPlan,
  entitlementFrom,
  failureMessage,
  outcomeOfError,
  outcomeOfPurchase,
  parsePeriod,
  playSubscriptionsUrl,
  plansFrom,
  renewalLine,
  storeTitle,
  type PlanPackage,
} from "@/lib/billing";
import { formatDate } from "@/lib/format";

// Billing's pure parts (prompt 22 step 16). Every price string below is what
// the store would send: nothing in `lib/billing.ts` formats a currency.

// The SDK's real error codes, from the package that defines them. Loading the
// SDK itself pulls in its browser bundle, which Jest can't parse; the app
// never loads it where billing can't run (`lib/revenuecat.ts`).
jest.mock("react-native-purchases", () => ({
  PURCHASES_ERROR_CODE: jest.requireActual("@revenuecat/purchases-typescript-internal").PURCHASES_ERROR_CODE,
}));

function pkg(
  identifier: string,
  period: string | null,
  price: string,
  perWeek: number | null,
  perWeekString: string | null,
  title = `Ad-Free ${identifier} (Talebrim)`,
): PlanPackage {
  return {
    identifier,
    product: {
      identifier: `ad_free:${identifier}`,
      title,
      priceString: price,
      pricePerWeek: perWeek,
      pricePerWeekString: perWeekString,
      subscriptionPeriod: period,
    },
  };
}

const WEEKLY = pkg("weekly", "P1W", "$4.99", 4.99, "$4.99");
const MONTHLY = pkg("monthly", "P1M", "$14.99", 3.45, "$3.45");
const YEARLY = pkg("yearly", "P1Y", "$89.99", 1.73, "$1.73");

const ACTIVE = entitlementFrom(
  {
    isActive: true,
    expirationDate: "2026-10-02T09:00:00Z",
    willRenew: true,
    productIdentifier: "ad_free",
    productPlanIdentifier: "weekly",
    store: "PLAY_STORE",
  },
  "https://play.google.com/store/account/subscriptions",
);

describe("plansFrom", () => {
  it("orders plans by period, shortest first, whatever order the offering holds them in", () => {
    const lifetime = pkg("lifetime", null, "$199.99", null, null);
    const quarterly = pkg("quarterly", "P3M", "$39.99", 3.07, "$3.07");
    const days = pkg("fortnight", "P14D", "$8.99", 4.5, "$4.50");
    expect(plansFrom([lifetime, YEARLY, quarterly, WEEKLY, days, MONTHLY]).map((plan) => plan.id)).toEqual([
      "weekly",
      "fortnight",
      "monthly",
      "quarterly",
      "yearly",
      "lifetime",
    ]);
    expect(plansFrom([])).toEqual([]);
  });

  it("gives a saving plan 'Save N%', and the one that saves most 'Best value' instead", () => {
    const plans = plansFrom([YEARLY, MONTHLY, WEEKLY]);
    expect(plans.map((plan) => plan.badge)).toEqual([
      null,
      // (1 - 3.45 / 4.99) = 30.9%, rounded down so it never overstates.
      { kind: "save", percent: 30 },
      { kind: "best-value", percent: 65 },
    ]);
  });

  it("badges nothing for a single plan, or a plan that saves nothing", () => {
    expect(plansFrom([MONTHLY])[0].badge).toBeNull();
    const dearer = pkg("monthly", "P1M", "$24.99", 5.75, "$5.75");
    const plans = plansFrom([WEEKLY, dearer]);
    expect(plans.map((plan) => plan.badge)).toEqual([null, null]);
  });

  it("names Weekly, Monthly and Yearly by period, and anything else by the store's title", () => {
    const quarterly = pkg("quarterly", "P3M", "$39.99", 3.07, "$3.07", "Ad-Free Season (Talebrim)");
    expect(plansFrom([WEEKLY, MONTHLY, YEARLY, quarterly]).map((plan) => plan.name)).toEqual([
      "Weekly",
      "Monthly",
      "Ad-Free Season",
      "Yearly",
    ]);
  });

  it("writes the per-week subline from the store's own strings", () => {
    const plans = plansFrom([WEEKLY, MONTHLY, YEARLY]);
    expect(plans.map((plan) => plan.subline)).toEqual([
      "Billed every 7 days",
      "$3.45/week",
      "$1.73/week · Save 65%",
    ]);
    // No per-week string: how often it bills instead.
    expect(plansFrom([WEEKLY, pkg("monthly", "P1M", "$14.99", null, null)])[1].subline).toBe("Billed every month");
  });

  it("reads each card as one sentence, and states its renewal", () => {
    const [weekly, monthly, yearly] = plansFrom([WEEKLY, MONTHLY, YEARLY]);
    expect(weekly.spoken).toBe("Weekly, $4.99 every 7 days.");
    expect(monthly.spoken).toBe("Monthly, $14.99 every month, save 30%.");
    expect(yearly.spoken).toBe("Yearly, $89.99 every year, best value, save 65%.");
    expect(monthly.renewal).toBe("Renews every month until you cancel in Google Play.");
  });
});

describe("periods and titles", () => {
  it("parses the store's ISO periods, and nothing else", () => {
    expect(parsePeriod("P1W")).toEqual({ unit: "week", count: 1 });
    expect(parsePeriod("P7D")).toEqual({ unit: "week", count: 1 });
    expect(parsePeriod("P3D")).toEqual({ unit: "day", count: 3 });
    expect(parsePeriod("P12M")).toEqual({ unit: "year", count: 1 });
    expect(parsePeriod("P6M")).toEqual({ unit: "month", count: 6 });
    expect(parsePeriod(null)).toBeNull();
    expect(parsePeriod("P1Y2M")).toBeNull();
    expect(parsePeriod("P0W")).toBeNull();
  });

  it("drops the app name Google Play appends to a product's title", () => {
    expect(storeTitle("Ad-Free Weekly (Talebrim)")).toBe("Ad-Free Weekly");
    expect(storeTitle("Ad-Free Weekly")).toBe("Ad-Free Weekly");
    expect(storeTitle("(Talebrim)")).toBe("(Talebrim)");
  });
});

describe("the reader's plan", () => {
  it("reads an active entitlement, and nothing from an inactive or missing one", () => {
    expect(ACTIVE).toMatchObject({ active: true, productId: "ad_free", planId: "weekly", willRenew: true });
    expect(entitlementFrom(null)).toMatchObject({ active: false, productId: null });
    expect(
      entitlementFrom({
        isActive: false,
        expirationDate: null,
        willRenew: false,
        productIdentifier: "ad_free",
        productPlanIdentifier: null,
        store: "PLAY_STORE",
      }).active,
    ).toBe(false);
  });

  it("finds the current plan by subscription and base plan, and preselects it", () => {
    const plans = plansFrom([WEEKLY, MONTHLY, YEARLY]);
    const current = currentPlan(plans, ACTIVE);
    expect(current?.id).toBe("weekly");
    expect(defaultPlan(plans, current)?.id).toBe("weekly");
  });

  it("preselects 'Best value' for a non-subscriber, else the first plan", () => {
    const plans = plansFrom([WEEKLY, MONTHLY, YEARLY]);
    expect(currentPlan(plans, entitlementFrom(null))).toBeNull();
    expect(defaultPlan(plans, null)?.id).toBe("yearly");
    expect(defaultPlan(plansFrom([MONTHLY]), null)?.id).toBe("monthly");
    expect(defaultPlan([], null)).toBeNull();
  });

  it("says when it renews and for how much, or when it ends", () => {
    const date = formatDate("2026-10-02T09:00:00Z");
    const weekly = currentPlan(plansFrom([WEEKLY]), ACTIVE);
    expect(renewalLine(ACTIVE, weekly)).toBe(`Renews ${date} · $4.99/week`);
    // Not in the offering: no price to state.
    expect(renewalLine(ACTIVE, null)).toBe(`Renews ${date}`);
    expect(renewalLine({ ...ACTIVE, willRenew: false }, weekly)).toBe(`Ends ${date}`);
    expect(renewalLine({ ...ACTIVE, expiresAt: null }, weekly)).toBeNull();
  });

  it("links to Google Play's subscriptions page for this app", () => {
    expect(playSubscriptionsUrl("com.talebrim.app", "ad_free")).toBe(
      "https://play.google.com/store/account/subscriptions?package=com.talebrim.app&sku=ad_free",
    );
    expect(playSubscriptionsUrl("com.talebrim.app", null)).toBe(
      "https://play.google.com/store/account/subscriptions?package=com.talebrim.app",
    );
  });
});

describe("outcomes", () => {
  it("classifies the SDK's error codes, a cancel included, never its message", () => {
    const error = (code: PURCHASES_ERROR_CODE) => ({ code, message: "anything", userCancelled: null });
    expect(outcomeOfError(error(PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR))).toEqual({ kind: "cancelled" });
    expect(outcomeOfError(error(PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR))).toEqual({
      kind: "failed",
      failure: "pending",
    });
    for (const code of [
      PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR,
      PURCHASES_ERROR_CODE.RECEIPT_ALREADY_IN_USE_ERROR,
      PURCHASES_ERROR_CODE.RECEIPT_IN_USE_BY_OTHER_SUBSCRIBER_ERROR,
    ]) {
      expect(outcomeOfError(error(code))).toEqual({ kind: "failed", failure: "already_owned" });
    }
    for (const code of [
      PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR,
      PURCHASES_ERROR_CODE.PURCHASE_NOT_ALLOWED_ERROR,
      PURCHASES_ERROR_CODE.PRODUCT_NOT_AVAILABLE_FOR_PURCHASE_ERROR,
      PURCHASES_ERROR_CODE.UNSUPPORTED_ERROR,
    ]) {
      expect(outcomeOfError(error(code))).toEqual({ kind: "failed", failure: "store_unavailable" });
    }
    for (const code of [PURCHASES_ERROR_CODE.NETWORK_ERROR, PURCHASES_ERROR_CODE.OFFLINE_CONNECTION_ERROR]) {
      expect(outcomeOfError(error(code))).toEqual({ kind: "failed", failure: "network" });
    }
    expect(outcomeOfError(error(PURCHASES_ERROR_CODE.UNKNOWN_ERROR))).toEqual({ kind: "failed", failure: "other" });
    // A cancel described in words is still not a cancel: only the code counts.
    expect(outcomeOfError({ message: "Purchase was cancelled." })).toEqual({ kind: "failed", failure: "other" });
    expect(outcomeOfError(new Error("boom"))).toEqual({ kind: "failed", failure: "other" });
  });

  it("counts a completed purchase as pending until the entitlement is active", () => {
    expect(outcomeOfPurchase(ACTIVE)).toEqual({ kind: "success" });
    expect(outcomeOfPurchase(entitlementFrom(null))).toEqual({ kind: "failed", failure: "pending" });
  });

  it("never shows a raw store code", () => {
    for (const failure of ["pending", "already_owned", "store_unavailable", "network", "other"] as const) {
      expect(failureMessage(failure)).not.toMatch(/\d|error|code/i);
    }
  });
});
