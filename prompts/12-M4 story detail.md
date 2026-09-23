Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @"/c:/Users/PC/Desktop/talebrim-app/material/6.png" — ensure everything is as is
shown, except where a step below says otherwise. This prompt builds M4 Story
Detail only. `material/5.png` is M9, the full chapter list that "See all
chapters" opens. M9 gets its own prompt after the Reader (prompts 14–15), so
don't build it here. This screen ships with its real queries in one prompt.

Prompt 13 created the reader tables, with read-only fetchers. Of the
per-user state, only unlocks feed this screen: the reader's own unlocks count
in the lock check (steps 3e and 12). Nothing writes reading positions yet, so
the resume card and finished-chapter marks stay hidden, and the frame has no
My List control.

1. Replace the `book/[id]` placeholder from prompt 08. It is a pushed stack
   route outside the tab group and receives only the book id from the route
   param. Pass no data through params. Because it sits outside `(tabs)`, it
   has no mini player by construction (`lib/mini-player-visibility.ts`,
   prompt 08). AGENTS.md's M4 spec doesn't say whether M4 shows one, so
   report the route as unspecified, as prompt 11 did for M8. If the id is not
   a UUID (a stale or hand-typed deep link), render the not-found state from
   step 4 without querying. PostgREST returns an error for a malformed UUID,
   not zero rows.
2. Keep the route file thin. Put the header, chapter row and states in
   `components/book/`, following `components/discover/` and
   `components/search/`.
3. All reads go through `lib/query-keys.ts` (prompt 03). Catalogue reads hit
   views only: never read `books`, `chapters`, `chapters_list` or
   `chapters_needing_attention`. Select explicit columns and never use
   `select('*')`.
   a. Book row: change the existing `bookDetailOptions` in
   `lib/queries/book.ts`. It currently does `select('*')` + `.single()`.
   Add a `BookDetailRow` `Pick` to `types/catalog.ts`, declared like
   `CarouselBookRow` and `SearchBookRow`, and select exactly those
   columns.
   b. Chapter preview: the first `PREVIEW_CHAPTER_LIMIT` (5) chapters from
   `chapters_catalog`, ordered by `number` ascending. The frame's preview
   starts at chapter 11, but that is the reader's own position, and
   per-user state isn't rendered yet, so start from chapter 1. Do NOT
   reuse `chapterListByBookOptions` / `queryKeys.chapters.listByBook`.
   That key belongs to M9's unlimited list, and a limited result cached
   under it would hand M9 five chapters. Nest the preview key under it
   instead: `[...queryKeys.chapters.listByBook(bookId), "preview"]`.
   `invalidateCatalog()` in `lib/catalog-sync.ts` matches by prefix, so
   it will refresh the preview when the dashboard edits this book's
   chapters. Confirm that a live edit reaches an open M4.
   c. Listen target: only when `audio_count > 0`, fetch the first chapter
   with `has_audio` (`order("number")`, `limit(1)`). It can lie past the
   preview rows, so it can't be read from them.
   d. `free_chapters_at_start` and `public_cdn_domain` come from the existing
   `appSettingsOptions()`, which calls `reader_settings()`. Never select
   `app_settings`. Its policy is admin-only, so a reader gets zero rows
   (AGENTS.md § Storage and the CDN).
   e. The reader's unlocks: the existing `unlocksByUserOptions(userId)` in
   `lib/queries/unlocks.ts` (prompt 13), with `userId` from Clerk's
   `useAuth()`. RLS returns only the reader's own rows. Nobody holds an
   unlock yet, because rows are written by a server function the paywall
   prompt adds. Reading them now means M4 shows an unlocked chapter
   correctly from the day unlocks start. This is the reader's own table,
   not the catalogue, so the views-only rule above doesn't apply to it.
