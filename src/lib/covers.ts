// Pure formatting helper. No React, no hooks, no JSX — AGENTS.md § lib/.

/**
 * Resolves a `books_catalog.cover_path` to a public CDN URL.
 *
 * `covers` is confirmed public read (AGENTS.md Data Contract — Storage
 * buckets table). The live column holds the object's path *within* that
 * bucket — e.g. `4f896e12-.../05258048-....jpg`, no `covers/` prefix
 * (verified 2026-09-23 against the one real published row) — so the bucket
 * segment is hardcoded here, matching AGENTS.md's literal URL shape:
 * `<public_cdn_domain>/storage/v1/object/public/covers/<cover_path>`.
 *
 * (The 4 bundled seed-catalog fixtures in `data/seed-catalog.ts` bake a
 * `covers/` prefix into their own `cover_path` strings, which is fixture
 * noise, not the real convention — don't pattern-match against them.)
 *
 * `publicCdnDomain` must come from the live `app_settings` row, read through
 * `appSettingsOptions()` (`reader_settings()`), never hardcoded — the migration's default is a
 * stale pre-rename domain (AGENTS.md § Storage and the CDN).
 *
 * Returns `null` for a null `cover_path` — callers render the placeholder
 * box in `components/ui/cover.tsx`, never a broken image.
 */
export function resolveCoverUrl(
  publicCdnDomain: string,
  coverPath: string | null,
): string | null {
  if (coverPath === null) return null;
  return `${publicCdnDomain}/storage/v1/object/public/covers/${coverPath}`;
}
