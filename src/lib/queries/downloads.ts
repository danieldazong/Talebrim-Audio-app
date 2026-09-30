import { queryOptions } from "@tanstack/react-query";

import { readTextFile } from "@/lib/downloads/files";
import { textFileName } from "@/lib/downloads/rules";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { ChapterCatalogRow } from "@/types/catalog";

/**
 * A chapter as a download needs it: M9's columns, plus `book_id`,
 * `updated_at` (to notice an edit since) and the two sizes the
 * `chapters_catalog` view gained for downloads (dashboard migration
 * `20260928150000`). Never `script_text`.
 */
export type DownloadRow = Pick<
  ChapterCatalogRow,
  | "id"
  | "book_id"
  | "number"
  | "title"
  | "access"
  | "has_text"
  | "has_audio"
  | "audio_duration_seconds"
  | "updated_at"
  | "audio_size_bytes"
  | "text_bytes"
>;

const DOWNLOAD_COLUMNS =
  "id, book_id, number, title, access, has_text, has_audio, audio_duration_seconds, updated_at, audio_size_bytes, text_bytes";

/**
 * Every chapter of one book with its sizes, oldest first: what "Download
 * all" confirms and queues, and what one row's "Download chapter" queues.
 * Its own query, so M9's `chapterListByBookOptions()` keeps its explicit
 * columns. Callers fetch it fresh (`staleTime: 0`).
 */
export const downloadRowsByBookOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.downloads.rowsByBook(bookId),
    queryFn: async (): Promise<DownloadRow[]> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select(DOWNLOAD_COLUMNS)
        .eq("book_id", bookId)
        .order("number", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

/**
 * The downloaded chapters' rows, by id: the online access check's one query
 * (prompt 24 step 8). A chapter missing from the answer is unpublished or
 * deleted. `.in()` never returns more rows than it names, so PostgREST's row
 * cap can't make a present chapter look missing.
 */
export const downloadRowsByIdsOptions = (chapterIds: readonly string[]) =>
  queryOptions({
    queryKey: queryKeys.downloads.rowsByIds(chapterIds),
    queryFn: async (): Promise<DownloadRow[]> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select(DOWNLOAD_COLUMNS)
        .in("id", [...chapterIds]);

      if (error) throw error;
      return data;
    },
  });

/**
 * A downloaded chapter's text, from its file: M5 reads it with no network
 * wait, online or off. `networkMode: "always"`, because nothing here uses the
 * network, so TanStack must never pause it offline. Never persisted: the
 * whole `downloads` root is left out (`shouldPersistQuery()`), and it lives
 * in memory only briefly, since the file is always there to read again.
 */
export const downloadedTextOptions = (userId: string, chapterId: string) =>
  queryOptions({
    queryKey: queryKeys.downloads.text(userId, chapterId),
    queryFn: () => readTextFile(textFileName(chapterId)),
    networkMode: "always",
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
