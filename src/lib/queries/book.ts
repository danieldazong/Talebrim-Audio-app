import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { BookDetailRow } from "@/types/catalog";

/** Exactly what M4's header renders — never `select('*')`. */
const BOOK_DETAIL_COLUMNS =
  "id, title, author, synopsis, short_description, genres, maturity, cover_path, chapter_count, audio_count, total_duration_seconds";

/**
 * Single book for M4 Story Detail. Reads `books_catalog`, never `books` —
 * same published-only, pre-aggregated view as the list query
 * (AGENTS.md Data Contract).
 *
 * `null` means "not available to this reader": unpublished, deleted, or
 * hidden by RLS. `.maybeSingle()` returns that as a row of nothing; `.single()`
 * would turn it into an error and show a retry for a book that will never
 * load. Callers must not pass a malformed id — PostgREST errors on one
 * instead of returning zero rows (see `isUuid()`).
 */
export const bookDetailOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.book.detail(bookId),
    queryFn: async (): Promise<BookDetailRow | null> => {
      const { data, error } = await supabase
        .from("books_catalog")
        .select(BOOK_DETAIL_COLUMNS)
        .eq("id", bookId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
