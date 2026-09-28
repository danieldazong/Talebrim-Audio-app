/// <reference types="jest" />

import { alertBookId, isAlertsFrom, permissionFrom, shouldAskForAlerts } from "@/lib/alerts";

// New-chapter alerts' pure rules (prompt 23a). The SDK and the server are
// `lib/push.ts`'s, and are checked on the development build.

const BOOK_ID = "0b6f3c1e-6a4f-4f0e-9d7a-2c1b5e8f9a01";

describe("permissionFrom", () => {
  it("reads granted, can ask and blocked", () => {
    expect(permissionFrom({ granted: true, canAskAgain: true })).toBe("granted");
    expect(permissionFrom({ granted: true, canAskAgain: false })).toBe("granted");
    expect(permissionFrom({ granted: false, canAskAgain: true })).toBe("can_ask");
    expect(permissionFrom({ granted: false, canAskAgain: false })).toBe("blocked");
  });
});

describe("shouldAskForAlerts", () => {
  const ask = { available: true, enabled: false, answered: false, permission: "can_ask" as const };

  it("asks an account that hasn't answered, with alerts off", () => {
    expect(shouldAskForAlerts(ask)).toBe(true);
    // Granted already (Android 12 and older grant by default): still asked, since alerts are off.
    expect(shouldAskForAlerts({ ...ask, permission: "granted" })).toBe(true);
  });

  it("never asks again once answered", () => {
    expect(shouldAskForAlerts({ ...ask, answered: true })).toBe(false);
  });

  it("never asks with alerts on", () => {
    expect(shouldAskForAlerts({ ...ask, enabled: true, permission: "granted" })).toBe(false);
  });

  it("never asks when the system has blocked alerts", () => {
    expect(shouldAskForAlerts({ ...ask, permission: "blocked" })).toBe(false);
  });

  it("never asks where push can't run", () => {
    expect(shouldAskForAlerts({ ...ask, available: false })).toBe(false);
  });
});

describe("alertBookId", () => {
  it("reads the book the server sent", () => {
    expect(alertBookId({ book_id: BOOK_ID })).toBe(BOOK_ID);
  });

  it("opens nothing for a missing or malformed book", () => {
    expect(alertBookId({ book_id: "../../subscription" })).toBeNull();
    expect(alertBookId({ book_id: 42 })).toBeNull();
    expect(alertBookId({})).toBeNull();
    expect(alertBookId(null)).toBeNull();
    expect(alertBookId(undefined)).toBeNull();
    expect(alertBookId("book")).toBeNull();
  });
});

describe("isAlertsFrom", () => {
  it("knows the sheet's two ways in", () => {
    expect(isAlertsFrom("my_list")).toBe(true);
    expect(isAlertsFrom("bell")).toBe(true);
    expect(isAlertsFrom("launch")).toBe(false);
    expect(isAlertsFrom(undefined)).toBe(false);
  });
});
