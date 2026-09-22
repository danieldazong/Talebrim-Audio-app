import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { LibraryItemRow } from "@/types/unbacked";

// UNBACKED: no table until prompt 14
/**
 * STUB — `library_items` does not exist yet (types/unbacked.ts). Do not
 * wire this into a screen. `queryFn` throws on purpose so an accidental
 * render fails loudly instead of showing an empty "My List" as authoritative.
 */
export const libraryItemsByUserOptions = (userId: string) =>
  queryOptions<LibraryItemRow[]>({
    queryKey: queryKeys.libraryItems.byUser(userId),
    queryFn: async () => {
      throw new Error(
        "UNBACKED: library_items table does not exist until prompt 14",
      );
    },
    enabled: false,
  });
