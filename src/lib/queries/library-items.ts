import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { LibraryItemRow } from "@/types/reader";

export type LibraryItem = Pick<LibraryItemRow, "id" | "book_id" | "created_at">;

/**
 * The signed-in reader's My List (M7), newest first — there is no order
 * column by design. RLS scopes `library_items` to the caller; `userId` keys
 * the cache per account. Read only: adding and removing belong to the screens
 * that need them.
 */
export const libraryItemsByUserOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.libraryItems.byUser(userId),
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase
        .from("library_items")
        .select("id, book_id, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
