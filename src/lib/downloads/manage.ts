// Offline downloads kept honest, and managed — prompt 24 steps 5, 8, 11 and
// 12. No React, no hooks, no JSX (AGENTS.md § lib/).
//
// - What "Download all" and a row's "Download chapter" queue
//   (`prepareDownloads()`).
// - The index and the folder made to agree on start (`reconcileDownloads()`).
// - The YouTube rule (`verifyDownloads()`): online, every download is checked
//   against fresh inputs; only a definite answer deletes one.
// - Removing downloads, and deleting every one at sign-out.
import { onlineManager } from "@tanstack/react-query";

import { track } from "@/lib/analytics";
import { changeTouchesChapter, type CatalogChange } from "@/lib/catalog-sync";
import { resolveCoverUrl } from "@/lib/covers";
import {
  deleteFile,
  deleteFolder,
  downloadsAvailable,
  listFileNames,
} from "@/lib/downloads/files";
import { downloadsFor } from "@/lib/downloads/local";
import {
  cancelBookDownloads,
  cancelChapterDownload,
  enqueueDownloads,
  enqueueRefresh,
  getDownloadQueue,
  isQueueBusy,
} from "@/lib/downloads/queue";
import {
  accessVerdict,
  downloadCandidates,
  entryFileNames,
  planReconcile,
  RECHECK_INTERVAL_MS,
  totalDownloadSize,
  withinOfflineWindow,
  type DownloadSize,
} from "@/lib/downloads/rules";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { entitlementOptions } from "@/lib/queries/billing";
import { bookDetailOptions } from "@/lib/queries/book";
import { downloadRowsByBookOptions, downloadRowsByIdsOptions, type DownloadRow } from "@/lib/queries/downloads";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryClient } from "@/lib/query-client";
import { useDownloadsStore, type DownloadedBook } from "@/store/downloads-store";
import type { ChapterLockInputs } from "@/types/states";

/** How many ids go in one access-check request: a URL of about 4 KB. */
const IDS_PER_REQUEST = 100;

function log(...args: unknown[]) {
  if (__DEV__) console.log("[downloads]", ...args);
}

/** When every download was last checked online, this session. */
let lastFullCheckAt: number | null = null;
let fullCheck: Promise<void> | null = null;

// --- Queueing -----------------------------------------------------------

/** What a download would fetch, ready to confirm and queue. */
export type DownloadPlan = {
  rows: DownloadRow[];
  size: DownloadSize;
  book: DownloadedBook;
};

/** The lock rule's inputs, fetched fresh: never a cached "can't tell yet". */
async function freshLockInputs(userId: string): Promise<ChapterLockInputs> {
  const [unlocks, entitlement] = await Promise.all([
    queryClient.fetchQuery({ ...unlocksByUserOptions(userId), staleTime: 0, retry: false }),
    queryClient.fetchQuery({ ...entitlementOptions(userId), staleTime: 0, retry: false }),
  ]);
  return {
    unlockedChapterIds: new Set(unlocks.map((unlock) => unlock.chapter_id)),
    isSubscribed: entitlement.active,
  };
}

/**
 * The chapters of `bookId` to download (only `chapterId` when given): every
 * one the reader can open now, by `chapterStateFor()` against fresh
 * unlocks and the entitlement, that has text or narration and
 * isn't downloaded or waiting already, with their total size (prompt 24
 * steps 4 and 6). Rejects offline, and when any input can't be fetched: a
 * chapter whose lock can't be told is never downloaded.
 */
export async function prepareDownloads(userId: string, bookId: string, chapterId?: string): Promise<DownloadPlan> {
  if (!onlineManager.isOnline()) throw new Error("offline");
  const [rows, inputs, book, settings] = await Promise.all([
    queryClient.fetchQuery({ ...downloadRowsByBookOptions(bookId), staleTime: 0, retry: false }),
    freshLockInputs(userId),
    queryClient.fetchQuery(bookDetailOptions(bookId)),
    queryClient.fetchQuery(appSettingsOptions()),
  ]);
  if (book === null || book.id === null) throw new Error("book not available");

  const skip = new Set([
    ...downloadsFor(userId).map((entry) => entry.chapterId),
    ...getDownloadQueue()
      .filter((item) => item.status === "queued" || item.status === "downloading")
      .map((item) => item.chapterId),
  ]);
  const candidates = downloadCandidates(
    chapterId === undefined ? rows : rows.filter((row) => row.id === chapterId),
    inputs,
    skip,
  );
  return {
    rows: candidates,
    size: totalDownloadSize(candidates),
    book: {
      id: book.id,
      title: book.title ?? "Untitled",
      author: book.author,
      coverUrl: resolveCoverUrl(settings.public_cdn_domain, book.cover_path),
    },
  };
}

