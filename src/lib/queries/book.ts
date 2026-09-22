import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { BookCatalogRow } from "@/types/catalog";

/**
 * Single book for M4 Story Detail. Reads `books_catalog`, never `books` —
 * same published-only, pre-aggregated view as the list query
 * (AGENTS.md Data Contract).
 */
export const bookDetailOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.book.detail(bookId),
    queryFn: async (): Promise<BookCatalogRow> => {
      const { data, error } = await supabase
        .from("books_catalog")
        .select("*")
        .eq("id", bookId)
        .single();

      if (error) throw error;
      return data;
    },
  });
