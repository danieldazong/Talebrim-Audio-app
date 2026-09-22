// TanStack Query key factory — single source for every query key in the
// app. Hierarchical so a prefix invalidates its children:
// https://tanstack.com/query/latest/docs/framework/react/guides/query-keys
//
// Every user-scoped key includes the Clerk user id as a segment so the
// AsyncStorage-persisted cache (lib/query-client.ts) can never leak one
// account's rows into another's restored session — same discipline as
// `queryCacheKey()` there.
//
// No React, no hooks, no JSX — AGENTS.md § lib/.
import type { Genre } from "@/data/genres";

export const queryKeys = {
  catalog: {
    all: () => ["catalog"] as const,
    /** Published books for a genre tab/filter. `genre: null` means the unfiltered "Discover" list. */
    byGenre: (genre: Genre | null) =>
      [...queryKeys.catalog.all(), "byGenre", genre] as const,
    // NO BACKING METRIC — there is no view-counts or reads table behind a
    // "trending" ranking (AGENTS.md Data Contract). Key reserved so callers
    // that need it later invalidate correctly; no fetcher exists for it.
    trending: () => [...queryKeys.catalog.all(), "trending"] as const,
  },

  book: {
    all: () => ["book"] as const,
    /** Single `books_catalog` row. */
    detail: (bookId: string) =>
      [...queryKeys.book.all(), "detail", bookId] as const,
  },

  chapters: {
    all: () => ["chapters"] as const,
    /** `chapters_catalog` rows for one book — metadata only, no text. */
    listByBook: (bookId: string) =>
      [...queryKeys.chapters.all(), "listByBook", bookId] as const,
    /**
     * `chapters.script_text` for exactly one chapter. Kept out of
     * `listByBook` deliberately — chapter text is large and serials run
     * 85–200 chapters, so it must never ride along with a list fetch.
     */
    text: (chapterId: string) =>
      [...queryKeys.chapters.all(), "text", chapterId] as const,
  },

  search: {
    all: () => ["search"] as const,
    byTerm: (term: string) => [...queryKeys.search.all(), "byTerm", term] as const,
  },

  appSettings: {
    all: () => ["appSettings"] as const,
  },

  // --- User-scoped: Clerk user id is always the leading segment below the
  // domain, per AGENTS.md step 7's leak-prevention requirement. ---

  readingPosition: {
    all: (userId: string) => ["readingPosition", userId] as const,
    /** UNBACKED (types/unbacked.ts) — no `reading_positions` table until prompt 14. */
    byChapter: (userId: string, chapterId: string) =>
      [...queryKeys.readingPosition.all(userId), "byChapter", chapterId] as const,
  },

  unlocks: {
    /** UNBACKED (types/unbacked.ts) — no `unlocks` table until prompt 14. */
    byUser: (userId: string) => ["unlocks", userId] as const,
  },

  libraryItems: {
    /** UNBACKED (types/unbacked.ts) — no `library_items` table until prompt 14. */
    byUser: (userId: string) => ["libraryItems", userId] as const,
  },
} as const;
