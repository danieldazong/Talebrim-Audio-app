import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { normalizeSearchTerm } from "@/lib/search";
import { supabase } from "@/lib/supabase";
import type { SearchBookRow } from "@/types/catalog";

/**
 * Exactly what an M8 result row renders — never `select('*')`. Both `title`
 * and `author` are confirmed columns on the `books_catalog` view in
 * `types/database.ts`; `script_text` is not on the view at all.
 */
const SEARCH_COLUMNS =
  "id, title, author, cover_path, chapter_count, audio_count, total_duration_seconds";

/**
 * Rows shown per term. The design shows no pagination, so there is none —
 * one extra row is fetched only to tell "exactly 50" from "more than 50".
 */
export const SEARCH_RESULT_LIMIT = 50;

export type SearchResults = {
  rows: SearchBookRow[];
  /** More rows matched than `SEARCH_RESULT_LIMIT`. */
  hasMore: boolean;
};

/**
 * Turns a search term into a quoted `ilike` operand that is safe inside
 * PostgREST's `or()` filter:
 *
 * 1. LIKE wildcards in the term become literals: `\` → `\\`, `%` → `\%`,
 *    `_` → `\_` (backslash is Postgres LIKE's default escape character).
 * 2. `*` → `_`. PostgREST rewrites every `*` in a like/ilike operand to `%`
 *    and has no escape for it, so a literal `*` can only be approximated by
 *    the one-character wildcard — widening one position, never unbounded.
 * 3. The pattern is double-quoted with `\` and `"` backslash-escaped, so a
 *    `,` `.` `:` `(` or `)` in the term is data rather than `or()` syntax.
 *
 * https://docs.postgrest.org/en/stable/references/api/tables_views.html#reserved-characters
 */
function toIlikeOperand(term: string): string {
  const literal = term.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "_");
  return `"${`%${literal}%`.replace(/[\\"]/g, "\\$&")}"`;
}

/**
 * M8 search: title OR author, case-insensitive. Reads `books_catalog`
 * (published-only by construction), never `books` — same rule as every
 * other catalog read.
 *
 * Callers pass the DEBOUNCED input; the term is normalised here so the key
 * and the query can never disagree. `signal` is handed to supabase-js, so
 * TanStack Query aborts the request when the term changes or the screen
 * unmounts instead of letting stale requests queue behind the ~450ms floor.
 */
export const searchByTermOptions = (input: string) => {
  const term = normalizeSearchTerm(input);

  return queryOptions({
    queryKey: queryKeys.search.byTerm(term),
    queryFn: async ({ signal }): Promise<SearchResults> => {
      const operand = toIlikeOperand(term);
      const { data, error } = await supabase
        .from("books_catalog")
        .select(SEARCH_COLUMNS)
        .or(`title.ilike.${operand},author.ilike.${operand}`)
        .order("title", { ascending: true })
        .limit(SEARCH_RESULT_LIMIT + 1)
        .abortSignal(signal);

      if (error) throw error;
      return {
        rows: data.slice(0, SEARCH_RESULT_LIMIT),
        hasMore: data.length > SEARCH_RESULT_LIMIT,
      };
    },
    enabled: term.length > 0,
  });
};
