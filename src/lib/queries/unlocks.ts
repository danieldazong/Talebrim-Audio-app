import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { UnlockRow } from "@/types/reader";

export type Unlock = Pick<UnlockRow, "id" | "chapter_id" | "source" | "created_at">;

/**
 * Every chapter the signed-in reader has permanently unlocked (rewarded ad
 * or one-off purchase). Feeds `resolveChapterState()`'s `isUnlockedByUser`.
 * RLS scopes `unlocks` to the caller; `userId` keys the cache per account.
 *
 * Read only, and the app can never write here: the table grants readers
 * SELECT alone, so an unlock can only come from a server function after the
 * ad or purchase is verified (the paywall prompt). Subscription access is not
 * in this table — it comes from the RevenueCat entitlement at read time.
 */
export const unlocksByUserOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.unlocks.byUser(userId),
    queryFn: async (): Promise<Unlock[]> => {
      const { data, error } = await supabase
        .from("unlocks")
        .select("id, chapter_id, source, created_at");

      if (error) throw error;
      return data;
    },
  });
