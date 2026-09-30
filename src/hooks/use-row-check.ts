import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { rowCheck, type RowCheck } from "@/lib/query-status";

/**
 * `rowCheck()` for one open of a screen: whether the chapter row its query
 * holds may decide a lock yet (2026-09-30, AGENTS.md Decisions, "A lock set
 * in the dashboard holds"). M5, M6 and M5a read their chapter row through it.
 *
 * Latched once current, so the row ageing past its stale time, or a refetch
 * that fails, never sends an open chapter back to loading. A refetch that
 * comes back still updates the data, and the lock rule reads that: a chapter
 * the owner locks while it is open turns Locked.
 */
export function useRowCheck(query: UseQueryResult<unknown>): RowCheck {
  const [currentThisOpen, setCurrentThisOpen] = useState(false);
  const check = rowCheck(query, currentThisOpen);
  if (!currentThisOpen && check === "current") setCurrentThisOpen(true);

  // A stale row that nothing is fetching would wait forever: fetch it.
  const idle = check === "checking" && query.data !== undefined && query.fetchStatus === "idle";
  const { refetch } = query;
  useEffect(() => {
    if (idle) void refetch();
  }, [idle, refetch]);

  return check;
}
