Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revised 2026-09-25 against the code as built by prompts 12–19 and against
> the frame. Decisions this review made are in AGENTS.md § Decisions —
> 2026-09-25, "M9". Where this page names a prompt, the file names in
> `prompts/` are the numbers. Features not yet built are named in markers,
> never numbered: `TODO(paywall)`, `TODO(downloads)`.

Design material: @material/5.png — build it as shown, except the elements
step 11 omits. Its content is placeholder: the chapter order, the counts, the
titles and the times.

M9 lists every chapter of one book, each in exactly one of four states:
Reading Now, Downloaded, Unlocked or Locked. Three compute from real data
today. Downloaded stays false until the downloads prompt.

What exists. Build on it, not around it:
- `src/app/chapters/[bookId].tsx` is prompt 08's placeholder. M4's "See all
  chapters" already pushes it with the book id.
- `chapterListByBookOptions(bookId)` in `lib/queries/chapters.ts` reads
  `chapters_catalog` under `queryKeys.chapters.listByBook(bookId)`. Nothing
  uses it yet. Live catalog sync (`lib/catalog-sync.ts`) already invalidates
  that key whenever the dashboard changes the book or one of its chapters.
- `bookDetailOptions()`, `appSettingsOptions()` (the live
  `free_chapters_at_start`, through `reader_settings()`),
  `unlocksByUserOptions(userId)` and `resumeTargetOptions(userId, bookId)`.
  M4 reads all four, so they are usually cached when M9 opens.
- `chapterStateFor()` in `types/states.ts` is the one lock rule (AGENTS.md
  § Decisions — 2026-09-24). It wraps `resolveChapterState()` and treats a
  null `access` as locked.
- `Cover`, `SegmentedControl` and `Screen` in `components/ui/`;
  `formatDuration()` and `formatDurationSpoken()` in `lib/format.ts`;
  `waitFor()` in `lib/query-status.ts`. M4's `ChapterPreviewRow` shows how a
  chapter's audio line reads.
- `@shopify/flash-list` is not a dependency. Do not add it.
- The React Compiler is on (`app.json`): don't hand-memoise rows.

1. Route. Replace the placeholder: a stack route outside (tabs), pushed,
   receiving only the book id. A malformed id (`isUuid()`) is Not available,
   as on M4. No tab bar and no mini player, by construction: the frame shows
   neither, and both live in the tab shell (`lib/mini-player-visibility.ts`
   maps tab routes only). This matches M4.

2. Data: five queries for a book of any length, never one per row.
   - The chapters: `chapterListByBookOptions(bookId)`, changed from
     `select("*")` to the columns M9 renders: `id, number, title, access,
     has_text, has_audio, audio_duration_seconds`. Add its row type to
     `types/catalog.ts` as a `Pick`, like the others. Never `script_text`
     (the view has none, and must not gain it), and never `chapters`,
     `chapters_list` or `chapters_needing_attention`.
   - The book (header), the settings, the unlocks and the resume target, as
     listed above.

3. One bounded fetch, not pagination. The whole list comes in one request,
   ordered by `number` ascending. That is about 30 KB for 200 chapters of
   metadata. Pages would each cost a round trip, and the ~450 ms floor
   (AGENTS.md § Performance ceiling) would make scrolling to chapter 150 wait
   on three or four more. The sort, the header's unlocked count and opening
   at the Reading Now row all need every row anyway. Supabase caps one
   response at the project's max rows (1,000 by default); revisit if a
   serial nears that.

4. Sorting. Oldest first (ascending `number`) is the default: the frame
   selects it, it is reading order, and AGENTS.md states no default. An
   earlier draft of this prompt claimed a conflict with AGENTS.md; there is
   none. Newest first reverses the same rows in memory. The data is complete,
   so there is no re-query and no sort order in the query key. The choice is
   screen state, not persisted, and changing it scrolls to the top.

