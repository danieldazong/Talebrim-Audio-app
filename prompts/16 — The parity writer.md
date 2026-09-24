Read AGENTS.md first and follow it strictly. Do only what is on this page.
Re-read the five-step parity algorithm in AGENTS.md § Read/listen parity line
by line and restate it in your summary before writing code. Steps 2 to 4 had no
table behind them until prompt 13 created `reading_positions`, and nothing
writes it yet. Implement the algorithm as written and as resolved on this page;
if a step is still ambiguous, STOP and ask rather than improvising. This is the
feature the app exists for.

What exists today (prompts 13–15). Build on it, not around it:
- `reading_positions` (dashboard migration `20260923121634`): one row per
  reader + chapter, unique `(user_id, chapter_id)` as
  `reading_positions_user_chapter_key`. `user_id` defaults to the caller's
  Clerk `sub`. `audio_ms` and `text_offset` are nullable, and a check
  constraint requires the side named in `last_mode` to hold a value.
  `updated_at` defaults to `now()` on insert, and NOTHING bumps it on update.
- `readingPositionByChapterOptions()` in `lib/queries/reading-position.ts`
  reads one row. Every `queryKeys.readingPosition` key leads with the Clerk
  user id.
- The session-only `parity` Zustand slice (`store/parity-store.ts`). M5's
  `hooks/use-reading-position.ts` writes it once the scroll settles (150 ms),
  as the character offset of the paragraph at the top of the viewport, and
  restores from it on mount.
- `hooks/use-chapter-reader.ts` resolves M5's states. `lib/query-client.ts`
  connects NetInfo to `onlineManager`. `hooks/use-catalog-sync.ts` shows the
  app-wide `AppState` pattern.
- M6 does not exist yet (prompts 17–18). In this prompt only the reader writes;
  M6 and the mini player call the same functions when they are built.

1. One writer, in one module. `lib/parity/` makes every write to the server copy
   and every last-write-wins decision, and nothing else upserts
   `reading_positions`. No React, no hooks, no JSX there (AGENTS.md § lib/): the
   writer's queue and timers are module state, so a component unmounting can
   never cancel them. A workable split: `writer.ts` (queue, debounce, flush,
   upsert, retry), `reconcile.ts` (step 6) and `convert.ts` (step 8). React glue
   lives in `hooks/`: one app-wide `hooks/use-parity-sync.ts`, mounted in
   `app/_layout.tsx` beside `useCatalogSync`, plus the reader's existing hooks.
   If you find yourself writing a second upsert path, stop.
   - Every write names the chapter that produced it (`chapterId`, `bookId`),
     passed in explicitly, never "the current chapter". The reader and the
     player can be on different chapters at once (prompt 19).
