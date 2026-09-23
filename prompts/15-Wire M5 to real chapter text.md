Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the mock from prompt 14 with the real queries. Do not change the
screen design, the layout, the typography, any string or the navigation. If a
real data constraint forces a visual change, STOP and ask me before
implementing it.

The screen, its states and their copy are prompt 14's
(`app/reader/[chapterId].tsx`, `components/reader/`). This prompt changes only
where the data comes from. Fetching lives in `hooks/` (AGENTS.md § Component
Creation Rule): put the reader's queries and derived state in one hook,
`hooks/use-chapter-reader.ts`, shaped like M4's `hooks/use-book-detail.ts`. It
returns the `ReaderStatus` (`types/states.ts`) the screen already switches on,
plus the data each state needs.

1. Chapter metadata: fetch the chapter by id from `chapters_catalog` with
   explicit columns (`id, book_id, number, title, access, has_text,
   has_audio`) and `.maybeSingle()`, in `lib/queries/chapters.ts`.
   - Add `queryKeys.chapters.detail(chapterId)` to the prompt-03 key factory,
     nested under a new `queryKeys.chapters.detailAll()` the way `text` sits
     under `textAll`, so every chapter key stays under `chapters.all()`.
   - Invalidate it in `invalidateCatalog()` (`lib/catalog-sync.ts`):
     `detail(id)` next to `text(id)` for each listed chapter, and
     `detailAll()` next to `textAll()` when `chapter_ids` is null ("too many
     to list"). Without the second, a chapter renamed in a bulk save never
     reaches an open reader.
   - Every column of the view is nullable in the generated types. A row with
     a null `id`, `book_id` or `number` is not available (step 5). A null
     `access` is locked, never free — M4's rule (step 9).
   - Never touch the admin-only `chapters_list` or
     `chapters_needing_attention`.
   - The book title for the top bar comes from `bookDetailOptions()`
     (prompt 12) on the chapter's `book_id`. It is usually already cached
     from M4.
   - The position label's "of M" is the book's HIGHEST chapter number
     (step 8), not its `chapter_count`. Numbers can have gaps: chapters 1, 2
     and 5 have a count of 3, so the count would make chapter 5 read "5 of
     3". The highest number keeps the label consistent with the top bar's
     "Chapter 5": "5 of 5". The label's format and copy stay prompt 14's;
     only the value changes. Rename the toolbar's `chapterCount` to
     `lastChapterNumber` so the name stays honest.
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
   c. It selects only `script_text`, switches from `.single()` to
      `.maybeSingle()`, and returns `data?.script_text ?? null`.
   d. Its comment still cites "prompt 16" for the reader; the reader is M5,
      prompts 14–15. Fix it.

   It stays its own query, keyed per chapter. Never put text in a list or
   catalogue query: a serial runs 85–200 chapters, so that would move
   megabytes to render a table of contents.
3. `script_text` is expected to contain EXACTLY the three permitted Markdown
   marks. The parser from prompt 14 step 5 (`lib/chapter-text.ts`) already
   renders anything else as literal text; do not change its rules. Do not
   sanitise, rewrite, normalise or reflow the stored text: the parser's
   display rules (a single line break reads as a space, a `## ` line is a
   heading) are prompt 14's and stay as they are.
   - In development only, log once per chapter id when the text contains
     something outside the three marks, checked against this fixed list and
     nothing more: a line starting with `#` that is not `## `, a
     `[text](url)` link, a backtick, and a line starting with `> `, `- ` or
     `* `. Report every live chapter that trips it. Do not strip anything and
     do not crash.
4. Handle a chapter that exists but has no text: `has_text` false, or
   `script_text` null, empty or whitespace only (the parser returns no
   blocks). That is a real state — an audio-only chapter is valid in this
   data model. It is prompt 14's "no-text" state, not an error and not an
   empty white page. Its Listen is the toolbar's Listen: the same no-op
   marked `// TODO(handoff)` until the handoff prompt, so both come alive in
   one change. Never let null text render as the string "null" or
   "undefined".
5. A chapter id that is missing, not published, or not visible to this reader
   gives a null row in step 1; so does a row with a null `id`, `book_id` or
   `number`, and a null `bookDetailOptions()` result. Render prompt 14's "not
   available" state with its "Go back", not a thrown error. A chapter the
   dashboard unpublishes while it is open switches to this state, as M4 does
   for a book.
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
   chapter on screen, do not swap it under the reader. Keep the first text the
   screen received for as long as it stays mounted, and ignore later data for
   that key until the next open, when the refreshed text shows. The chapter's
   metadata (its title in the top bar) still updates live; only the text is
   frozen. Replace the "M5 must decide…" note in `lib/queries/chapters.ts`
   with this decision.
8. Neighbouring chapters: add `chapterNeighboursOptions(bookId, number)` in
   `lib/queries/chapters.ts`, keyed `queryKeys.chapters.neighbours(bookId,
   number)` nested under `listByBook(bookId)`, so any change to the book's
   chapters invalidates it. It runs two small requests in parallel on
   `chapters_catalog` — the nearest `number` below (descending, limit 1) and
   above (ascending, limit 1), columns `id, number, access` — and returns
   `{ previous, next }`, each nullable. Numbers can have gaps, so don't assume
   n ± 1, and don't load M9's full list for this.
   - Add `lastChapterNumberOptions(bookId)` beside it, keyed
     `queryKeys.chapters.lastNumber(bookId)` under `listByBook(bookId)`: the
     highest `number` in `chapters_catalog` for the book (descending, limit
     1, `.maybeSingle()`). It is book-level, so it is cached once for every
     chapter of the book. Step 1's label uses it. It never blocks the ready
     state: while it loads, or if it fails, the label shows the larger of
     `chapter_count` and the current chapter's number, so it can never read
     "5 of 3".
   - Prefetch the NEXT chapter's text once the settled reading position (the
     position label's percentage) reaches 80%, using `prefetchQuery`
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
   - the user's `unlocks` rows, through `unlocksByUserOptions()` (prompt 13),
     keyed by Clerk's `userId` as M4 does

   M4 already wraps this in a private `stateFor()` in
   `hooks/use-book-detail.ts`, which treats a null `access` as locked. Move it
   next to `resolveChapterState()` in `types/states.ts` and use it in both
   screens, so that rule lives in one place.

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
    prompt 14 step 12 now navigate, to step 8's neighbours. Use
    `router.replace` with the neighbour's id rather than pushing, so a long
    reading session does not build a 40-deep back stack.
    - Show Next only when there is a next neighbour, and Previous only when
      there is a previous one. This replaces the mock's `chapterCount` check.
      While the neighbours load, or if they fail, show neither.
    - A locked neighbour is still navigable: it opens in its locked state
      (step 9), which is where the paywall sheet will sit (AGENTS.md M5a).
    - Preserve the reader's theme and font settings across the transition —
      they live in the Zustand `reader` slice and must not reset.
11. Wire prompt 14's existing states to the real query flags, in this order
    of precedence:
    1. offline with nothing cached (step 12)
    2. failed: a needed query errored and is not refetching. Its Retry
       refetches the failed queries, as M4's `retryChapters()` does.
    3. loading: the text-shaped skeleton while anything needed is pending
    4. not available (step 5)
    5. locked (step 9)
    6. no text (step 4)
    7. ready

    Each stays surface-matched to the ACTIVE reader theme, as prompt 14 built
    it. The top bar's title lines show whenever their values exist (prompt 14
    step 18), whatever the state. Three messages must differ from each
    other: "no text for this chapter" (step 4), "not available" (step 5) and
    "failed to load". None of them is an `Alert.alert` or a red toast.
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
      data), show prompt 14's offline state, distinct from the generic error.

    Don't add offline messages to M3, M4 or M8 in this prompt, and don't
    implement downloads here. The downloads prompt owns offline text caching
    as a separate mechanism.
