import { useAuth } from "@clerk/expo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AccessibilityInfo } from "react-native";

import { withBookAdded, withBookRemoved } from "@/lib/library";
import {
  addToMyList,
  libraryItemsByUserOptions,
  removeFromMyList,
  type LibraryItem,
} from "@/lib/queries/library-items";
import { queryKeys } from "@/lib/query-keys";
import type { BookDetailRow } from "@/types/catalog";

type MyListChange = "add" | "remove";

export type MyListButton = {
  isOnList: boolean;
  toggle: () => void;
};

/**
 * M4's My List button: whether this book is on the list, and the change.
 * The one code that writes `library_items` (prompt 21 step 8).
 *
 * Optimistic: the list changes at once, and a server error puts it back and
 * says so to a screen reader. No alert, no toast, no spinner. Changes to one
 * book share a scope, so a fast add-then-remove runs in order. Offline,
 * TanStack pauses the change and sends it on reconnect; a paused change is
 * not persisted (`components/providers.tsx`), so closing the app first
 * drops it, and the next fetch corrects the list.
 *
 * Null hides the button: until the book and My List are both known, and
 * whenever My List fails to load. M4 shows no error for it.
 */
export function useMyList(bookId: string, book: BookDetailRow | null | undefined): MyListButton | null {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = queryKeys.libraryItems.byUser(userId ?? "");

  const list = useQuery({ ...libraryItemsByUserOptions(userId ?? ""), enabled: Boolean(userId) });

  const mutation = useMutation({
    // The list's own key: `onSettled` counts the changes still running by it.
    mutationKey: queryKey,
    scope: { id: `my-list:${bookId}` },
    mutationFn: (change: MyListChange) => (change === "add" ? addToMyList(bookId) : removeFromMyList(bookId)),
    onMutate: async (change) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LibraryItem[]>(queryKey);
      queryClient.setQueryData<LibraryItem[]>(queryKey, (items) => {
        if (items === undefined) return items;
        if (change === "remove") return withBookRemoved(items, bookId);
        if (!book) return items;
        return withBookAdded(items, {
          // Stands in until the refetch brings the real row.
          id: `pending:${bookId}`,
          book_id: bookId,
          created_at: new Date().toISOString(),
          book: {
            id: bookId,
            title: book.title,
            author: book.author,
            cover_path: book.cover_path,
            chapter_count: book.chapter_count,
            audio_count: book.audio_count,
          },
        });
      });
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context) queryClient.setQueryData(queryKey, context.previous);
      AccessibilityInfo.announceForAccessibility("Couldn't update My List");
    },
    onSettled: () => {
      // The last change to settle refetches. An earlier one would bring back
      // a list that lacks the change still running.
      if (queryClient.isMutating({ mutationKey: queryKey }) === 1) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });

  if (!userId || !book || list.data === undefined) return null;

  const isOnList = list.data.some((item) => item.book_id === bookId);
  return {
    isOnList,
    toggle: () => mutation.mutate(isOnList ? "remove" : "add"),
  };
}
