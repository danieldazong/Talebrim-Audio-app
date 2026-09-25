import { queryOptions } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

/** Six hours: longer than any chapter at 0.75x. A URL that expires mid-listen is re-minted (`lib/audio/player.ts`). */
const TTL_SECONDS = 6 * 60 * 60;

/**
 * `__DEV__` only: sign for 60 seconds, to force the re-mint mid-listen and
 * watch it recover. Never true in a commit.
 */
const DEV_FORCE_EXPIRY = false;

/** How long a signed narration URL lives. */
export const SIGNED_URL_TTL_SECONDS = __DEV__ && DEV_FORCE_EXPIRY ? 60 : TTL_SECONDS;

/**
 * One hour short of the URL's life, so a cached URL is never handed out close
 * to its expiry. Dropped from memory at the same age: an expired URL has no
 * use.
 */
const SOURCE_FRESH_MS = Math.max(0, SIGNED_URL_TTL_SECONDS - 60 * 60) * 1000;

export type ChapterAudioSource =
  /** A URL to play, valid for `SIGNED_URL_TTL_SECONDS` from when it was signed. */
  | { kind: "signed"; url: string }
  /** No `audio_path` (the row changed after `has_audio` was read), or no row: not available. */
  | { kind: "unavailable" }
  /** Storage would not sign it. The screen re-checks the lock rule before saying why. */
  | { kind: "refused" };

type StorageFailure = { message: string };

/**
 * Storage refuses a read with HTTP 400 and a 404-shaped body ("Object not
 * found", `NoSuchKey`), so a denial cannot probe what exists. An expired
 * token reads as "Bucket not found" instead, and a retry fixes that, so it is
 * thrown like any other error.
 */
function isRefusal(error: StorageFailure): boolean {
  return error.message === "Object not found" || ("code" in error && error.code === "NoSuchKey");
}

/**
 * One chapter's narration, signed for playback under the reader's own Clerk
 * token. The `audio` bucket is private (AGENTS.md § Storage buckets): no
 * Edge Function, no service-role key, and never a public URL.
 *
 * The second sanctioned direct read of `chapters` (AGENTS.md Data Contract),
 * on `chapterTextOptions()`'s terms: callers enable it only after
 * `chapterDetailOptions()` returned the chapter, which proves it is
 * published, and never for a chapter that resolves to locked.
 *
 * A signed URL is a bearer credential: `shouldPersistQuery()` keeps it out of
 * the persisted cache, and nothing adds a parameter of its own to it.
 */
export const chapterAudioSourceOptions = (userId: string, chapterId: string) =>
  queryOptions({
    queryKey: queryKeys.audio.source(userId, chapterId),
    queryFn: async (): Promise<ChapterAudioSource> => {
      const { data, error } = await supabase
        .from("chapters")
        .select("audio_path")
        .eq("id", chapterId)
        .maybeSingle();

      if (error) throw error;
      const path = data?.audio_path ?? null;
      if (path === null) return { kind: "unavailable" };

      const signed = await supabase.storage.from("audio").createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (signed.error) {
        if (isRefusal(signed.error)) return { kind: "refused" };
        throw signed.error;
      }
      return { kind: "signed", url: signed.data.signedUrl };
    },
    staleTime: SOURCE_FRESH_MS,
    gcTime: SOURCE_FRESH_MS,
  });
