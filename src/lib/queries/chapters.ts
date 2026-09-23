import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type {
  ChapterCatalogRow,
  ChapterPreviewRow,
  ChapterTargetRow,
} from "@/types/catalog";

/** How many chapters M4 previews before "See all chapters". */
export const PREVIEW_CHAPTER_LIMIT = 5;

/**
 * Chapter metadata for one book (M4 preview, M9 full list). Reads
 * `chapters_catalog` — `has_audio`/`has_text` booleans, no `script_text`.
 * Never `chapters_list` or `chapters_needing_attention` (admin-only) and
 * never `chapters` directly.
 */
export const chapterListByBookOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.listByBook(bookId),
    queryFn: async (): Promise<ChapterCatalogRow[]> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select("*")
        .eq("book_id", bookId)
        .order("number", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

/**
 * M4's preview: the book's first `PREVIEW_CHAPTER_LIMIT` chapters, from
 * chapter 1. Keyed under `listByBook` but never AS it — see
 * `queryKeys.chapters.preview`.
 */
export const chapterPreviewOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.preview(bookId),
    queryFn: async (): Promise<ChapterPreviewRow[]> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select("id, number, title, access, has_audio, audio_duration_seconds")
        .eq("book_id", bookId)
        .order("number", { ascending: true })
        .limit(PREVIEW_CHAPTER_LIMIT);

      if (error) throw error;
      return data;
    },
  });

/**
 * The first chapter that has audio — M4's Listen target. Its own query
 * because it can sit past the preview rows. `null` when no chapter has
 * audio; callers only run it for a book whose `audio_count > 0`.
 */
export const firstAudioChapterOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.firstAudio(bookId),
    queryFn: async (): Promise<ChapterTargetRow | null> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select("id, number, access")
        .eq("book_id", bookId)
        .eq("has_audio", true)
        .order("number", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

/**
 * Prose for exactly one chapter. Deliberately its own query, keyed per
 * chapter id, never folded into the list query above — `script_text` is
 * large and serials run 85–200 chapters (AGENTS.md step 8).
 *
 * FLAGGED DEVIATION from prompt 03 step 4 ("reader-facing reads go only to
 * books_catalog and chapters_catalog"): `chapters_catalog` omits
 * `script_text` by construction (AGENTS.md Data Contract), and no
 * reader-facing view carries prose. Step 8 requires this query to exist, so
 * this is the one place in the data layer that reads the base `chapters`
 * table instead of a catalog view — a single row by id, not a list scan,
 * still enforced by RLS. Resolving the gap properly (a `chapters_prose` or
 * similar view) is future migration work, not something this prompt can do
 * (it forbids writing SQL) — reported as a blocker in the final summary.
 *
 * `script_text` is expected to contain exactly three Markdown marks —
 * `**bold**`, `_italic_`, `## heading` — and nothing else; the reader
 * (prompt 16) relies on that and must not assume full Markdown.
 *
 * Live: `hooks/use-catalog-sync.ts` invalidates this when the dashboard
 * saves the script, so an open reader receives new text mid-chapter. M5
 * must decide how to apply it without jumping the reader's position.
 */
export const chapterTextOptions = (chapterId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.text(chapterId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("chapters")
        .select("script_text")
        .eq("id", chapterId)
        .single();

      if (error) throw error;
      return data.script_text;
    },
  });
