// How a screen's status union reads the queries it waits on. Shared by M5
// (`hooks/use-chapter-reader.ts`) and M6 (`hooks/use-now-playing.ts`).
// No React, no hooks, no JSX — AGENTS.md § lib/.
import type { FetchStatus } from "@tanstack/react-query";

/** What a screen hook reads from a query it is waiting on. */
export type NeededQuery = {
  data: unknown;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: FetchStatus;
  refetch: () => Promise<unknown>;
};

export type WaitStatus = "offline" | "failed" | "loading";

/**
 * Whether a screen may open or lock a chapter with the row its query holds
 * (2026-09-30, AGENTS.md Decisions, "A lock set in the dashboard holds"):
 * - `current`: fetched within the stale time and not marked changed since,
 *   or already current once during this open (`currentThisOpen`).
 * - `cached`: stale, but the phone is offline, so the fetch waits. The cached
 *   row stands, as nothing newer can be had.
 * - `checking`: stale and being fetched again. A row restored from the
 *   persisted cache can be hours old, from before the owner locked the
 *   chapter, so it decides nothing until the answer arrives.
 * - `failed`: stale, and fetching it again failed.
 */
export type RowCheck = "current" | "cached" | "checking" | "failed";

/** What `rowCheck()` reads from the query that holds the row. */
export type CheckedQuery = Pick<NeededQuery, "data" | "isError" | "isFetching" | "fetchStatus"> & {
  isStale: boolean;
};

export function rowCheck(query: CheckedQuery, currentThisOpen: boolean): RowCheck {
  if (currentThisOpen || (query.data !== undefined && !query.isStale)) return "current";
  if (query.fetchStatus === "paused") return "cached";
  if (query.isError && !query.isFetching) return "failed";
  return "checking";
}

/** Waiting on whichever of `queries` has no data yet: offline beats failed beats loading. */
export function waitFor(queries: NeededQuery[]): { view: { status: WaitStatus }; waitingOn: NeededQuery[] } {
  const waitingOn = queries.filter((query) => query.data === undefined);
  let status: WaitStatus = "loading";
  if (waitingOn.some((query) => query.fetchStatus === "paused")) status = "offline";
  // Failed and not retrying — while a retry runs, it counts as loading again.
  else if (waitingOn.some((query) => query.isError && !query.isFetching)) status = "failed";
  return { view: { status }, waitingOn };
}
