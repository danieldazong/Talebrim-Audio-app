import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useEntitlement } from "@/hooks/use-entitlement";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { chapterDetailOptions } from "@/lib/queries/chapters";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";
import { lockStateFor } from "@/types/states";

/** The chapter M5a names. */
export type PaywallChapter = { id: string; bookId: string; number: number; title: string | null };

export type PaywallView =
  | { status: "locked"; chapter: PaywallChapter }
  /** Not locked after all (a subscription, an unlock): the sheet gives way to the chapter. */
  | { status: "open" }
  | { status: "loading" | "failed" | "offline" | "unavailable" };

type Resolved = { view: PaywallView; waitingOn: NeededQuery[] };

/**
 * M5a's chapter and its lock, through the one lock rule. The sheet is never
 * shown for a chapter that isn't locked: it checks on open, and again
 * whenever the unlocks or the entitlement change, so a subscription or an
 * unlock that lands while it is up opens the chapter instead.
 *
 * The same queries, keys and precedence as M5 and M6, so coming from either
 * they are cached.
 */
export function usePaywallChapter(chapterId: string) {
  const { userId } = useAuth();
  const chapter = useQuery(chapterDetailOptions(chapterId));
  const settings = useQuery(appSettingsOptions());
  // Signed-in route, so `userId` is set.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const entitlement = useEntitlement();

  const unlockedChapterIds = useMemo(
    () => (unlocks.data ? new Set(unlocks.data.map((unlock) => unlock.chapter_id)) : undefined),
    [unlocks.data],
  );

  function resolve(): Resolved {
    if (chapter.data === undefined) return waitFor([chapter]);
    const row = chapter.data;
    // Missing, unpublished or hidden by RLS.
    if (row === null || row.id === null || row.book_id === null || row.number === null) {
      return { view: { status: "unavailable" }, waitingOn: [] };
    }
    if (settings.data === undefined) return waitFor([settings]);

    const lock = lockStateFor(
      { id: row.id, number: row.number, access: row.access },
      settings.data.free_chapters_at_start,
      unlockedChapterIds,
      entitlement.data?.active,
    );
    if (lock === null) return waitFor([unlocks, entitlement]);
    if (lock.kind !== "locked") return { view: { status: "open" }, waitingOn: [] };
    return {
      view: { status: "locked", chapter: { id: row.id, bookId: row.book_id, number: row.number, title: row.title } },
      waitingOn: [],
    };
  }

  const { view, waitingOn } = resolve();

  function retry() {
    for (const query of waitingOn) {
      if (query.isError) void query.refetch();
    }
  }

  return {
    view,
    /** Where the reader manages a subscription they have had; null if they never have. */
    managementUrl: entitlement.data?.managementUrl ?? null,
    retry,
  };
}
