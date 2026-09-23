Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the mock from prompt 14 with the real query. Do not change the
screen design, the layout, the typography or the navigation. If a real data
constraint forces a visual change, STOP and ask me before implementing it.

1. Chapter metadata: fetch the chapter by id from `chapters_catalog` with
   explicit columns (`id, book_id, number, title, access, has_text,
   has_audio`) and `.maybeSingle()`. Add `queryKeys.chapters.detail(chapterId)`
   to the prompt-03 key factory. Also invalidate it in `invalidateCatalog()`
   (`lib/catalog-sync.ts`) next to `chapters.text(id)`, so a chapter renamed in
   the dashboard reaches an open reader. Never touch the admin-only
   `chapters_list` or `chapters_needing_attention`. The book title and chapter
   count for the top bar and position label come from `bookDetailOptions()`
   (prompt 12) on the chapter's `book_id`. It is usually already cached from
   M4.
2. Chapter text: `script_text` exists only on `chapters`, because
   `chapters_catalog` leaves it out by design. So the existing
   `chapterTextOptions()` in `lib/queries/chapters.ts` reads one row from
   `chapters` by id. That is the one sanctioned direct read of `chapters`
   (AGENTS.md Data Contract). Keep it, with these rules:
   a. It is `enabled` only after step 1's `chapters_catalog` row has come back
      non-null for the same id. That row proves the chapter is published,
      which is what the view-only rule protects.
   b. It is `enabled` only when step 9 resolves the chapter to anything but
      `locked`.
   c. It selects only `script_text`, and switches from `.single()` to
      `.maybeSingle()`.

   It stays its own query, keyed per chapter. Never put text in a list or
   catalogue query: a serial runs 85–200 chapters, so that would move
   megabytes to render a table of contents.
3. `script_text` is expected to contain EXACTLY the three permitted Markdown
   marks. Do not sanitise, rewrite, normalise or reflow the text. If a chapter
   contains anything beyond those three, render it as plain text per prompt 14
   step 4, log it once in development with the chapter id, and report it — do not
   silently strip it and do not crash.
4. Handle a chapter that exists but has no text: `has_text` false, or
   `script_text` null or empty. That is a real state — an audio-only chapter is
   valid in this data model. Render a clear "no text for this chapter" state,
   not an error and not an empty white page. Its Listen is the toolbar's
   Listen: the same no-op marked `// TODO(handoff)` until the handoff prompt,
   so both come alive in one change. Never let null text render as the string
   "null" or "undefined".
5. A chapter id that is missing, not published, or not visible to this reader
   gives a null row in step 1. Render a "chapter not available" state with a
   way back, not a thrown error.
6. Cache for reading:
   - Set `staleTime` to 24 hours for chapter text. That is safe because
     `useCatalogSync` invalidates a chapter's text the moment the dashboard
     saves it, so a long `staleTime` never serves an outdated chapter.
   - Leave `gcTime` and the persister's `maxAge` at the app defaults (24 hours,
     `lib/query-client.ts`). Do not raise them. The persisted cache is ONE
     AsyncStorage value shared by every query, so every chapter kept longer
     grows it for the whole app. Long-term offline text belongs to the
     downloads prompt, with its own storage.

   State the three values. With the ~450 ms floor on this instance, re-opening
   a chapter read today must be instant from cache.
7. Live edits while reading: when the dashboard changes the text of the
   chapter on screen, do not swap it under the reader. Keep the text the screen
   opened with for as long as it stays mounted; the refreshed text shows on the
   next open. Replace the "M5 must decide…" note in `lib/queries/chapters.ts`
   with this decision.
8. Neighbouring chapters: look up the nearest chapter on each side by `number`
   from `chapters_catalog`. Numbers can have gaps, so don't assume n ± 1.
   - Prefetch the NEXT chapter's text when the reader passes about 80%
     scrolled, using `prefetchQuery`
     (https://tanstack.com/query/latest/docs/framework/react/guides/prefetching).
   - Prefetch one chapter ahead only, and only if it does not resolve to
     `locked`. Prefetching a locked chapter is fetching locked text.
   - Never prefetch the whole book. On a 200-chapter serial that is a
     self-inflicted denial of service against your own database and the
     user's data plan.
9. Respect the lock boundary. Compute the chapter's state with
   `resolveChapterState()` using:
   - `access` and `number` from step 1
   - the live `free_chapters_at_start`, read through `appSettingsOptions()`
     (`reader_settings()`). Never select `app_settings` (admin-only, so a
     reader gets zero rows), and never hardcode 3.
   - the user's `unlocks` rows, through the fetcher prompt 13 made real

   A chapter that is free by `access` or position needs no unlocks. Otherwise,
   show the loading skeleton while unlocks load — never flash the locked state.
   If the chapter resolves to `locked`, the text query does not run: show the
   locked state and leave a `// TODO(paywall)` where the paywall opens.
   Subscription entitlement is not checked yet; the paywall prompt adds it.

   Say plainly in a comment that this keeps the app honest but is not
   security. RLS still lets any signed-in reader select `script_text`
   directly. Closing that is a pre-launch task recorded in AGENTS.md § Before
   production.
10. The end-of-chapter "Next chapter" and "Previous chapter" controls from
    prompt 14 step 11 now navigate. Use `router.replace` with the neighbour's
    id rather than pushing, so a long reading session does not build a 40-deep
    back stack. A locked neighbour is still navigable: it opens in its locked
    state (step 9), which is where the paywall sheet will sit (AGENTS.md M5a).
    Preserve the reader's theme and font settings across the transition — they
    live in the Zustand `reader` slice and must not reset.
11. Wire prompt 14's existing states to the real query flags: `isPending` to
    the text-shaped skeletons, `isError` to the inline retry, and keep each one
    surface-matched to the ACTIVE reader theme. Three messages must differ from
    each other: "no text for this chapter" (step 4), "not available" (step 5)
    and "failed to load". None of them is an `Alert.alert` or a red toast.
12. Offline: `@react-native-community/netinfo` was approved on 2026-09-23
    (AGENTS.md § Tech Stack).
    - Install it with `npx expo install @react-native-community/netinfo`.
    - Connect it once, app-wide, to TanStack Query's `onlineManager` in
      `lib/query-client.ts`
      (https://tanstack.com/query/latest/docs/framework/react/react-native#online-status-management).
      Queries then pause while offline and resume on reconnect, instead of
      failing through their retries.
    - In the reader, with no connection and a warm cache, the chapter still
      opens.
    - With no connection and a cold cache (`fetchStatus === "paused"` with no
      data), show an offline message distinct from the generic error.

    Don't add offline messages to M3, M4 or M8 in this prompt, and don't
    implement downloads here. The downloads prompt owns offline text caching
    as a separate mechanism.
13. Keep the character offset in the `parity` slice exactly as prompt 14 step
    12 built it, session-only. Do NOT write to `reading_positions` in this
    prompt even though the table exists. The parity prompt owns the writer, its
    debounce and its flush-on-unmount, and two writers would race each other.

Do not:
- change any visual detail, string, colour or type role from prompt 14.
- fetch text for more than one chapter ahead, or for a locked chapter.
- fetch `script_text` inside any list or catalogue query, or read `chapters`
  for anything but step 2's single row.
- write to any table.
- render a paywall or a purchase flow.
- play audio or install `react-native-track-player`.
- add highlighting, notes, translation or dictionary lookup.
- add an ember button.
- add a gradient, glow or shadow.
- use raw hex outside `global.css`'s `@theme` block.
- raise the app-wide `gcTime` or persister `maxAge`.
- build M6, M9 or the download feature.

Finish by running `npm run typecheck` and `npm run lint`. Then:
- paste your `staleTime`, `gcTime` and persister `maxAge` values from step 6
- confirm the text query does not run for a locked chapter, and that the
  prefetch skips a locked next chapter
- confirm that re-opening a chapter read today paints from cache with no
  visible load
- confirm that a dashboard edit to the open chapter does not move the text and
  shows on the next open
- describe the three distinct states from step 11 and the two offline states
  from step 12
