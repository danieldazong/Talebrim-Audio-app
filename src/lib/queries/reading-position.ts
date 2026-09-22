import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { ReadingPositionRow } from "@/types/unbacked";

// UNBACKED: no table until prompt 14
/**
 * STUB — `reading_positions` does not exist yet (types/unbacked.ts,
 * AGENTS.md § read/listen parity: "steps 2–4 need that table before they
 * can be implemented"). Do not wire this into a screen; it exists only so
 * the query key and the eventual fetcher shape are declared in one place.
 * Calling `queryFn` throws on purpose rather than silently returning null,
 * so a screen that accidentally renders it fails loudly instead of showing
 * a false "no position" empty state.
 */
export const readingPositionByChapterOptions = (
  userId: string,
  chapterId: string,
) =>
  queryOptions<ReadingPositionRow | null>({
    queryKey: queryKeys.readingPosition.byChapter(userId, chapterId),
    queryFn: async () => {
      throw new Error(
        "UNBACKED: reading_positions table does not exist until prompt 14",
      );
    },
    enabled: false,
  });
