/// <reference types="jest" />

import { QueryClient } from "@tanstack/react-query";

import { entitlementFrom, type Entitlement } from "@/lib/billing";
import { entitlementOptions, watchEntitlementLapses } from "@/lib/queries/billing";

// Prompt 22 step 19: a plan that ends is noticed, whatever brings the news
// (the SDK's listener, a refetch, a restore), once per end.

jest.mock("@/lib/revenuecat", () => ({
  getEntitlement: jest.fn(),
  getCurrentOffering: () => Promise.resolve(null),
}));

const USER = "user_a";
const ACTIVE: Entitlement = {
  active: true,
  expiresAt: "2026-10-01T17:14:33Z",
  willRenew: true,
  productId: "ad_free_yearly",
  planId: null,
  store: "TEST_STORE",
  managementUrl: null,
};

let client: QueryClient;
let onLapse: jest.Mock;
let stop: () => void;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  onLapse = jest.fn();
  stop = watchEntitlementLapses(client, USER, onLapse);
});

afterEach(() => {
  stop();
  client.clear();
});

const key = entitlementOptions(USER).queryKey;

it("calls once when the plan ends, as the listener writes it", () => {
  client.setQueryData(key, ACTIVE);
  client.setQueryData(key, entitlementFrom(null));
  expect(onLapse).toHaveBeenCalledTimes(1);
  // The same answer again is no second end.
  client.setQueryData(key, entitlementFrom(null));
  expect(onLapse).toHaveBeenCalledTimes(1);
});

it("notices an end that a refetch brings first", async () => {
  client.setQueryData(key, ACTIVE);
  await client.fetchQuery({ queryKey: key, queryFn: () => entitlementFrom(null), staleTime: 0 });
  expect(onLapse).toHaveBeenCalledTimes(1);
});

it("never calls for a first answer that is inactive, a plan still running, or one that starts", () => {
  client.setQueryData(key, entitlementFrom(null));
  client.setQueryData(key, ACTIVE);
  client.setQueryData(key, { ...ACTIVE, expiresAt: "2026-10-01T18:14:33Z" });
  expect(onLapse).not.toHaveBeenCalled();
});

it("ignores another reader's plan, and stops at the unsubscribe", () => {
  const other = entitlementOptions("user_b").queryKey;
  client.setQueryData(other, ACTIVE);
  client.setQueryData(other, entitlementFrom(null));
  expect(onLapse).not.toHaveBeenCalled();

  client.setQueryData(key, ACTIVE);
  stop();
  client.setQueryData(key, entitlementFrom(null));
  expect(onLapse).not.toHaveBeenCalled();
});