/** Queues a prepared plan. `from` is where the reader asked: analytics' `from`. */
export function startDownloads(userId: string, plan: DownloadPlan, from: "download_all" | "row"): void {
  if (plan.rows.length === 0) return;
  track("download_requested", { book_id: plan.book.id, chapters: plan.rows.length, from });
  enqueueDownloads(userId, plan.rows, plan.book);
}

// --- Removing -----------------------------------------------------------

/**
 * Deletes chapters' downloads: out of the queue, then out of the index,
 * then their files, so nothing ever reads a file that is going.
 */
function deleteDownloads(chapterIds: readonly string[]) {
  const { chapters } = useDownloadsStore.getState();
  const names = chapterIds.flatMap((id) => {
    const entry = chapters[id];
    return entry ? entryFileNames(entry) : [];
  });
  for (const id of chapterIds) cancelChapterDownload(id);
  useDownloadsStore.getState().remove(chapterIds);
  for (const name of names) deleteFile(name);
}

/** The reader's "Remove download" on one chapter. No confirmation. */
export function removeChapterDownload(chapterId: string): void {
  deleteDownloads([chapterId]);
  track("download_removed", { scope: "chapter" });
}

/** The Downloads screen's remove on one book, and anything of it still waiting. */
export function removeBookDownloads(bookId: string): void {
  cancelBookDownloads(bookId);
  const ids = Object.values(useDownloadsStore.getState().chapters)
    .filter((entry) => entry.book.id === bookId)
    .map((entry) => entry.chapterId);
  deleteDownloads(ids);
  track("download_removed", { scope: "book" });
}

/** "Remove all downloads", after its one confirmation. */
export function removeAllDownloads(): void {
  const ids = Object.keys(useDownloadsStore.getState().chapters);
  for (const item of getDownloadQueue()) cancelChapterDownload(item.chapterId);
  deleteDownloads(ids);
  // Anything the index lost track of goes too, never anything outside `downloads/`.
  for (const name of listFileNames()) deleteFile(name);
  track("download_removed", { scope: "all" });
}

/**
 * Sign-out, after the queue has stopped (`stopped`) and the player has been
 * released: `downloads/` and everything in it. Never `Paths.document`
 * itself, where PostHog keeps its files. The index was cleared in memory
 * already; `clearUserScopedState()` removes its stored copy.
 */
export async function deleteDownloadFiles(stopped: Promise<void>): Promise<void> {
  await stopped;
  if (!downloadsAvailable()) return;
  try {
    deleteFolder();
  } catch (error) {
    // The next start deletes an index-less folder's files (`reconcileDownloads()`).
    log("sign-out could not delete downloads", error);
  }
}

// --- On start -----------------------------------------------------------

/**
 * The index and `downloads/` made to agree, for the signed-in `userId`, once
 * the index has rehydrated. Another account's index is wiped, with every
 * file: a sign-out that crashed halfway, or a device-to-device copy. An entry
 * whose file is missing is pruned; a file no entry lists is deleted.
 */
export function reconcileDownloads(userId: string): void {
  if (!downloadsAvailable() || isQueueBusy()) return;
  try {
    const plan = planReconcile(useDownloadsStore.getState(), userId, listFileNames());
    if (plan.wipe) {
      useDownloadsStore.getState().clear();
      deleteFolder();
      log("another account's downloads deleted", plan.prune.length, "chapters");
      return;
    }
    if (plan.prune.length > 0) useDownloadsStore.getState().remove(plan.prune);
    for (const name of plan.deleteFiles) deleteFile(name);
    if (plan.prune.length > 0 || plan.deleteFiles.length > 0) {
      log("reconciled: pruned", plan.prune, "deleted files", plan.deleteFiles);
    }
  } catch (error) {
    log("reconcile failed", error);
  }
}

// --- The online check ---------------------------------------------------

