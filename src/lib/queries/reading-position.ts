import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { ReadingPositionRow } from "@/types/reader";

export type ReadingPosition = Pick<
  ReadingPositionRow,
  "id" | "chapter_id" | "book_id" | "audio_ms" | "text_offset" | "last_mode" | "updated_at"
>;

/** Exactly the `ReadingPosition` columns — shared with the writer's upsert. */
export const READING_POSITION_COLUMNS =
  "id, chapter_id, book_id, audio_ms, text_offset, last_mode, updated_at";

/**
 * The signed-in reader's server-side position in one chapter, or `null` if
 * they have none yet. RLS scopes `reading_positions` to the caller, so this
 * can never return another reader's row; `userId` keys the cache per account.
 *
 * Read only here. The one writer is `lib/parity/writer.ts`, which also puts
 * each row it writes into this key.
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
        .select(READING_POSITION_COLUMNS)
        .eq("chapter_id", chapterId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

/**
 * Where the reader left off in one book: their most recent position in it,
 * by the server's `updated_at`, or `null` if they have never opened it. The
 * `(user_id, book_id, updated_at desc)` index serves it; RLS supplies the
 * `user_id`. `last_mode` says whether they were reading or listening.
 *
 * M4's Read uses it, and Library's "continue reading" reuses it rather than
 * writing its own query.
 */
export const resumeTargetOptions = (userId: string, bookId: string) =>
  queryOptions({
    queryKey: queryKeys.readingPosition.resumeByBook(userId, bookId),
    queryFn: async (): Promise<ReadingPosition | null> => {
      const { data, error } = await supabase
        .from("reading_positions")
        .select(READING_POSITION_COLUMNS)
        .eq("book_id", bookId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
