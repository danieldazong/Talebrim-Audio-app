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

/** Waiting on whichever of `queries` has no data yet: offline beats failed beats loading. */
export function waitFor(queries: NeededQuery[]): { view: { status: WaitStatus }; waitingOn: NeededQuery[] } {
  const waitingOn = queries.filter((query) => query.data === undefined);
  let status: WaitStatus = "loading";
  if (waitingOn.some((query) => query.fetchStatus === "paused")) status = "offline";
  // Failed and not retrying — while a retry runs, it counts as loading again.
  else if (waitingOn.some((query) => query.isError && !query.isFetching)) status = "failed";
  return { view: { status }, waitingOn };
}