5. Row state. Exactly one per row, through `chapterStateFor()`, never
   `resolveChapterState()` directly. Give `chapterStateFor()` an optional
   third argument, `{ isCurrentlyReading?, isDownloaded? }`, passed through to
   `resolveChapterState()`, so the null-access rule stays in one place. M4,
   M5 and M6 keep calling it as they do.
   - Reading Now: the chapter of `resumeTargetOptions()`, the same chapter
     M4's Read resumes. The parity writer puts every row it saves into that
     key, so Reading Now moves when the reader comes back from M5 or M6.
   - Downloaded: always false, with `// TODO(downloads)`.
   - Unlocked: free by `access`, free by position under the live
     `free_chapters_at_start` (never a hardcoded 3), or an `unlocks` row.
     `// TODO(paywall)`: the subscription entitlement isn't checked yet, as
     on M4–M6. A subscription never writes `unlocks` (AGENTS.md Data
     Contract).
   - Locked: everything else. Locked beats Reading Now, as
     `resolveChapterState()` already orders it.
   Build the rows in a pure function in `lib/` (for example
   `lib/chapter-list.ts`): each row's state, its detail line and its label,
   the unlocked count and the sort. Step 13 tests it.

6. Header, fixed above the list, not a `stickyHeaderIndices` header. That
   keeps it in place without the sticky-header touch bug
   (react-native#51763), so the sort toggle always fires. From the frame:
   - On `raised`: the back chevron, a small 2:3 `Cover`, the title in
     Fraunces, and "{N} chapters · {M} unlocked" in `muted`. N is the rows,
     and M is the rows that aren't Locked.
   - Below it on `bg`: `SegmentedControl` with "Oldest first" and "Newest
     first". The frame wraps both labels onto two lines, a design defect:
     one line each.

7. Rows, from the frame:
   - Title: "Ch. {n}: {title}", or "Chapter {n}" when untitled. One line,
     truncated.
   - Detail: the audio line as M4 writes it: "{formatDuration()} audio", or
     "Audio · duration unknown" when `audio_duration_seconds` is null or 0,
     never "0:00". "Text only" without narration; "No text or narration yet"
     with neither.
   - The right-hand slot holds exactly one thing:
     - Reading Now: the "Reading" pill, plus the row's ember left edge, as
       the frame draws them.
     - Downloaded: the teal download disc.
     - Locked: the lock icon, with the row's text dimmed to `muted`.
     - Unlocked with narration: the teal headphone, which is the row's
       Listen button (step 8).
     - Unlocked without narration: nothing.
   - Hairline dividers between rows, as in the frame.

8. Taps push, never replace, so back from M5 or M6 returns here.
   - The row opens the reader when `has_text` is true, and the player when
     only `has_audio` is. With neither, it opens nothing; it still reads out,
     and says why.
   - The headphone, a separate 44dp target, opens the player, with no `play`
     flag. As with M4's Listen, M6 changes nothing until its own Play
     (prompt 18).
   - A Locked row opens nothing: `// TODO(paywall)`, since M5a opens there in
     the paywall prompt. Opening the reader or the player from a locked row
     would be a paywall bypass. Its headphone isn't drawn.
   - No row offers Read without text or Listen without narration.

9. Virtualise with `FlatList`: `keyExtractor` by chapter id,
   `getItemLayout`, `initialNumToRender` of about one screen, and a modest
   `windowSize`. `getItemLayout` needs one height for every row, so the
   title and detail are one line each, and the height is computed once from
   the font scale: the padding, plus both line heights scaled by
   `PixelRatio.getFontScale()` up to the text's `maxFontSizeMultiplier`.
   Open scrolled to the Reading Now row (`initialScrollIndex`), or at the top
   when there is none.

10. Colour. M9 has no ember button until the paywall prompt adds its bottom
    bar. The ember here is the Reading row's left edge and pill: the resume
    marker, which AGENTS.md's token table files under progress. Teal only
    for audio (the headphone) and Downloaded. No gradient, glow, blur or
    shadow. Tokens only: raw hex lives in the `@theme` block of
    `src/global.css`.

11. Omitted, because nothing stands behind them yet (AGENTS.md § Decisions —
    2026-09-23, "No UI without data behind it"). Leave a marker where each
    goes, and report them:
    - "Download all": `// TODO(downloads)`. The downloads prompt adds it with
      real progress.
    - The bottom bar, "Unlock all chapters" and the ember "Go Ad-Free":
      `// TODO(paywall)`. There is no M10 route to open and no product
      behind "Unlock all" yet. Without the bar, the list runs to the bottom
      safe-area inset.
    - "14 min read": there is no word-count column.
    - The Reading row's "34% complete" and its progress line: a text offset
      has no text length to be measured against in the list.

12. States, on `bg`, in M5's and M6's precedence, through `waitFor()`:
    - Loading: skeleton rows shaped like real rows, under a skeleton header.
      Never a centred spinner.
    - Offline with nothing cached: the offline message.
    - Failed: an inline message with Retry.
    - Not available: no book (unpublished or missing) or a malformed id, as
      M4's `BookNotFound`.
    - Empty: a book with no chapters, as a written message.
    - No `Alert`, no toast.
    The rows wait for the list, the settings and the unlocks, so a row never
    shows Unlocked and then turns Locked. They wait for the resume target
    too, so the list opens at the right row. A failed or offline resume
    target only means no Reading Now row: parity never blocks the list.

13. Tests (`__tests__/` beside the module) for the pure row builder:
    - exactly one state per row
    - Locked beats Reading Now
    - a null `access` is Locked
    - free by position follows the setting given (try 3 and 5)
    - the detail line for a measured, an unmeasured, a text-only and an
      empty chapter
    - the unlocked count
    - Newest first is Oldest first reversed

14. Accessibility. Each row is one element with a unique label: its title,
    its audio said with `formatDurationSpoken()`, and its state in words, for
    example "Chapter 17: A Whispered Oath. 8 minutes 12 seconds of audio.
    Reading now." Locked and Downloaded are said, never only drawn. The
    headphone has its own label, "Listen to chapter 17". 44dp targets.
    Pressables follow § Style Exception Rules: never a `className` beside a
    `style` function.

Do not:
- select `script_text`, or read `chapters`, `chapters_list` or
  `chapters_needing_attention`.
- write to any table: no unlock, no library row and no position from this
  screen.
- issue a query per row, or paginate.
- draw two state visuals on one row, or an inert "Download all" or "Go
  Ad-Free".
- hardcode `free_chapters_at_start`.
- add a list library, a gradient, a glow, a blur or a shadow, or raw hex
  outside `src/global.css`.
- build Library, the paywall, rewarded ads, downloads or Profile.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:
- the live `free_chapters_at_start`, as read through `reader_settings()`
- how many queries M9 issues, and which were already cached coming from M4
- that a Locked row opens nothing, and how you checked
- the frame elements you omitted, and why
- the device checklist below. The owner runs it in Expo Go. The live catalog
  is three books and 27 chapters (AGENTS.md § Before production), so no
  200-chapter serial exists: the 200-row scroll test waits for seeded
  content. Say which items you could run yourself.
  1. M4 → See all chapters opens M9. Back returns to M4.
  2. The header's counts match the book. Oldest first is selected, and
     Newest first reverses the list and scrolls to the top.
  3. The chapter last read or listened to shows Reading, and M9 opens
     scrolled to it.
  4. Tap a free chapter: the reader opens. Read a little, go back: M9, with
     Reading on that chapter.
  5. Tap a headphone: the player opens on that chapter and waits for Play.
  6. Tap a Locked row: nothing opens.
  7. A chapter with neither text nor audio (live: Man of Ashes 001,
     chapters 11 and 12) reads "No text or narration yet" and opens nothing.
  8. In airplane mode, open M9 for a book not opened before: the offline
     state. Reconnect: it loads.
  9. With TalkBack, each row reads its title, its audio and its state.
  10. At the largest text size, rows keep one height and nothing overlaps.
  11. Publish a chapter from the dashboard while M9 is open: it appears.