/**
 * The YouTube rule (prompt 24 step 8), for `chapterIds` or every download.
 * Online only, against `chapters_catalog`, the unlocks and the entitlement,
 * all fetched fresh. Only a definite answer changes anything:
 * - open by the lock rule: `verifiedAt` moves on, and a chapter whose
 *   `updated_at` moved is queued to fetch its changed parts again
 * - locked now, or gone from `chapters_catalog`: its files and entry go
 * Anything else (a failed fetch, offline, signed out meanwhile) changes
 * nothing.
 */
export async function verifyDownloads(userId: string, chapterIds?: readonly string[]): Promise<void> {
  if (!downloadsAvailable() || !onlineManager.isOnline()) return;
  const entries = downloadsFor(userId).filter(
    (entry) => chapterIds === undefined || chapterIds.includes(entry.chapterId),
  );
  if (entries.length === 0) return;

  const ids = entries.map((entry) => entry.chapterId);
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += IDS_PER_REQUEST) chunks.push(ids.slice(start, start + IDS_PER_REQUEST));

  let rows: DownloadRow[];
  let inputs: ChapterLockInputs;
  try {
    const [inputsAnswer, ...answers] = await Promise.all([
      freshLockInputs(userId),
      ...chunks.map((chunk) =>
        queryClient.fetchQuery({ ...downloadRowsByIdsOptions(chunk), staleTime: 0, retry: false }),
      ),
    ]);
    inputs = inputsAnswer;
    rows = answers.flat();
  } catch (error) {
    log("access check skipped: an input failed", error);
    return;
  }
  // Signed out, or another account, while it fetched.
  if (useDownloadsStore.getState().userId !== userId) return;

  const byId = new Map(rows.flatMap((row) => (row.id === null ? [] : [[row.id, row] as const])));
  const now = Date.now();
  const opened: string[] = [];
  const gone: string[] = [];
  for (const id of ids) {
    // The entry as it is now: removed or replaced while the check ran counts as it is now.
    const entry = useDownloadsStore.getState().chapters[id];
    if (entry === undefined) continue;
    const row = byId.get(id);
    const verdict = accessVerdict(entry, row, inputs);
    if (verdict === "delete") {
      gone.push(id);
      continue;
    }
    opened.push(id);
    if (verdict === "refresh" && row !== undefined) enqueueRefresh(userId, row, entry.book);
  }
  useDownloadsStore.getState().markVerified(opened, now);
  if (gone.length > 0) {
    log("access lost or chapter gone: deleting", gone);
    deleteDownloads(gone);
  }
}

/**
 * Every download, checked: on start, on a return to the foreground at most
 * once a day, and on reconnecting while a download is past its 30 days. One
 * at a time.
 */
export function verifyAllDownloads(userId: string, reason: "start" | "foreground" | "reconnect"): Promise<void> {
  const now = Date.now();
  if (reason === "foreground" && lastFullCheckAt !== null && now - lastFullCheckAt < RECHECK_INTERVAL_MS) {
    return Promise.resolve();
  }
  if (reason === "reconnect" && !downloadsFor(userId).some((entry) => !withinOfflineWindow(entry.verifiedAt, now))) {
    return Promise.resolve();
  }
  if (!onlineManager.isOnline()) return Promise.resolve();
  fullCheck ??= verifyDownloads(userId)
    .then(() => {
      lastFullCheckAt = Date.now();
    })
    .finally(() => {
      fullCheck = null;
    });
  return fullCheck;
}

/** Forgets this session's last check, at sign-out: the next account checks on its own start. */
export function resetDownloadChecks(): void {
  lastFullCheckAt = null;
}

/**
 * A catalog broadcast: downloads it names are checked at once, rather than
 * waiting for the next check. Named chapters; or, when the message names a
 * book with its chapters unlisted (`chapter_ids` null, too many to list) or
 * with none (a change to the book itself, published → draft included),
 * every download of that book. An unknown scope (null) waits for the start
 * and daily checks, which compare `updated_at` anyway.
 */
export function checkChangedDownloads(userId: string, change: CatalogChange | null): void {
  if (change === null) return;
  const ids = downloadsFor(userId)
    .filter((entry) => changeTouchesChapter(change, entry.chapterId, entry.book.id))
    .map((entry) => entry.chapterId);
  if (ids.length > 0) void verifyDownloads(userId, ids);
}
