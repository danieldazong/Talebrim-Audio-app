import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { ReadingPositionRow } from "@/types/reader";

export type ReadingPosition = Pick<
  ReadingPositionRow,
  "id" | "chapter_id" | "book_id" | "audio_ms" | "text_offset" | "last_mode" | "updated_at"
>;

/**
 * The signed-in reader's server-side position in one chapter, or `null` if
 * they have none yet. RLS scopes `reading_positions` to the caller, so this
 * can never return another reader's row; `userId` keys the cache per account.
 *
 * Read only. The writer — debounced, last-write-wins against the server
 * timestamp — belongs to the parity prompt (AGENTS.md § Read/listen parity).
 */
export const readingPositionByChapterOptions = (
  userId: string,
  chapterId: string,
) =>
  queryOptions({
    queryKey: queryKeys.readingPosition.byChapter(userId, chapterId),
    queryFn: async (): Promise<ReadingPosition | null> => {
      const { data, error } = await supabase
        .from("reading_positions")
        .select("id, chapter_id, book_id, audio_ms, text_offset, last_mode, updated_at")
        .eq("chapter_id", chapterId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
