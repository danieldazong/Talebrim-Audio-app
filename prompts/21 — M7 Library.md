Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revised 2026-09-25 against the code as built by prompts 12–20 and against
> the frame. Decisions this review made are in AGENTS.md § Decisions —
> 2026-09-25, "M7". Where this page names a prompt, the file names in
> `prompts/` are the numbers. Features not yet built are named in markers,
> never numbered: `TODO(paywall)`, `TODO(downloads)`.

Design material: @material/9.png — build it as shown, except where a step
below says otherwise. Its content is placeholder: the titles, covers, counts,
chapter numbers and percentages. The mini player drawn in it is already built
and is not part of this prompt.

M7 is the Library tab. A Continue card resumes the reader's latest place in
the mode they left it, and My List shows the books they saved. It is the first
screen to read `library_items`, and M4's new My List button (step 7) is the
first code to write it. The parity writer already writes `reading_positions`.

What exists. Build on it, not around it:
- `src/app/(tabs)/library.tsx` is prompt 08's placeholder. It sits in the tab
  shell, which already draws the mini player and the tab bar below it
  (`lib/mini-player-visibility.ts`: `library: true`). M3 pads its scroll
  content by `useBottomTabBarHeight()` + 16.
- `libraryItemsByUserOptions(userId)` in `lib/queries/library-items.ts`, under
  `queryKeys.libraryItems.byUser(userId)`. Nothing uses it yet.
- `reading_positions` has an index on `(user_id, updated_at desc)` and one on
  `(user_id, book_id, updated_at desc)`. `resumeTargetOptions(userId, bookId)`
  is per book: it serves M4 and M9, not a card across every book.
- The parity writer (`lib/parity/writer.ts`) puts each row it saves into the
  `byChapter` and `resumeByBook` keys and touches no other key.
- `bookDetailOptions()`, `appSettingsOptions()`, `unlocksByUserOptions()`,
  `chapterStateFor()` (the one lock rule) and `resolveCoverUrl()`.
- `Cover`, `SegmentedControl` (with `track="surface"` for a `bg` screen, added
  by M9), `Button` and `Screen` in `components/ui/`. The `progress` and
  `progress__fill` utilities in `src/global.css`. There is no `ProgressBar`
  component yet.
- M4's `BookTopBar` (`components/book/book-header.tsx`): round Back and Share.
- PostgREST embeds the catalog views from the reader tables, and the generated
  types carry those relationships: `library_items` → `books_catalog`, and
  `reading_positions` → `chapters_catalog` (checked 2026-09-25).
- `cover-placeholder.png` does not exist. A null cover renders `Cover`'s flat
  `surface` box.
- TanStack Query 5.103, so mutation `scope` is available. The React Compiler
  is on (`app.json`): don't hand-memoise.

1. Route. Replace the placeholder. One vertical `FlatList` holds the screen:
   the header, the segments, Continue and the My List heading go in
   `ListHeaderComponent`, My List's books are its items (`numColumns={3}`,
   `keyExtractor` by book id), and My List's states go in
   `ListEmptyComponent`. Bottom padding is
   `useBottomTabBarHeight()` + 16, as on M3, so the last row clears the mini
   player.

2. Header, from the frame: "My Library" in Fraunces (`text-heading`), and at
   the right the round search button, filled `surface` as the frame draws it.
   It pushes `/search` (M8), as M3's does.

3. Segments. `SegmentedControl` with `track="surface"`, full width:
   "Books ({N})" and "Audiobooks ({M})".
   - Books is every book on My List. Audiobooks is those with
     `audio_count > 0`: the frame's Books segment shows headphone badges, so
     Books is not "text only".
   - Counts show once My List has loaded, bare labels before.
   - Books is the default. The choice is screen state, not persisted.
   - They filter in place: no route push, no tab change.
   - The frame fills the selected segment `raised`. `SegmentedControl` keeps
     its own `muted/25` fill, as on M5 and M9. Don't restyle it.