13. Keep the character offset in the `parity` slice exactly as prompt 14 step
    14 built it: session-only, recorded once the scroll settles. Do NOT write
    to `reading_positions` in this prompt even though the table exists. The
    parity prompt owns the writer, its debounce and its flush-on-unmount, and
    two writers would race each other.
14. Remove the mock: delete `data/mock-chapter.ts`, the route's `mockBlocks`
    and its `// MOCK` notes, and turn every `// Wired in prompt 15` no-op
    (Next, Previous, Retry) into the real call. Parse the text once per text
    value (`useMemo`), not on every render. When you finish, searching `src/`
    for `mock-chapter` and `Wired in prompt 15` finds nothing.

Do not:
- change any visual detail, string, colour or type role from prompt 14.
- change the parser's rules in `lib/chapter-text.ts`.
- fetch text for more than one chapter ahead, or for a locked chapter.
- fetch `script_text` inside any list or catalogue query, or read `chapters`
  for anything but step 2's single row.
- write to any table.
- render a paywall or a purchase flow.
- build the age gate. AGENTS.md records it as open before M5 ships, and it
  gets its own prompt. After this prompt, real `Mature 18+` chapters are
  readable with no gate; that is expected until that prompt lands.
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
- confirm that a dashboard edit to the open chapter does not move the text,
  updates the title live, and shows the new text on the next open
- describe the three distinct states from step 11 and the two offline states
  from step 12
- list any live chapter that trips step 3's development log
- confirm the position label's "of M" is the book's highest chapter number
  (step 1), and say whether any live book's chapter numbers have a gap
- confirm the search in step 14 finds nothing
