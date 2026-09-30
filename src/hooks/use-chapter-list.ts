import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useDownloadEntries, useDownloadQueue, useDownloadsHydrated } from "@/hooks/use-downloads";
import { useEntitlement } from "@/hooks/use-entitlement";
import {
  buildChapterRows,
  downloadAllState,
  downloadFailureMessage,
  unlockedCount,
  type ChapterListRow,
  type DownloadAllState,
} from "@/lib/chapter-list";
import { resolveCoverUrl } from "@/lib/covers";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterListByBookOptions } from "@/lib/queries/chapters";
import { resumeTargetOptions } from "@/lib/queries/reading-position";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { waitFor, type NeededQuery } from "@/lib/query-status";

export type ChapterListView =
  | {
      status: "ready";
      rows: ChapterListRow[];
      unlockedCount: number;
      /** M9's bottom bar: not subscribed, and at least one chapter locked (prompt 22 step 11). */
      showAdFreeBar: boolean;
      /** The sort bar's "Download all" slot (prompt 24 step 12). */
      downloadAll: DownloadAllState;
      /** Why chapters of this book failed to download, in words; null when none did. */
      downloadFailure: string | null;
    }
  | { status: "loading" | "offline" | "failed" | "unavailable" | "empty" };

type Resolved = { view: ChapterListView; waitingOn: NeededQuery[] };

function settled(status: "loading" | "unavailable" | "empty"): Resolved {
  return { view: { status }, waitingOn: [] };
}

/**
 * Everything M9 reads for one book, and the state it resolves to, in M5's
 * and M6's precedence (prompt 20 step 12).
 *
 * Six queries for a book of any length, never one per row: the book, every
 * chapter's metadata, the settings (for the cover), the unlocks, the
 * entitlement and the resume target. M4 reads all but the chapter list, so
 * they are usually cached.
 *
 * The rows wait for the list, the unlocks and the entitlement,
 * so a row never shows Unlocked and then turns Locked, and the bottom bar
 * never shows to a subscriber. They wait for the resume target too,
 * so the list opens at the Reading Now row, but only for one answer: failed
 * or offline, it means no Reading Now row. Parity never blocks the list.
 * And they wait for the downloads index to rehydrate, so a downloaded row
 * never shows as not downloaded first (prompt 24 step 5).
 */
export function useChapterList(bookId: string) {
  const { userId } = useAuth();

  const book = useQuery(bookDetailOptions(bookId));
  const list = useQuery(chapterListByBookOptions(bookId));
  const settings = useQuery(appSettingsOptions());
  // Signed-in route, so `userId` is set. RLS returns only this reader's rows.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const entitlement = useEntitlement();
  // Reading Now is the chapter M4's Read resumes. The parity writer puts every
  // row it saves into this key, so it moves when the reader comes back from
  // M5 or M6.
  const resume = useQuery({
    ...resumeTargetOptions(userId ?? "", bookId),
    enabled: Boolean(userId),
    // One try: a missing position must not hold the list through retries.
    retry: false,
  });

  const resumeAnswered =
    !userId ||
    resume.data !== undefined ||
    (resume.isError && !resume.isFetching) ||
    resume.fetchStatus === "paused";
  // Latched, so a later refetch (reconnecting, say) never sends an open list
  // back to the skeleton.
  const [resumeSettled, setResumeSettled] = useState(false);
  if (!resumeSettled && resumeAnswered) setResumeSettled(true);

  // Downloads (prompt 24): the index, once rehydrated, and this book's
  // chapters in the queue. A refresh of an edited download is never shown.
  const downloadsHydrated = useDownloadsHydrated();
  const entries = useDownloadEntries();
  const queue = useDownloadQueue();
  const downloaded = useMemo(() => new Set(entries.map((entry) => entry.chapterId)), [entries]);
  const bookQueue = useMemo(
    () => queue.filter((item) => item.bookId === bookId && item.kind === "download"),
    [queue, bookId],
  );

  function resolve(): Resolved {
    // Unpublished, missing or hidden by RLS — including a book the dashboard
    // unpublishes while M9 is open, since catalog sync refetches it.
    if (book.data === null) return settled("unavailable");
    if (book.data === undefined || list.data === undefined || !unlocks.data || !entitlement.data) {
      return waitFor([book, list, unlocks, entitlement]);
    }
    if (!resumeSettled || !downloadsHydrated) return settled("loading");

    const rows = buildChapterRows(
      list.data,
      {
        unlockedChapterIds: new Set(unlocks.data.map((unlock) => unlock.chapter_id)),
        isSubscribed: entitlement.data.active,
      },
      resume.data?.chapter_id ?? null,
      { downloaded, queue: bookQueue },
    );
    if (rows.length === 0) return settled("empty");
    const unlocked = unlockedCount(rows);
    return {
      view: {
        status: "ready",
        rows,
        unlockedCount: unlocked,
        showAdFreeBar: !entitlement.data.active && unlocked < rows.length,
        downloadAll: downloadAllState(rows, bookQueue),
        downloadFailure: downloadFailureMessage(bookQueue),
      },
      waitingOn: [],
    };
  }

  const { view, waitingOn } = resolve();

  function retry() {
    for (const query of waitingOn) {
      if (query.isError) void query.refetch();
    }
  }

  const domain = settings.data?.public_cdn_domain ?? null;

  return {
    view,
    /** The header's book, whenever it is known, in any state. */
    book: book.data
      ? {
          title: book.data.title ?? "Untitled",
          coverUrl: domain === null ? null : resolveCoverUrl(domain, book.data.cover_path),
          recyclingKey: book.data.id ?? undefined,
        }
      : null,
    retry,
  };
}
