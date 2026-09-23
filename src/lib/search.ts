// Pure M8 search helpers. No React, no hooks, no JSX — AGENTS.md § lib/.
import type { BookCatalogRow } from "@/types/catalog";

/** How long input must sit still before it becomes the query key (prompt 11 step 3). */
export const SEARCH_DEBOUNCE_MS = 300;

/** Trims and collapses inner whitespace — the form shown back to the user and kept in recent searches. */
export function tidySearchInput(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

/**
 * The form that is searched and cached. Lower-cased because `ilike` is
 * case-insensitive, so "Alpha" and "alpha" share one cache entry instead of
 * paying the ~450ms floor twice for the same rows.
 */
export function normalizeSearchTerm(input: string): string {
  return tidySearchInput(input).toLowerCase();
}

/**
 * M8's filter chips, in design order (material/4.png). The design's fifth
 * chip is cut off at "Co…" — its label is unreadable and nothing in
 * `books_catalog` could back a guess, so it is omitted rather than invented.
 */
export const SEARCH_FILTERS = [
  { value: "all", label: "All" },
  { value: "books", label: "Books" },
  { value: "audiobooks", label: "Audiobooks" },
  { value: "authors", label: "Authors" },
] as const;

export type SearchFilter = (typeof SEARCH_FILTERS)[number]["value"];

type FilterableRow = Pick<BookCatalogRow, "title" | "author" | "audio_count">;

/**
 * Narrows one term's results client-side, so switching chips never costs a
 * round trip and results stay cached per term alone:
 *   all        — every title or author match
 *   books      — the title matched
 *   audiobooks — the book has at least one narrated chapter
 *   authors    — the author matched
 */
export function filterSearchResults<Row extends FilterableRow>(
  rows: Row[],
  term: string,
  filter: SearchFilter,
): Row[] {
  const needle = normalizeSearchTerm(term);
  const matches = (value: string | null) =>
    value !== null && value.toLowerCase().includes(needle);

  switch (filter) {
    case "all":
      return rows;
    case "books":
      return rows.filter((row) => matches(row.title));
    case "audiobooks":
      return rows.filter((row) => (row.audio_count ?? 0) > 0);
    case "authors":
      return rows.filter((row) => matches(row.author));
  }
}
