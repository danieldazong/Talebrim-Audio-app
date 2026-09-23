// Live catalog updates — the app side of dashboard migration
// 20260923000002_catalog_change_broadcast. No React, no hooks — AGENTS.md
// § lib/. The subscription itself lives in `hooks/use-catalog-sync.ts`.
//
// After any save that touches a published book or its chapters, the database
// broadcasts `{ book_ids, chapter_ids }` on a private Realtime topic. The
// message carries ids, never content: it only says what went stale, and the
// app refetches through its normal RLS-checked queries.
import type { QueryClient, QueryKey } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

/** Receive-only for signed-in users; no client can send on it. */
export const CATALOG_TOPIC = "catalog";
export const CATALOG_CHANGED_EVENT = "catalog_changed";

/**
 * Which published books, and which of their chapters, just changed.
 * `chapterIds: null` means too many to list — treat every chapter as changed.
 */
export type CatalogChange = {
  bookIds: string[];
  chapterIds: string[] | null;
};

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

/** Reads a broadcast payload. Anything malformed returns null — callers treat that as "refresh everything". */
export function parseCatalogChange(payload: unknown): CatalogChange | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { book_ids: bookIds, chapter_ids: chapterIds } = payload as Record<string, unknown>;
  if (!isIdList(bookIds)) return null;
  if (chapterIds !== null && !isIdList(chapterIds)) return null;
  return { bookIds, chapterIds };
}

/** Folds a burst of changes (bulk import, a multi-step save) into one. */
export function mergeCatalogChanges(a: CatalogChange, b: CatalogChange): CatalogChange {
  return {
    bookIds: [...new Set([...a.bookIds, ...b.bookIds])],
    chapterIds:
      a.chapterIds === null || b.chapterIds === null
        ? null
        : [...new Set([...a.chapterIds, ...b.chapterIds])],
  };
}

/**
 * Marks everything a change could affect as stale: queries on screen refetch
 * now, the rest when their screen next mounts. Lists and search always go —
 * a title, cover or chapter count can appear in any of them.
 *
 * `null` means the scope is unknown (events may have been missed while
 * unsubscribed), so everything catalog-derived is refreshed, settings too.
 */
export async function invalidateCatalog(
  queryClient: QueryClient,
  change: CatalogChange | null,
): Promise<void> {
  const keys: QueryKey[] = [queryKeys.catalog.all(), queryKeys.search.all()];

  if (change === null) {
    keys.push(queryKeys.book.all(), queryKeys.chapters.all(), queryKeys.appSettings.all());
  } else {
    for (const bookId of change.bookIds) {
      keys.push(queryKeys.book.detail(bookId), queryKeys.chapters.listByBook(bookId));
    }
    if (change.chapterIds === null) {
      keys.push(queryKeys.chapters.textAll());
    } else {
      for (const chapterId of change.chapterIds) {
        keys.push(queryKeys.chapters.text(chapterId));
      }
    }
  }

  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
