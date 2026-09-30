/// <reference types="jest" />

import { rowCheck, type CheckedQuery } from "@/lib/query-status";

// A lock set in the dashboard holds (2026-09-30): M5, M6 and M5a open or lock
// a chapter only with a current row, never a stale cached one.

const ROW = { access: "free" };

function query(overrides: Partial<CheckedQuery>): CheckedQuery {
  return { data: ROW, isStale: false, isError: false, isFetching: false, fetchStatus: "idle", ...overrides };
}

describe("rowCheck", () => {
  it("trusts a row fetched within the stale time and not marked changed", () => {
    expect(rowCheck(query({}), false)).toBe("current");
  });

  it("waits while a stale row, restored from before the owner locked the chapter, is fetched again", () => {
    expect(rowCheck(query({ isStale: true, isFetching: true, fetchStatus: "fetching" }), false)).toBe("checking");
    // Not fetching and not failed yet: still nothing to decide with.
    expect(rowCheck(query({ isStale: true }), false)).toBe("checking");
  });

  it("offline, lets the cached row stand, as nothing newer can be had", () => {
    expect(rowCheck(query({ isStale: true, fetchStatus: "paused" }), false)).toBe("cached");
  });

  it("fails when fetching the stale row again failed, and waits again while Retry runs", () => {
    expect(rowCheck(query({ isStale: true, isError: true }), false)).toBe("failed");
    expect(rowCheck(query({ isStale: true, isError: true, isFetching: true, fetchStatus: "fetching" }), false)).toBe(
      "checking",
    );
  });

  it("stays current for the rest of the open, however old the row gets", () => {
    expect(rowCheck(query({ isStale: true }), true)).toBe("current");
    expect(rowCheck(query({ isStale: true, isError: true }), true)).toBe("current");
  });

  it("has nothing to trust before the first answer", () => {
    expect(rowCheck(query({ data: undefined, isStale: true, isFetching: true, fetchStatus: "fetching" }), false)).toBe(
      "checking",
    );
  });
});
