import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { BookCatalogRow } from "@/types/catalog";

/**
 * M8 search. Reads `books_catalog` (published-only, by construction), never
 * `books` — same rule as every other catalog read.
 */
export const searchByTermOptions = (term: string) =>
  queryOptions({
    queryKey: queryKeys.search.byTerm(term),
    queryFn: async (): Promise<BookCatalogRow[]> => {
      const trimmed = term.trim();
      if (!trimmed) return [];

      const { data, error } = await supabase
        .from("books_catalog")
        .select("*")
        .or(`title.ilike.%${trimmed}%,author.ilike.%${trimmed}%`);

      if (error) throw error;
      return data;
    },
    // Empty term short-circuits above; still gate the query itself so
    // callers don't need to duplicate the empty-string check.
    enabled: term.trim().length > 0,
  });
