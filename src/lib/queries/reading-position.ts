import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { ChapterCatalogRow } from "@/types/catalog";
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
 * M4's Read and M9's Reading Now use it. Library's Continue card spans every
 * book, so it reads `recentPositionsOptions()` instead.
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

/** How many of the reader's newest positions Library reads: the Continue card and the grid lines. */
export const RECENT_POSITIONS_LIMIT = 100;

/**
 * The position's columns plus its chapter from `chapters_catalog`, never
 * `script_text`. `!inner` drops a position whose chapter the view hides: a
 * chapter of an unpublished book. The chapter's audio length gives the
 * Listening card its time left.
 */
const RECENT_POSITION_COLUMNS =
  `${READING_POSITION_COLUMNS}, chapter:chapters_catalog!inner(number, access, has_text, has_audio, audio_duration_seconds)` as const;

export type RecentPosition = ReadingPosition & {
  chapter: Pick<ChapterCatalogRow, "number" | "access" | "has_text" | "has_audio" | "audio_duration_seconds">;
};

/**
 * The reader's newest positions across every book, newest first by the
 * server's `updated_at`, in one request. The `(user_id, updated_at desc)`
 * index serves it; RLS supplies the `user_id`.
 *
 * Library reads it for its Continue card (the newest row, or the newest
 * listened to) and for each grid book's progress line (that book's newest
 * row). The parity writer marks it stale after every row it saves, without
 * fetching; M7 refetches it when it gains focus.
 */
export const recentPositionsOptions = (userId: string) =>
  queryOptions({
    queryKey: queryKeys.readingPosition.recent(userId),
    queryFn: async (): Promise<RecentPosition[]> => {
      const { data, error } = await supabase
        .from("reading_positions")
        .select(RECENT_POSITION_COLUMNS)
        .order("updated_at", { ascending: false })
        .limit(RECENT_POSITIONS_LIMIT);

      if (error) throw error;
      return data;
    },
  });
