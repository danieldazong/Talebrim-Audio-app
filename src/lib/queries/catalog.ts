import { queryOptions } from "@tanstack/react-query";

import type { Genre } from "@/data/genres";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { BookCatalogRow } from "@/types/catalog";

/**
 * Published books, optionally filtered to one genre chip.
 *
 * Reads `books_catalog` only (never `books`) — the view already filters
 * `status = 'published'` by construction and pre-computes chapter/audio
 * counts, which is what makes this a single query instead of an N+1
 * (AGENTS.md Data Contract).
 */
export const catalogByGenreOptions = (genre: Genre | null) =>
  queryOptions({
    queryKey: queryKeys.catalog.byGenre(genre),
    queryFn: async (): Promise<BookCatalogRow[]> => {
      let query = supabase.from("books_catalog").select("*");

      if (genre) {
        query = query.contains("genres", [genre]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

// NO BACKING METRIC — `queryKeys.catalog.trending()` exists for future
// invalidation but has no fetcher here. There is no view-counts or reads
// table to rank by (AGENTS.md Data Contract); inventing one is explicitly
// out of scope for this prompt.
