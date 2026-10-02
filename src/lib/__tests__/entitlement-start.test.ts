/// <reference types="jest" />

import { QueryClient } from "@tanstack/react-query";

import { entitlementFrom, type Entitlement } from "@/lib/billing";
import { entitlementOptions, watchEntitlementStarts } from "@/lib/queries/billing";

// Prompt 22a step 7: the server is asked to check its copy of the plan once a
// session, when the first answer is active, and whenever the plan turns
// active, whatever brings the news (the SDK's listener, a refetch, a
// purchase).

jest.mock("@/lib/revenuecat", () => ({
  getEntitlement: jest.fn(),
  getCurrentOffering: () => Promise.resolve(null),
}));

const USER = "user_a";
const ACTIVE: Entitlement = {
  active: true,
  expiresAt: "2026-10-02T17:14:33Z",
  willRenew: true,
  productId: "ad_free_yearly",
  planId: null,
  store: "TEST_STORE",
  managementUrl: null,
};

let client: QueryClient;
let onStart: jest.Mock;
let stop: () => void;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  onStart = jest.fn();
  stop = watchEntitlementStarts(client, USER, onStart);
});

afterEach(() => {
  stop();
  client.clear();
});

const key = entitlementOptions(USER).queryKey;

it("calls once for the session's first answer when it is active", async () => {
  await client.fetchQuery({ queryKey: key, queryFn: () => ACTIVE });
  expect(onStart).toHaveBeenCalledTimes(1);
  // A refetch or a renewal of a running plan is no new start.
  client.setQueryData(key, { ...ACTIVE, expiresAt: "2026-10-02T18:14:33Z" });
  expect(onStart).toHaveBeenCalledTimes(1);
});

it("calls when an inactive plan turns active, as a purchase writes it", () => {
  client.setQueryData(key, entitlementFrom(null));
  expect(onStart).not.toHaveBeenCalled();
  client.setQueryData(key, ACTIVE);
  expect(onStart).toHaveBeenCalledTimes(1);
});

it("calls again for a plan that ends and starts again", () => {
  client.setQueryData(key, ACTIVE);
  client.setQueryData(key, entitlementFrom(null));
  client.setQueryData(key, ACTIVE);
  expect(onStart).toHaveBeenCalledTimes(2);
});

it("ignores another reader's plan, and stops at the unsubscribe", () => {
  client.setQueryData(entitlementOptions("user_b").queryKey, ACTIVE);
  expect(onStart).not.toHaveBeenCalled();

  stop();
  client.setQueryData(key, ACTIVE);
  expect(onStart).not.toHaveBeenCalled();
});
