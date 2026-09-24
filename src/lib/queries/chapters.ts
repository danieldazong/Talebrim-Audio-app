import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type {
  ChapterCatalogRow,
  ChapterDetailRow,
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
 * One chapter's metadata for M5 — its number, title, lock inputs, whether it
 * has text, and the narration's duration that parity maps positions against
 * (`lib/parity/convert.ts`). `null` means not available to this reader:
 * missing, unpublished, or hidden by RLS (`.maybeSingle()`, as
 * `bookDetailOptions()` explains). Callers must not pass a malformed id
 * (`isUuid()`).
 *
 * Invalidated per chapter by catalog sync, so a title edited in the
 * dashboard reaches an open reader.
 */
export const chapterDetailOptions = (chapterId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.detail(chapterId),
    queryFn: async (): Promise<ChapterDetailRow | null> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select("id, book_id, number, title, access, has_text, has_audio, audio_duration_seconds")
        .eq("id", chapterId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

export type ChapterNeighbours = {
  previous: ChapterTargetRow | null;
  next: ChapterTargetRow | null;
};

/**
 * The chapters either side of `number` in one book — M5's end-of-chapter
 * navigation and next-chapter prefetch. Numbers can have gaps, so these are
 * the nearest numbers below and above, never n ± 1. Two one-row requests in
 * parallel rather than M9's full list.
 */
export const chapterNeighboursOptions = (bookId: string, number: number) =>
  queryOptions({
    queryKey: queryKeys.chapters.neighbours(bookId, number),
    queryFn: async (): Promise<ChapterNeighbours> => {
      const [previous, next] = await Promise.all([
        supabase
          .from("chapters_catalog")
          .select("id, number, access")
          .eq("book_id", bookId)
          .lt("number", number)
          .order("number", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("chapters_catalog")
          .select("id, number, access")
          .eq("book_id", bookId)
          .gt("number", number)
          .order("number", { ascending: true })
          .limit(1)
          .maybeSingle(),
      ]);

      if (previous.error) throw previous.error;
      if (next.error) throw next.error;
      return { previous: previous.data, next: next.data };
    },
  });

/**
 * The book's highest chapter number — the "of M" in M5's position label.
 * Not `chapter_count`: with gaps (chapters 1, 2 and 5), the count would make
 * chapter 5 read "5 of 3". Book-level, so cached once for every chapter.
 */
export const lastChapterNumberOptions = (bookId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.lastNumber(bookId),
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from("chapters_catalog")
        .select("number")
        .eq("book_id", bookId)
        // Descending puts nulls first in Postgres; the view types `number` as nullable.
        .order("number", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.number ?? null;
    },
  });

/**
 * Prose for exactly one chapter — M5 Reader (prompts 14–15). Its own query,
 * keyed per chapter id, and never folded into a list: `script_text` is large
 * and a serial runs 85–200 chapters.
 *
 * The one sanctioned direct read of `chapters` (AGENTS.md Data Contract):
 * `chapters_catalog` omits `script_text` by design, and no reader-facing
 * view carries prose. A single row by id, still under RLS. Callers enable it
 * only after `chapterDetailOptions()` has returned the same chapter, which
 * proves it is published, and only when the chapter does not resolve to
 * locked.
 *
 * `script_text` is expected to contain exactly three Markdown marks —
 * `**bold**`, `_italic_`, `## heading`. `lib/chapter-text.ts` parses those
 * and renders anything else literally; it never assumes full Markdown.
 *
 * Live edits: catalog sync invalidates this when the dashboard saves the
 * script, and an open reader refetches it. The reader keeps the first text
 * it received for as long as it stays mounted and ignores later data, so the
 * text never moves under the reader; the refreshed text shows on the next
 * open. The chapter's title (`chapterDetailOptions()`) still updates live.
 *
 * 24-hour `staleTime`: re-opening a chapter read today paints from cache
 * with no request. Safe because catalog sync invalidates the text the moment
 * the dashboard saves it. `gcTime` and the persister's `maxAge` stay at the
 * app's 24 hours (`lib/query-client.ts`): the persisted cache is one
 * AsyncStorage value for every query, so longer-lived text would grow it for
 * the whole app. Long-term offline text belongs to the downloads prompt.
 */
export const chapterTextOptions = (chapterId: string) =>
  queryOptions({
    queryKey: queryKeys.chapters.text(chapterId),
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("chapters")
        .select("script_text")
        .eq("id", chapterId)
        .maybeSingle();

      if (error) throw error;
      return data?.script_text ?? null;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });
