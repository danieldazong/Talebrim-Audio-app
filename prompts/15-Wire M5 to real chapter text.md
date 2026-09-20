Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the mock from prompt 15 with the real query. Do not change the
screen design, the layout, the typography or the navigation. If a real data
constraint forces a visual change, STOP and ask me before implementing it.

1. Fetch the chapter from `chapters_catalog` through the prompt-04 key factory,
   keyed by chapter id. Never query `chapters` directly and never touch the
   admin-only `chapters_list` or `chapters_needing_attention`. `chapters_catalog`
   runs `security_invoker=on`, so what this reader may see is already enforced by
   the view.
2. `script_text` gets its OWN query, keyed per chapter, separate from any list
   query (https://supabase.com/docs/guides/database/query-optimization). Select
   explicit columns. A serial runs 85–200 chapters, so pulling full text inside a
   list query would move megabytes to render a table of contents. If prompt 04's
   fetchers already separate them, confirm it; if not, fix it here.
3. `script_text` is expected to contain EXACTLY the three permitted Markdown
   marks. Do not sanitise, rewrite, normalise or reflow the text. If a chapter
   contains anything beyond those three, render it as plain text per prompt 15
   step 4, log it once in development with the chapter id, and report it — do not
   silently strip it and do not crash.
4. Handle a chapter that exists but has no text: `has_text` false, or
   `script_text` null or empty. That is a real state — an audio-only chapter is
   valid in this data model. Render a clear "no text for this chapter" state with
   the Listen path offered, not an error and not an empty white page. Never let
   null text render as the string "null" or "undefined".
5. Use `.maybeSingle()`, not `.single()`. A chapter id that is missing or not
   visible to this reader must render a "chapter not available" state with a way
   back, not a thrown error.
6. Tune the cache for reading, not for browsing: a chapter's text is effectively
   immutable, so set a long `staleTime` and a long `gcTime`, and make sure the
   persisted cache's `maxAge` is not shorter than `gcTime` or the persisted entry
   is discarded before it is ever reused
   (https://tanstack.com/query/latest/docs/framework/react/guides/caching).
   State the three values you chose. With the ~450 ms floor on this instance,
   re-opening a chapter must be instant from cache.
7. Prefetch the NEXT chapter's text when the reader passes a threshold — around
   80% scrolled — using `prefetchQuery`
   (https://tanstack.com/query/latest/docs/framework/react/guides/prefetching).
   Prefetch one chapter ahead only. Do not prefetch the whole book: on a
   200-chapter serial that is a self-inflicted denial of service against your own
   database and the user's data plan.
8. Chapter previous/next in the toolbar now navigate for real, replacing the
   route with the new chapter id rather than pushing, so a long reading session
   does not build a 40-deep back stack. Preserve the reader's theme and font
   settings across the transition — they live in the Zustand `reader` slice and
   must not reset.
9. Respect the lock boundary. Before rendering text, compute the chapter's state
   with `resolveChapterState()` using the live `free_chapters_at_start` from
   `app_settings` — read it, never hardcode 3 — plus the `unlocks` table that now
   exists from prompt 14. If the chapter resolves to `locked`, do NOT render
   `script_text`: show the locked state and leave a `// TODO(23)` where the
   paywall opens. Fetching the text of a locked chapter and hiding it in the UI
   is a paywall bypass, so the query itself must not run.
10. Wire prompt 15's existing states to the real query flags: `isPending` to the
    text-shaped skeletons, `isError` to the inline retry, and keep each one
    surface-matched to the ACTIVE reader theme. Distinguish "no text for this
    chapter" (step 4) from "not available" (step 5) from "failed to load" — three
    different messages, none of them an `Alert.alert` or a red toast.
11. Handle offline explicitly. With no connection and a warm persisted cache, the
    chapter must still open. With no connection and a cold cache, show an offline
    message distinct from a generic error. Do not implement downloads here —
    prompt 25 owns offline text caching as a separate mechanism.
12. Keep scroll offset in the `parity` slice, session-only. Do NOT write to
    `reading_positions` in this prompt even though the table exists — prompt 17
    owns the writer, its debounce and its flush-on-unmount. Two writers would
    race each other.

Do not: change any visual detail, string, colour or type role from prompt 15;
fetch text for more than one chapter ahead; fetch `script_text` inside any list
or catalogue query; write to any table; render a paywall or a purchase flow;
play audio or install `react-native-track-player`; add highlighting, notes,
translation or dictionary lookup; add a second ember element; add a gradient,
glow or shadow; use raw hex outside `tailwind.config.js`; build M6, M9 or the
download feature.

Finish by running `npx tsc --noEmit`, then paste your `staleTime` / `gcTime` /
persister `maxAge` values from step 6, confirm the locked-chapter query does not
execute at all, confirm re-opening a read chapter paints from cache with no
visible load, and describe the three distinct states from step 10 plus the two
offline states from step 11.