4. Use `.maybeSingle()` for the book row, not `.single()`
   (https://supabase.com/docs/reference/javascript/maybesingle). `.single()`
   errors on zero rows. A book that is unpublished or invisible to this
   reader under RLS would then show an error screen, when it should show
   "story not available". Return `BookDetailRow | null` and handle null as
   its own state. A book the dashboard unpublishes while it is open lands
   here too, because catalog sync refetches it.
5. Header, top to bottom as in the frame:
   - round back and share buttons
   - centred `Cover`, resolved through `resolveCoverUrl()`. A null
     `cover_path`, or settings that haven't loaded yet, renders `Cover`'s
     flat `surface` box. `cover-placeholder.png` does not exist yet (see
     `constants/images.ts`).
   - title in Fraunces 600
   - "By {author}", with the line omitted when `author` is null
   - metadata row
   - genre pills
   - Read and Listen
   - synopsis

   The frame has no blurred backdrop, although AGENTS.md's M4 spec lists
   one. The image wins for layout, so don't add it; report the conflict.

6. Metadata row: keep the chapter count and the total duration from the
   frame. Drop the "★ 4.9" rating and the teal "Ongoing" status, because
   neither has a backing column. (`status` is `draft | published`, and every
   row in the view is published.) Mark the omission `// NO BACKING METRIC`,
   as M8's result row does.
   - Chapter count comes from `chapter_count`, pluralised. Never count the
     preview rows.
   - Duration: show `total_duration_seconds` through
     `formatDurationCompact()` (the same helper as M3's hero), and only when
     `audio_count > 0`. A text-only book has nothing to measure, so "Duration
     unknown" would misdescribe it (M8 precedent). When audio exists but the
     total is null, show the unknown label, never `00:00`.
   - The frame shows "18h 40m", but the helper rounds that to "19h". Report
     the difference; don't add a third formatter.
7. Maturity: the frame shows no maturity label. For `mature_17` only, render
   `maturityLabel()` from `lib/labels.ts` ("Mature 18+") as a `Badge`
   `outline` pill in the metadata row. Render nothing for `general`, and
   never the raw enum value. AGENTS.md § Content Rules asks for an age gate
   before content access, and none exists. Report that as open; don't build
   it.
8. Genre pills: blush-tinted and wrapping, showing `genres` exactly as
   stored. The values are free text and may not match `data/genres.ts`. They
   are labels, not controls, so don't use `Chip`, which is a Pressable
   announced as a button. Render non-interactive pills the way `HeroCard`'s
   genre row does.
9. Read and Listen sit side by side, as in the frame.
   - Read is the single ember element on this screen: `Button` `primary`,
     book icon, `ink` label.
   - Listen is a teal-outlined pill with a headphone icon. `Button` has no
     such variant, so add one (a `btn--audio` utility in `global.css` plus a
     `Button` variant) rather than styling it inline.
   - Read pushes `reader/[chapterId]` for the first preview row. Nothing
     writes reading positions yet, so there is no resume target:
     `// TODO(parity): resume position`.
   - Listen pushes `player/[chapterId]` for the chapter from step 3c. When
     `audio_count` is 0, Listen renders disabled, with an accessible label
     saying this story has no narration.
   - Both apply step 12's lock rule to their target. A locked target does
     not navigate: `// TODO(paywall)`.
   - Both are disabled while their target is loading and when the book has
     no chapters.
10. Resume card ("You're on Chapter 12 · 34% complete" with its progress
    bar): this is a per-user reading position. The `reading_positions`
    table exists, but it stays empty until the parity prompt adds its writer.
    Don't render the card, don't mock it and don't reserve its space. Mark
    it `// UNBACKED — resume card needs the parity writer`.
11. Synopsis: use `synopsis`, falling back to `short_description`, and hide
    the section when both are null. Truncate with `numberOfLines` and a teal
    "More" that expands in place. Show "More" only when the text actually
    overflows, decided with `onTextLayout`
    (https://reactnative.dev/docs/text). Verify this on Android. If `lines`
    is capped at `numberOfLines` there, measure an unconstrained hidden copy
    instead. Don't add a read-more library.
12. Chapters section:
    - Heading: "Chapters ({chapter_count})". Omit the frame's right-hand
      "Read / Audio Parity" label and report it. It explains a "min read ·
      audio" pair that half can't be filled, because there is no word-count
      column.
    - Rows are cards, as in the frame, showing "{number}. {title}".
      Only when `has_audio`, add `formatDuration(audio_duration_seconds)`
      followed by " audio"; a null duration shows the unknown label.
    - Omit the frame's "8 min read" (no word count) and the check mark with
      its "Read" label (a finished state with no backing). The frame shows
      audio as text, not a badge, so don't add a headphone badge.
    - Lock is the only per-user state shown here. Compute it with
      `resolveChapterState()` from `types/states.ts`, using:
      - `access` and `number` from the row
      - the live `free_chapters_at_start` from step 3d. Never hardcode 3.
      - `isUnlockedByUser`: whether step 3e's unlocks include the row's
        `id`
    - The chapters section shows its skeleton rows until the preview rows,
      the settings and the unlocks have all loaded, so a row never flashes
      locked and then opens. If settings or unlocks fail, show the section's
      inline error with its retry. Never fall through to free.
    - A row whose `access` is null is locked. Locked rows show a lock icon
      on the right. Skip rows with a null `id` or `number`.
    - A chapter opened by an unlock looks exactly like a free one here. M9 is
      where "Unlocked" gets its own visual. Don't render Unlocked,
      Downloaded or Reading visuals on this screen.
    - There are only a few preview rows, so `.map()` inside the page's
      `ScrollView` is fine. Prompt 09's no-`.map()` rule was for unbounded
      lists.
13. After the rows, a "See all chapters" link pushes `chapters/[bookId]` (M9,
    `material/5.png`). That route stays a placeholder until M9's own prompt,
    so keep the push and don't build the screen. Show the link whenever
    `chapter_count > 0`.
14. Tapping an unlocked row pushes `reader/[chapterId]`. The rows have no
    listen path in the frame. Tapping a locked row must NOT navigate: make
    it a no-op marked `// TODO(paywall)`, because the paywall prompt opens
    M5a there. A locked chapter must never open the reader.
15. States, all on the `bg` surface (`plum-deep` is not a token in this
    project):
    - loading: skeletons shaped like the real header and rows, with no
      spinner
    - not found (step 4): its own state, with a way back
    - book error: inline with a retry, reusing M8's error look
      (`cloud-offline-outline` plus connection copy)
    - chapter, settings or unlocks error: inline inside the chapters section
      with its own retry, while the header stays on screen
    - no chapters: "No chapters yet", with Read and Listen disabled

    Offline: the project has no NetInfo. As in M3 and M8, a warm persisted
    cache renders offline and a cold one shows the error state. Don't add a
    library for this here. No `Alert.alert` and no toast anywhere.

16. Share: the frame shows it, so use React Native's built-in `Share`
    (https://reactnative.dev/docs/share). Share the title and author only.
    There is no public book URL (talebrim.com is the admin dashboard) and no
    deep-link scheme, so don't invent a link. Mark it
    `// TODO: add a link once public book URLs exist`.
17. Use a plain `ScrollView`. The frame shows no collapsing or parallax
    header, so don't add motion.
18. Give everything interactive an `accessibilityRole` and a label, with 44dp
    minimum touch targets (the round icon buttons included). A locked row's
    label says it is locked, rather than relying on the icon alone. A
    disabled Listen says why it is disabled.

Do not:

- fetch `script_text` on this screen. It is fetched per chapter, only when
  the reader opens one, and serials run 85–200 chapters.
- INSERT, UPDATE or DELETE anything, including a view count, a reading
  position or a My List entry. The frame has no My List control, so don't
  add one. The app can never write `unlocks` at all.
- create a migration, table, view or RLS policy. Schema changes happen in the
  dashboard repo, and prompt 13 has already made this app's.
- invent a rating, review count, reader count, trending rank or completion
  status.
- render the Unlocked, Downloaded, Reading or finished visuals, or a resume
  card.
- add a second ember element.
- add a gradient, glow, blur or shadow. The gradients AGENTS.md permits are
  not on this screen.
- use raw hex outside `global.css`'s `@theme` block (`theme/colors.ts` only
  for props that take no className).
- build M9 (`material/5.png`), M5, M6, the paywall or an age gate.

Finish by running `npm run typecheck` and `npm run lint`. Then:

- paste the live `free_chapters_at_start` value you read through
  `reader_settings()`
- confirm the metadata row uses view-computed counts, not client-side ones
- confirm that neither a locked chapter row nor a locked Read/Listen target
  navigates
- confirm the unlocks query runs and feeds `isUnlockedByUser`. It returns zero
  rows today, so the rows follow the free-run rule alone.
- describe the not-found state from step 4
- confirm a dashboard edit refreshes an open M4 (step 3b)
- list every frame element you omitted or changed, with the reason: rating,
  "Ongoing", resume card, the rows' read time and finished marks, "Read /
  Audio Parity", the backdrop blur, and the duration format