2. Persist with `upsert` on `(user_id, chapter_id)`, passing
   `onConflict: "user_id,chapter_id"` explicitly
   (https://supabase.com/docs/reference/javascript/upsert), and `.select()` the
   row back. Never insert-then-update and never select-then-decide: the
   constraint makes the write idempotent, which is what lets several triggers
   fire it without duplicating rows. Do not send `user_id`: the column defaults
   to the caller's `sub`, and RLS re-asserts it.
   - The server must own `updated_at`, and today it does not. The migration's own
     comment hands this prompt the fix. Add ONE migration, the only schema change
     here, following AGENTS.md § Phase 2's discipline: written, pushed and
     verified from the dashboard repo (`story-app-dashboad/supabase/migrations`),
     never from this repo.
     ```sql
     create trigger reading_positions_set_updated_at
       before insert or update on public.reading_positions
       for each row execute function public.set_updated_at();
     ```
     It reuses the dashboard's existing `set_updated_at()` and alters nothing.
     `before insert` as well, so a client-sent `updated_at` is overwritten on
     every path.
   - Add two checks to the dashboard's `supabase/verify/reader_tables_rls.sql`
     (it rolls back): an insert and an update that each send
     `updated_at = '2000-01-01'` both come back with the server's time. `now()`
     is fixed within the script's one transaction, so test the overwrite, not a
     bump between two writes. Re-run the script and confirm every check passes.
     Regenerate types and confirm they did not change: a trigger adds none.
3. Each write sends exactly `chapter_id`, `book_id` (not null in the table),
   `last_mode`, and the ONE side that mode owns: `text_offset` from the reader,
   `audio_ms` from the player. Never send the other side. An upsert updates only
   the columns it sends, so the row keeps the other surface's last position, and
   a reading write can never clobber a listening position or the reverse. Never
   send `updated_at`. An unknown side is `null`, never `0`. `last_mode` is what
   tells the other surface how to resume, so no write omits it.
4. Fire on these triggers and no others:
   - pause: the player's, once M6 exists. For the reader, a settled scroll is
     the pause.
   - chapter change
   - app backgrounding, via `AppState` (https://reactnative.dev/docs/appstate)
   - a max-wait while actively reading or playing, so continuous reading still
     writes
   - screen unmount

   Debounce the settle-driven writes: one write per settle would still hammer a
   database with a ~450 ms floor. Pick and state the debounce window and the
   max-wait; a force-quit must lose at most a few seconds. Collapse the queue to
   the latest position per chapter: a pending write is replaced, never appended.
5. Unmount and backgrounding must FLUSH the pending write, not drop it. A
   debounced writer whose cleanup simply clears the timer silently discards the
   most recent position — precisely the one the user cares about, because it is
   where they stopped. Expose `flush()`, returning a promise. `useEffect`
   cleanups fire and forget it, never cancel it. The reader's 150 ms settle
   timer can fire after unmount (see `use-reading-position.ts`); that write must
   still reach the server. Prompt 19's handoff awaits this same flush before it
   navigates. Prove it in step 12.
6. Last write wins on the SERVER `updated_at`, exactly as AGENTS.md specifies.
   Device clocks are never compared: two devices with skewed clocks would fight,
   and the losing write would be the correct one. The rule, as one pure function
   in `lib/parity/reconcile.ts`:
   - Each session position carries `syncedAt`, the server `updated_at` of the
     row it last wrote or adopted (`null` if never synced), and `dirty`, true
     while it holds a change the server has not confirmed.
   - No session position → adopt the server row.
   - Session dirty → keep it and flush it. Its write lands last, so by the
     server's clock it is the newest.
   - Session clean, and the server row's `updated_at` is later than `syncedAt`
     → another device wrote since: adopt the server row.
   - Otherwise keep the session position.

   Run it when a chapter opens, and when the app returns to the foreground
   (`use-parity-sync.ts` refetches the position keys).
   - Restore on open. With a session position for the chapter, M5 opens
     instantly, as today. Without one (a new app session, or another device's
     row), `useChapterReader` treats the chapter's server position as one more
     input to the ready state. It is fetched fresh on this open, never taken
     from a cache another device may have overtaken, and the existing skeleton
     shows while it loads. It can never fail or block the chapter: on an error,
     or offline (a paused query), the chapter opens from the cached row if there
     is one, else from the top. No new state and no new copy.
   - Adopting writes into the slice before the ready state renders, so
     `use-reading-position.ts` keeps restoring from the slice. A row adopted
     while the chapter is already open never moves the text under the reader
     (prompt 15's rule); it applies on the next open.
7. The `parity` slice stays session-authoritative (AGENTS.md parity step 1) and
   session-only. Still do not persist it to AsyncStorage: a stale on-device value
   that later loses the timestamp comparison is worse than none. Remove the
   `// SERVER COPY — added by the parity prompt` marker and rewrite that header
   to describe the server copy that now exists. Keep `positions`,
   `getPosition`, `setPosition` and `clear`. Change only what the server copy
   needs, and state each change:
   - `audioMs` and `textOffset` become `number | null`. Unknown is null, never
     `0`: today `use-reading-position.ts` writes `audioMs: existing?.audioMs ?? 0`.
     Fix it.
   - The device-clock `updatedAt` goes; `syncedAt` (server time, as returned) and
     `dirty` come in. Nothing is left in the slice that a device clock could be
     compared against.
   - Callers record positions through `lib/parity`, which writes the slice first
     (parity step 1), then schedules the push. Nothing else calls `setPosition`.
8. Convert between the two surfaces through one pair of pure functions in
   `lib/parity/convert.ts`, tested. A character offset is not a millisecond, and
   this mapping is the part that will be wrong in a way nobody notices until a
   user complains that listening dropped them into the wrong scene.
   - The data has no alignment: no per-paragraph timings. Per chapter, it does
     have the text length (`script_text.length`, in the same JavaScript string
     units as the offsets) and `audio_duration_seconds` (nullable).
   - Map proportionally within the chapter (`ms = offset ÷ textLength ×
     durationMs`) and back. Snap text to the start of the paragraph that holds
     the offset (`blockIndexAtOffset()` in `lib/chapter-text.ts`). Rewind audio
     by a few seconds, clamped at 0, so the listener hears the lead-in rather
     than missing it. Positions are chapter-scoped, so the error can never
     exceed one chapter.
   - Fall back to the chapter's start in the new mode when there is no basis:
     `audio_duration_seconds` null or zero, an empty text, or an out-of-range
     input. Return which happened (for example `{ value, estimated }`), so the
     handoff can tell the user honestly (prompt 19).
   - Add `audio_duration_seconds` to `chapterDetailOptions()`'s select, and to
     `ChapterDetailRow`, so the reader has the duration.
   - In this prompt the reader uses the mapping once: restoring from a server
     row whose `last_mode` is `audio`. Report the constants you chose.
9. Offline and failed writes. A failed upsert must not lose the position: it
   stays in the slice, still `dirty`, and retries on reconnect (subscribe to
   `onlineManager`), on the next trigger, and after a short backoff. State your
   cap: at most N attempts per trigger, then wait for the next trigger or a
   reconnect. The queue is bounded at one entry per chapter. A background save
   never shows a toast, alert or spinner, and never interrupts reading.
   - Sign-out. `useSignOut` awaits a flush, bounded to a couple of seconds,
     BEFORE Clerk's `signOut()`, while the token is still valid. Then
     `clearUserScopedState()` empties the writer's queue along with the slice.
     Tag each queued write with the Clerk user id it was recorded under, and drop
     it if a different user is signed in when it sends: `user_id` defaults to
     whoever's token is on the request, so a write that outlives its account
     would land in the next account.
10. The cache, without `useMutation`. The writer is module state that has to
    flush from `AppState` and from unmount cleanups, outside any one component,
    and rolling a position back on failure would contradict step 9. So
    `lib/parity` calls Supabase itself and, on success, writes the returned row
    into the cache with `queryClient.setQueryData`: `readingPosition.byChapter`,
    and step 11's resume key. No refetch after a write: the returned row is the
    server's truth. Touch no catalog key. Keep every position-derived key under
    `queryKeys.readingPosition.all(userId)`, so Library's "continue reading" key
    (prompt 21) sits under it too.
11. `resumeTargetOptions(userId, bookId)` in `lib/queries/reading-position.ts`,
    keyed `queryKeys.readingPosition.resumeByBook(userId, bookId)`: the reader's
    most recent position in that book (ordered by `updated_at` descending, limit
    1, `.maybeSingle()`, served by the `(user_id, book_id, updated_at desc)`
    index). It returns the chapter id, `last_mode`, both sides and `updated_at`,
    or `null`. Library (prompt 21, which still calls it `getResumeTarget()`)
    consumes it rather than writing its own query.
    - Wire its first consumer now: M4's Read target in
      `hooks/use-book-detail.ts`, at its `TODO(parity)`. With a position in the
      book, Read opens that chapter; without one, the first chapter, as today.
      Resolve the resume chapter's number and access through
      `chapterDetailOptions()` and the same `chapterStateFor()` lock check, so a
      chapter locked since keeps Read's locked behaviour.
    - No visual change to M4. The resume card stays unrendered (see
      `components/book/book-header.tsx`), and Listen stays on the first audio
      chapter until the handoff prompt.
12. Prove it. Say which items you verified and how. Never claim a device result
    you did not observe.
    - Automated: unit tests for `convert.ts` and `reconcile.ts` (every branch of
      step 6, every fallback of step 8), and for the writer's queue with Supabase
      stubbed:
      - a flush after unmount still sends
      - ten rapid positions for one chapter send one write
      - a failed write stays dirty and retries
      - a write tagged with another user is dropped
    - The project has no test runner. `jest-expo` (dev-only) is the expected
      choice. STOP and ask before installing it, unless AGENTS.md § Tech Stack
      already records it as approved.
    - Database, read-only, from the dashboard repo's linked CLI: after rapid
      chapter switching there is one row per `(user_id, chapter_id)`,
      `updated_at` moves on each write, and no row stores `0` for a side it
      never knew.
    - On a device, written as a checklist for the user to run:
      - read, force-quit and reopen: the position is within the debounce window
      - background mid-chapter and return
      - switch chapters rapidly
      - sign out with a write pending, then sign in as another account: neither
        account sees the other's position
      - go offline, read, reconnect: the position lands

Do not:
- write `reading_positions` from anywhere but `lib/parity`.
- persist the parity slice to AsyncStorage.
- send `user_id`, `updated_at`, or the other mode's side from the client, or
  compare device clocks.
- write to `unlocks` or `library_items`.
- change the schema beyond step 2's one trigger: no table, column, index, view,
  policy or function.
- change any visual detail, string or state of M5 or M4.
- build the M5↔M6 handoff (prompt 19) or any resume UI. This prompt supplies
  the data those need.
- play audio or install `react-native-track-player`.
- show a toast, alert or spinner for a background save.

Finish by running `npm run typecheck`, `npm run lint` and the tests. Then:
- restate the five-step algorithm from AGENTS.md, with each step mapped to the
  code that implements it
- state your debounce window and max-wait (step 4)
- state your conversion constants, and when the fallback applies (step 8)
- state your retry cap (step 9)
- give the migration's name and the verify script's result (step 2)
- report step 12's results, split into verified and for-the-user
- update AGENTS.md: the parity section's "the writer does not yet" note, the
  `parity` row of the store table, and the status line