4. Continue Reading: one query across every book, not M4's per-book resume.
   - Add `recentPositionsOptions(userId)` to `lib/queries/reading-position.ts`,
     keyed `queryKeys.readingPosition.recent(userId)`, under `all(userId)` as
     the key factory's comment already plans. It reads the reader's positions
     newest first by `updated_at`, which the `(user_id, updated_at desc)`
     index serves, limited to 100 rows. Columns: `READING_POSITION_COLUMNS`,
     plus the chapter embedded as
     `chapters_catalog!inner(number, access, has_text, has_audio)`.
     `!inner` drops positions in unpublished books. Never `script_text`. The
     view types every column as nullable: a row without a chapter number is
     dropped, as on M4 and M9.
   - Fix `resumeTargetOptions()`'s comment: Library does not reuse it.
   - Books shows the newest row, under the frame's heading "Continue
     Reading". Audiobooks shows the newest row whose `last_mode` is `audio`,
     under "Continue Listening". With no row, the section collapses, heading
     included: no empty card, no placeholder cover. The book need not be on
     My List.
   - The card's book comes from `bookDetailOptions(bookId)`, usually cached
     from M4.
   - From the frame: the cover, a teal uppercase eyebrow, the title in
     Fraunces, the progress label, the ember progress bar, and a round ember
     resume button with an `ink` icon.
   - The eyebrow reads "Listening" when `last_mode` is `audio`, "Reading" when
     `text`. The frame's "Reading & Listening" names both modes at once and
     says nothing about what the button will do.
   - Progress reads "Chapter {n} of {chapter_count}", with the bar at
     n / chapter_count, clamped to 1. With a null or 0 count: "Chapter {n}"
     and no bar. No "% complete": a text offset has no text length to be
     measured against (as on M9), and one measure for both modes keeps them
     comparable. `chapter_count` can differ from M5's "of M" (the highest
     chapter number) where numbers skip; that is accepted.
   - The button resumes in `last_mode`, and pushes:
     - audio: M6, with `play: "1"`. It is a play button, as M5's Listen is.
     - text: M5.
     - If the chapter no longer has the side `last_mode` names (narration
       removed, or no text), it opens the other mode. Never a round trip to an
       empty state.
     - The lock comes from `lockStateFor()`, as on M5 and M6: a chapter free
       by access or by position never waits for the unlocks. While the lock
       can't be told yet, the button is disabled and says it is loading. A
       Locked chapter opens nothing: `// TODO(paywall)`, as on M4.
     - The icon matches the destination: play for M6, an open book for M5.
   - The rest of the card (cover and title) pushes M4.
   - Freshness. After each row it saves, the writer marks `recent(userId)`
     stale with `invalidateQueries(..., refetchType: "none")`, so a flush
     never fetches. M7 refetches its stale library keys when it gains focus
     (`useFocusEffect`). Coming back from M5 or M6, the card shows the new
     place.
   - Loading: a skeleton card. Failed, or offline with nothing cached: the
     section collapses. Parity never blocks My List.

5. My List. `libraryItemsByUserOptions(userId)` changes to embed the book, in
   one request: `id, book_id, created_at, book:books_catalog!inner(id, title,
   author, cover_path, chapter_count, audio_count)`, ordered `created_at desc`.
   `!inner` drops unpublished books; deleted ones cascade away. Never `books`,
   and never a query per book.
   - Heading: "My List ({count in this segment})". At its right, a static
     `muted` caption, "Recently added". The frame's "Recently Updated" would
     be untrue: the order is `created_at desc`, when the book was saved
     (AGENTS.md § Phase 2). It is not a control.
   - A 3-column grid inside the 16dp side padding, with 12dp gutters. Covers
     are 2:3 at 12dp through `Cover`. The title sits below, two lines at most,
     truncated, with two lines' height reserved so the rows align. No author:
     the frame shows none.
   - The teal headphone badge sits top-right on the cover, in a small dark
     round disc as the frame draws it, on books with `audio_count > 0`.
   - The ember progress line runs along the cover's bottom edge. It uses the
     Continue card's measure, from the book's newest row in
     `recentPositionsOptions()`. With no row among those 100, there is no
     line, never a 0% line. A book last opened longer ago than the newest 100
     rows shows no line; that is accepted.
   - Tapping a book pushes M4.
   - M7 has no remove control: the frame draws none. Removal is M4's button
     (step 7).

6. `ProgressBar` in `components/ui/`, built on the `progress` utilities, with
   the fill width inline (§ Style Exception Rules). The Continue card and the
   grid line are its first uses, so a height prop covers both. Screen readers
   skip it: the labels say the progress in words (step 13). Onboarding's bar
   is a demo card with a thumb: leave it.

