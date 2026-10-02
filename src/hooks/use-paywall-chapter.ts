import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useEntitlement } from "@/hooks/use-entitlement";
import { useRowCheck } from "@/hooks/use-row-check";
import { resolveCoverUrl } from "@/lib/covers";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions } from "@/lib/queries/chapters";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";
import { lockStateFor } from "@/types/states";

/** The chapter M5a names. */
export type PaywallChapter = { id: string; bookId: string; number: number; title: string | null };

/** The story M5a sells: its title, and its cover when the CDN domain is known. */
export type PaywallStory = { title: string; coverUrl: string | null };

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
  // A cached row can be from before the owner locked or freed the chapter:
  // the sheet decides nothing until it is current, or the phone is offline
  // (2026-09-30).
  const chapterCheck = useRowCheck(chapter);
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
    if (chapterCheck === "checking") return { view: { status: "loading" }, waitingOn: [] };
    if (chapterCheck === "failed") return { view: { status: "failed" }, waitingOn: [chapter] };
    const lock = lockStateFor(
      { id: row.id, number: row.number, access: row.access },
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

  // The story is never waited on: a slow or failed read of it only leaves the
  // chapter as the headline. Usually cached, by the screen the reader came from.
  const bookId = view.status === "locked" ? view.chapter.bookId : null;
  const book = useQuery({ ...bookDetailOptions(bookId ?? ""), enabled: bookId !== null });
  const settings = useQuery(appSettingsOptions());
  const domain = settings.data?.public_cdn_domain ?? null;
  const story: PaywallStory | null = book.data?.title
    ? { title: book.data.title, coverUrl: domain === null ? null : resolveCoverUrl(domain, book.data.cover_path) }
    : null;

  function retry() {
    for (const query of waitingOn) {
      if (query.isError) void query.refetch();
    }
  }

  return {
    view,
    story,
    /** The story is on its way: a fetch in flight, not one paused offline or failed. */
    storyPending: bookId !== null && book.isPending && book.fetchStatus === "fetching",
    /** Where the reader manages a subscription they have had; null if they never have. */
    managementUrl: entitlement.data?.managementUrl ?? null,
    retry,
  };
}
