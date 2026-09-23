import { queryOptions } from "@tanstack/react-query";

import type { Genre } from "@/data/genres";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import type { CarouselBookRow } from "@/types/catalog";

/**
 * Columns every M3 carousel needs. Explicit, never `select('*')` — serials
 * run 85–200 chapters and the catalogue will grow, so a list screen must not
 * pull columns it doesn't render (prompt 11 step 2). `script_text` is not a
 * `books_catalog` column at all — the view never carries prose.
 */
const CAROUSEL_COLUMNS =
  "id, title, author, genres, cover_path, chapter_count, audio_count, free_chapter_count, total_duration_seconds, created_at, updated_at";

/** Every carousel/tab-strip query on this screen is capped — a list screen never needs an unbounded select. */
const CAROUSEL_LIMIT = 20;

/**
 * Published books for one M3 tab-strip entry ("Discover", "New", or a genre
 * tab). `tab` keys the query separately from `genre` because "Discover" and
 * "New" both pass `genre: null` but must not share a cache entry (prompt 11
 * step 9); both currently return the same newest-first list — "New" has no
 * distinct backing signal beyond `created_at desc`, which is already this
 * query's default order, so there is nothing further to filter on.
 *
 * Reads `books_catalog` only (never `books`) — the view already filters
 * `status = 'published'` by construction and pre-computes chapter/audio
 * counts, which is what makes this a single query instead of an N+1
 * (AGENTS.md Data Contract).
 */
export const catalogByTabOptions = (tab: string, genre: Genre | null) =>
  queryOptions({
    queryKey: queryKeys.catalog.byTab(tab, genre),
    queryFn: async (): Promise<CarouselBookRow[]> => {
      let query = supabase
        .from("books_catalog")
        .select(CAROUSEL_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(CAROUSEL_LIMIT);

      if (genre) {
        query = query.contains("genres", [genre]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

/**
 * "Picked for You" — filters `books_catalog.genres` by the reader's
 * onboarding selection using the containment operator (`@>` via
 * `.contains()`) so the `books` GIN index on `genres` serves it as a bitmap
 * index scan rather than a sequential scan
 * (https://www.postgresql.org/docs/current/gin.html).
 *
 * `genres: []` — the Skip path from prompt 07 is a valid completed onboarding
 * state — falls back to the unfiltered recent catalogue instead of an empty
 * containment filter (`.contains('genres', [])` matches everything in
 * Postgres anyway, but relying on that would be an accident of the operator,
 * not a stated fallback) (prompt 11 step 4).
 */
export const pickedForYouOptions = (genres: Genre[]) =>
  queryOptions({
    queryKey: queryKeys.catalog.pickedForYou(genres),
    queryFn: async (): Promise<CarouselBookRow[]> => {
      let query = supabase
        .from("books_catalog")
        .select(CAROUSEL_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(CAROUSEL_LIMIT);

      if (genres.length > 0) {
        query = query.contains("genres", genres);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

// NO BACKING METRIC — `queryKeys.catalog.trending()` exists for future
// invalidation but has no fetcher here. There is no view-counts or reads
// table to rank by (AGENTS.md Data Contract); inventing one is explicitly
// out of scope for this prompt. The screen renders this section's empty
// state rather than a fake ranking — see app/(tabs)/index.tsx.

/**
 * "New Audio Releases" — published books with at least one audio chapter,
 * ordered by `updated_at`.
 *
 * `created_at` is when the book row was first published, which can predate
 * audio entirely (a text-only book that later gains narration keeps its
 * original `created_at`). `updated_at` moves when the row changes — the
 * dashboard bumps it on any edit, including attaching audio — so it tracks
 * "most recently became an audio release" far closer than "when the book was
 * first added" does. Ordering by `created_at` here would surface old
 * text-only-at-launch books that just got audio behind newer text-only
 * books, which is the opposite of what this section promises (prompt 11
 * step 6).
 */
export const newAudioReleasesOptions = () =>
  queryOptions({
    queryKey: queryKeys.catalog.newAudioReleases(),
    queryFn: async (): Promise<CarouselBookRow[]> => {
      const { data, error } = await supabase
        .from("books_catalog")
        .select(CAROUSEL_COLUMNS)
        .gt("audio_count", 0)
        .order("updated_at", { ascending: false })
        .limit(CAROUSEL_LIMIT);

      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
