import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import type { UnlockRow } from "@/types/unbacked";

// UNBACKED: no table until prompt 14
/**
 * STUB — `unlocks` does not exist yet (types/unbacked.ts). Do not wire this
 * into a screen. `queryFn` throws on purpose so an accidental render fails
 * loudly instead of showing every chapter as locked.
 */
export const unlocksByUserOptions = (userId: string) =>
  queryOptions<UnlockRow[]>({
    queryKey: queryKeys.unlocks.byUser(userId),
    queryFn: async () => {
      throw new Error("UNBACKED: unlocks table does not exist until prompt 14");
    },
    enabled: false,
  });
