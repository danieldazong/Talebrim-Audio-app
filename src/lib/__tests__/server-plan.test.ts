/// <reference types="jest" />

import { FunctionsHttpError } from "@supabase/supabase-js";

import { syncServerPlan, syncServerPlanWithin } from "@/lib/server-plan";

// Prompt 22a step 6: the one call that asks the server to check the reader's
// plan. One request for callers made together, the server's answer as is,
// and never a throw: a failure is "not checked".

const mockInvoke = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));

beforeEach(() => {
  mockInvoke.mockReset();
  // The development log of each answer.
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
});

it("asks the sync-entitlement function, and reads its answer", async () => {
  mockInvoke.mockResolvedValue({ data: { active: true, expires_at: "2026-10-02T18:00:00.000Z" }, error: null });
  await expect(syncServerPlan()).resolves.toEqual({ active: true, expiresAt: "2026-10-02T18:00:00.000Z" });
  expect(mockInvoke).toHaveBeenCalledWith("sync-entitlement", { method: "POST" });
});

it("shares one request among callers made together, and makes a new one after", async () => {
  mockInvoke.mockResolvedValue({ data: { active: false, expires_at: null }, error: null });
  const [first, second] = await Promise.all([syncServerPlan(), syncServerPlan()]);
  expect(mockInvoke).toHaveBeenCalledTimes(1);
  expect(first).toEqual({ active: false, expiresAt: null });
  expect(second).toBe(first);

  await syncServerPlan();
  expect(mockInvoke).toHaveBeenCalledTimes(2);
});

it("answers null, never a throw, when the function refuses or can't be reached", async () => {
  mockInvoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError({ status: 502 } as unknown as Response) });
  await expect(syncServerPlan()).resolves.toBeNull();

  mockInvoke.mockRejectedValueOnce(new TypeError("Network request failed"));
  await expect(syncServerPlan()).resolves.toBeNull();
});

it("stops waiting after the time it is given, and answers sooner when the server does", async () => {
  jest.useFakeTimers();
  let answer: (value: unknown) => void = () => {};
  mockInvoke.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
  const waited = syncServerPlanWithin(5_000);
  await jest.advanceTimersByTimeAsync(5_000);
  await expect(waited).resolves.toBeNull();
  // The request carries on, and settles by itself.
  answer({ data: { active: true, expires_at: null }, error: null });
  await jest.advanceTimersByTimeAsync(0);

  mockInvoke.mockResolvedValueOnce({ data: { active: true, expires_at: null }, error: null });
  await expect(syncServerPlanWithin(5_000)).resolves.toEqual({ active: true, expiresAt: null });
});