7. M4's My List button. No frame draws one, but without it nothing can put a
   book on My List.
   - A round outlined button in `BookTopBar`, left of Share, the same size and
     style: a plus when the book is not on My List, a check when it is.
   - Its label is "Add {title} to My List" or "Remove {title} from My List",
     with `accessibilityState={{ selected }}`.
   - `body` colour. Not ember (Read is M4's one ember action), not teal
     (audio only).
   - Membership reads `libraryItemsByUserOptions()`. Hidden until the book
     and My List are both known, and hidden if My List fails to load: M4
     shows no error for it.
   - `BookTopBar`'s existing Pressables pair a `className` with a `style`
     function (prompt 26 fixes them). The new one must not (§ Style Exception
     Rules).

8. One mutation module, `hooks/use-my-list.ts`, used by M4's button. The
   requests are plain functions in `lib/queries/library-items.ts`.
   - Add: `upsert({ book_id }, { onConflict: "user_id,book_id",
     ignoreDuplicates: true })`, which is `ON CONFLICT DO NOTHING` on
     `library_items_user_book_key`. A repeated add is a no-op, never a
     duplicate or an error. Never send `user_id`: the column defaults to the
     caller's `sub`, and the insert policy checks it.
   - Remove: `delete().eq("book_id", bookId)`. RLS scopes it to the caller.
   - `useMutation` with an optimistic update. `onMutate` cancels in-flight My
     List queries, keeps a snapshot, and writes the new list. An added book
     goes first, built from M4's `bookDetailOptions()` row. `onError`
     restores the snapshot. `onSettled` invalidates only
     `libraryItems.byUser(userId)`, never a catalog key.
   - `scope: { id: \`my-list:${bookId}\` }`, so a fast add-then-remove on one
     book runs in order.
   - Offline, TanStack pauses the mutation and sends it on reconnect; the
     optimistic state stays. A paused change is not persisted: closing the
     app while offline drops it, and the next fetch corrects the list. That is
     accepted. A server error rolls back and announces "Couldn't update My
     List" through `announceForAccessibility`. No `Alert`, no toast, no
     spinner.

9. Catalog sync. `lib/catalog-sync.ts` invalidates both library keys on every
   change, as it already does lists and search. A title, a cover or a chapter
   number can change inside them, and an unpublished book must leave them.
   Both keys are per user, and catalog sync knows no user, so match them with
   a `predicate` rather than a listed key.

10. States, on `bg`:
    - Loading: a skeleton grid of cover shapes and title lines, under the real
      header and a skeleton segment bar. Never a centred spinner.
    - Offline with nothing cached: the offline message.
    - Failed: an inline message with Retry.
    - Empty, which every new reader sees first, so it must look intentional:
      a short heading, "Save stories from their page to find them here.", and
      a secondary `Button`, "Browse stories", that switches to Discover. Not
      ember.
    - Audiobooks empty while Books is not: "No audiobooks on your list yet."
    - Continue: as in step 4.
    - No `Alert`, no toast.

11. Colour. Ember for the resume button, which is M7's one ember action, and
    for progress (the card's bar and the grid lines, which AGENTS.md's token
    table files under progress). Teal for the eyebrow and the headphone
    badges. `muted` for the caption and the unselected segment. Tokens only:
    raw hex lives in the `@theme` block of `src/global.css`.

12. Pure parts in `lib/library.ts`: the segment filter and counts, the
    Continue row per segment, the newest row per book, the progress label and
    fraction, and where the resume goes (M5, M6 or nothing). Tests in
    `lib/__tests__/library.test.ts`:
    - Books counts every item; Audiobooks only `audio_count > 0`.
    - Audiobooks' Continue is the newest audio row, not the newest row.
    - The newest row per book wins; a book with no row has no progress.
    - Rows without a book id or a chapter number are dropped.
    - "Chapter n of m", the clamp, and no bar with a null or 0 count.
    - Resume: audio opens M6 with play, text opens M5, the fallback when the
      chapter lacks that side, and Locked opens nothing.
    - The optimistic update: an add puts the book first once, a second add
      changes nothing, and a remove drops it.

13. Accessibility.
    - The resume button reads "Continue listening to {title}, chapter {n}" or
      "Continue reading {title}, chapter {n}", or says the chapter is locked.
    - Each grid book is one element: "{title} by {author}. Audiobook. Chapter
      {n} of {m}.", with only the parts that are known.
    - Segments announce which one is selected (`SegmentedControl` does).
    - The search button is labelled "Search".
    - 44dp targets. Pressables never pair a `className` with a `style`
      function.

14. Sign-out. `clearUserScopedState()` calls `queryClient.clear()`, which
    empties the queries and the mutations, so a paused add from one account
    is never sent under the next. Verify it rather than assume it, and that
    the next account sees an empty Library.

Do not:
- write any table but `library_items`, and only from M4's button. M7 itself
  writes nothing.
- send `user_id` from the client.
- create, alter or drop any table, view, column, index or policy.
- add drag-to-reorder, folders, tags, collections, a sort control or a
  downloads segment. Downloads get their own screen in prompt 24 (AGENTS.md
  § Decisions — 2026-09-25, "Downloads").
- query per book or per grid item.
- add a second ember action, a gradient, a glow or a shadow, or raw hex
  outside `src/global.css`.
- build the paywall, downloads or Profile.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:
- the queries M7 issues, and which were already cached coming from M4
- that a double add creates one row, and how you checked
- the frame elements you changed or omitted, and why
- the device checklist below. The owner runs it in Expo Go. Say which items
  you could run yourself.
  1. A new reader: no Continue section, and the My List invitation. "Browse
     stories" opens Discover.
  2. On M4, add a book: the button flips at once. Library shows it first, the
     Books count is right, and Audiobooks includes it only if it is narrated.
  3. Double-tap Add fast: `library_items` holds one row for that book (the
     Supabase table editor, filtered by book).
  4. Remove it on M4: it leaves My List. Add it again: no error.
  5. Read a chapter, return to Library: the card says Reading and that
     chapter, and its button opens the reader at the place.
  6. Listen, return: Listening. The button opens the player, which plays
     from the place.
  7. Audiobooks: "Continue Listening" shows the latest chapter listened to,
     even after reading something else since.
  8. In airplane mode, toggle on M4: it flips at once. Reconnect: the change
     is saved, and still there after a restart.
  9. Sign out, then sign in as the second reader: an empty Library.
  10. With TalkBack, each book and the resume button read as in step 13.
  11. At the largest text size, grid titles keep to two lines and nothing
      overlaps.
  12. Unpublish a saved book from the dashboard: it leaves My List.
