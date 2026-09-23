Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the seed data from prompt 09 with real queries. Do not change the
screen design, the layout, the copy or the navigation. If a real data constraint
forces a visual change, STOP and ask me before implementing it.

Two things already exist and must be preserved, not re-litigated:

- The hero card's bottom scrim is a real `expo-linear-gradient` fade
  (`theme/colors.ts`'s `heroCardFadeGradient`), a deliberate, approved exception
  to "no gradient outside M6" — a flat scrim left a hard visible seam against the
  reference design. Keep it exactly as built; this is not the "add a gradient"
  this prompt's Do-Not list means.
- `lib/format.ts` has TWO duration formatters: `formatDuration()` (`h:mm:ss`, for
  a scrub bar or a chapter row) and `formatDurationCompact()` (`18h` / `45m`, for
  a rounded total like the hero card's "Audio Parity" line). Keep using each
  where it already applies — do not collapse them into one or invent a third.

1. Every read on this screen goes to the `books_catalog` view through
   `queryOptions` fetchers and the key factory already built in prompt 03
   (`lib/queries/catalog.ts`, `lib/query-keys.ts`). Never query `books` or
   `chapters` directly — the view runs `security_invoker=on` and pre-computes
   `chapter_count`, `audio_count`, `free_chapter_count` and
   `total_duration_seconds`, so going around it reintroduces the N+1 it exists to
   eliminate. `chapters_list` and `chapters_needing_attention` are admin-only and
   must not appear anywhere in the mobile app.
2. `catalogByGenreOptions` in `lib/queries/catalog.ts` currently does
   `select('*')` with no `.limit()` — fix it as part of this prompt, it does not
   already comply. Select explicit columns — never `select('*')` — and apply
   `.limit()` on every carousel query. Serials run 85–200 chapters and the
   catalogue will grow; an unbounded select on a list screen is a latency bug
   waiting to happen.
3. "Picked for You" filters on the `genres` text[] column using the containment
   operator so the GIN index is used
   (https://www.postgresql.org/docs/current/gin.html). In supabase-js that is
   `.contains('genres', [...])` (https://supabase.com/docs/reference/javascript/using-filters).
   Source the genre values from the Zustand `onboarding` slice built in prompt 07
   (`store/onboarding-store.ts`'s `selectedGenres`), never from a hardcoded array.
   Run `EXPLAIN ANALYZE` on the generated query once and paste the plan — if it
   shows a sequential scan rather than a bitmap index scan, report it rather than
   shipping it.
4. If the user selected no genres — the Skip path from prompt 07 is a valid
   completed state — "Picked for You" must fall back to a defined query, not an
   empty containment filter that returns nothing. Use the unfiltered recent
   catalogue and label the section the same way. State in your summary what
   fallback you chose.
5. "Trending Now" still has no backing metric: there are no view counts and no
   reads table. Do not invent one, do not sort by `created_at` and call it
   trending, and do not derive it from `chapter_count`. Keep the
   `// NO BACKING METRIC` marker and render the section from a defined,
   documented proxy that you name in a comment and in your summary, or render the
   empty state. Tell me which you did.
6. "New Audio Releases" filters on `audio_count > 0`. `books_catalog` has both
   `created_at` and `updated_at` (confirmed in `types/database.ts` — no need to
   re-derive this), so the open question is which one is the right ordering, not
   whether either exists: `created_at` is when the book row was first published,
   `updated_at` can move independently (e.g. a text-only book later gains audio).
   Pick the column whose semantics actually match "newest audio release" and say
   which one and why in your summary — don't default to `created_at` without
   considering `updated_at`.
7. Resolve `cover_path` to a URL through one helper, not inline at call sites.
   The `covers` bucket is confirmed public (AGENTS.md Data Contract — Storage
   buckets table): build the URL as
   `<public_cdn_domain>/storage/v1/object/public/covers/<cover_path>`, reading
   `public_cdn_domain` from the already-built `appSettingsOptions()`
   (`lib/queries/app-settings.ts`) rather than hardcoding the domain or using
   `getPublicUrl` against a freshly-constructed client-side bucket reference.
   This also means `constants/images.ts`'s `resolveSeedCoverAsset` and its
   `SEED_COVER_PATH_TO_ASSET` map are dead code once this lands — delete both,
   per that file's own comment ("prompt 11 replaces this... at which point this
   map is deleted, not extended" — this is that prompt, despite the off-by-one
   in the comment's number). Null `cover_path` still renders the flat
   `surface`-coloured placeholder box already built in `components/ui/cover.tsx`
   — `constants/images.ts` has no `coverPlaceholder` asset yet (deliberately
   undeclared so a missing file fails loudly at import time, not silently at
   runtime) and that has not changed. Do not add a `coverPlaceholder` entry in
   this prompt; if a real asset has landed, say so and I'll scope that
   separately. Never hotlink a third-party image URL or a remote placeholder
   service.
8. Set a `staleTime` above zero on every query on this screen and rely on the
   persisted cache from prompt 03. With the ~450 ms floor on a trivial query
   against this instance size, an unpersisted or always-stale cache shows an empty
   Discover screen on every cold start. Use `placeholderData: keepPreviousData`
   on the tab-strip filter
   (https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
   so switching genre does not blank the carousels.
9. The tab strip stays a client-side filter over already-fetched data where the
   genre is one the user selected, and issues a new keyed query otherwise. Either
   way it must not push a route or change the bottom tab. Each strip entry needs
   its own query key segment so results are cached per genre.
10. Wire the three states prompt 09 already built to the real query flags:
    `isPending` to the skeletons, an empty result array to the written empty state,
    and `isError` to the inline retry. Distinguish a genuinely empty catalogue from
    a failed request — they must not render identically. No `Alert.alert`, no red
    toast.
11. Remove the seed-data path once the real queries are wired: delete the
    `seedBooks` import from `app/(tabs)/index.tsx` and stop treating
    `data/seed-catalog.ts` as this screen's source. Per that file's own header,
    it is only ever imported from an explicit mock/preview path — once this
    screen no longer needs it, leaving the import in place alongside a live
    query is the exact stale state that file's comment warns against.
12. Measure and report: cold-start time to first painted carousel with an empty
    cache, and with a warm persisted cache. If the cold number is bad, report it —
    do not mask it by removing the loading state.

Do not: INSERT, UPDATE, UPSERT or DELETE anything in the database — the mobile
app never writes to the catalogue, and thin data is a blocker to report, not to
seed; query base tables or admin-only views; read or expose `metadata.role`;
fetch `script_text` here, or in any list query — it is fetched per chapter only
when a chapter opens; call the service-role key or an Edge Function; change any
visual detail from prompt 09; remove or alter the hero card's existing gradient
fade; add a second ember element or raw hex outside `global.css`'s `@theme`
block; build M4, M8, Library or Profile.

Finish by running `npx tsc --noEmit`, then paste the `EXPLAIN ANALYZE` plan from
step 3, the no-genre fallback from step 4, your Trending decision from step 5,
the `created_at` vs `updated_at` choice from step 6, and both cold/warm timings
from step 12.
