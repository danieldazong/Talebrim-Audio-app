import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import { UPDATES_WINDOW_MS } from "@/lib/updates";
import type { ChapterCatalogRow } from "@/types/catalog";

/** The columns the Updates inbox renders and checks the lock with. */
export type UpdateRow = Pick<
  ChapterCatalogRow,
  "id" | "book_id" | "number" | "title" | "access" | "has_text" | "has_audio" | "created_at"
>;

const UPDATE_COLUMNS = "id, book_id, number, title, access, has_text, has_audio, created_at";

/** At most this many rows: a month of chapters across a reader's whole My List. */
const UPDATES_LIMIT = 100;

/**
 * The newest chapters of the books on the reader's My List, added in the
 * last 30 days, newest first. One request for every book, through
 * `chapters_catalog`, so drafts never appear. Keyed by the account and the
 * books, so a change to My List fetches again; catalog sync invalidates
 * `updates.all(userId)` on every catalog change, so a new chapter shows at
 * once (`lib/catalog-sync.ts`).
 */
export const updatesOptions = (userId: string, bookIds: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.updates.byBooks(userId, bookIds),
    queryFn: async (): Promise<UpdateRow[]> => {
      if (bookIds.length === 0) return [];
      const since = new Date(Date.now() - UPDATES_WINDOW_MS).toISOString();
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select(UPDATE_COLUMNS)
        .in("book_id", [...bookIds])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(UPDATES_LIMIT);

      if (error) throw error;
      return data;
    },
  });
