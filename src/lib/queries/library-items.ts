import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { BookCatalogRow } from "@/types/catalog";
import type { LibraryItemRow } from "@/types/reader";

/** The book columns My List's grid renders, from `books_catalog`. */
export type LibraryBook = Pick<
  BookCatalogRow,
  "id" | "title" | "author" | "cover_path" | "chapter_count" | "audio_count"
>;

export type LibraryItem = Pick<LibraryItemRow, "id" | "book_id" | "created_at"> & {
  book: LibraryBook;
};

/**
 * Each item with its book embedded, in one request. `!inner` drops a book
 * the view hides (unpublished); a deleted book's rows cascade away. Never
 * `books`, and never a query per book.
 */
const LIBRARY_ITEM_COLUMNS =
  "id, book_id, created_at, book:books_catalog!inner(id, title, author, cover_path, chapter_count, audio_count)";

/**
 * The signed-in reader's My List (M7), newest first — there is no order
 * column by design. RLS scopes `library_items` to the caller; `userId` keys
 * the cache per account.
 */
export const libraryItemsByUserOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.libraryItems.byUser(userId),
    queryFn: async (): Promise<LibraryItem[]> => {
      const { data, error } = await supabase
        .from("library_items")
        .select(LIBRARY_ITEM_COLUMNS)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

/**
 * Puts a book on My List. `ON CONFLICT DO NOTHING` on
 * `library_items_user_book_key`, so a repeated add is a no-op, never a
 * duplicate or an error. `user_id` is never sent: the column defaults to the
 * caller's `sub`, and the insert policy checks it.
 */
export async function addToMyList(bookId: string): Promise<void> {
  const { error } = await supabase
    .from("library_items")
    .upsert({ book_id: bookId }, { onConflict: "user_id,book_id", ignoreDuplicates: true });

  if (error) throw error;
}

/** Takes a book off My List. RLS scopes the delete to the caller's own row. */
export async function removeFromMyList(bookId: string): Promise<void> {
  const { error } = await supabase.from("library_items").delete().eq("book_id", bookId);

  if (error) throw error;
}
