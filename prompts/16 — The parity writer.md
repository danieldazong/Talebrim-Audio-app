Read AGENTS.md first and follow it strictly. Do only what is on this page.
Re-read the five-step parity algorithm in AGENTS.md line by line and restate it
in your summary before writing code — steps 2 to 4 previously had no tables
behind them, and prompt 14 has now supplied `reading_positions`. Implement the
algorithm as written; if any step is ambiguous, STOP and ask rather than
improvising. This is the feature the app exists for.

1. One writer, in one module — `lib/parity/` — owned by nobody else. The reader
   (M5), the player (M6) and the mini player all call the same functions. Two
   writers racing each other is the failure mode that corrupts a position, so if
   you find yourself writing a second upsert path, stop.
2. Persist with `upsert` on the `(user_id, chapter_id)` unique constraint from
   prompt 14, passing `onConflict` explicitly
   (https://supabase.com/docs/reference/javascript/upsert). Never insert-then-
   update and never select-then-decide: the constraint makes the write idempotent,
   which is what lets you fire it from several triggers without duplicating rows.
   Do not send `user_id` from the client — the column defaults to the Clerk claim
   and RLS re-asserts it.
3. Write `audio_ms`, `text_offset`, `last_mode` and `updated_at` together, as one
   row. `last_mode` is what tells the other surface how to resume, so a write that
   omits it leaves the handoff guessing.
4. Fire on exactly these triggers and no others: pause; chapter change; app
   backgrounding via `AppState` (https://reactnative.dev/docs/appstate); a
   periodic interval while actively reading or playing; and screen unmount.
   Debounce the interval and the scroll-driven writes — a write per scroll frame
   would hammer a database with a ~450 ms floor — but state your debounce window
   and make sure it is short enough that a force-quit loses at most a few seconds.
5. Unmount and backgrounding must FLUSH the pending write, not drop it. A
   debounced writer whose cleanup simply clears the timer silently discards the
   most recent position — which is precisely the position the user cares about,
   because it is where they stopped. The `useEffect` cleanup must await or
   fire-and-forget the flush, never cancel it. Prove this in step 12.
6. On resume, reconcile server and session copies with LAST-WRITE-WINS ON THE
   SERVER `updated_at` timestamp, exactly as AGENTS.md specifies. Do not compare
   device clocks — two devices with skewed clocks will fight, and the losing
   write will be the correct one. Let Postgres set `updated_at`; do not send a
   client timestamp for the comparison.
7. Keep the Zustand `parity` slice session-authoritative during a session, as
   prompt 08 established, and remove the `// SERVER COPY ADDED IN 17` markers now
   that the server copy exists. The slice's public API must not change — that was
   the point of writing it that way. Still do not persist the parity position to
   AsyncStorage: a stale on-device value that later loses the timestamp
   comparison is worse than having none.
8. Convert between the two surfaces through one pair of pure functions, tested.
   A text offset is not a millisecond, and this mapping is the part that will be
   wrong in a way nobody notices until a user complains that listening dropped
   them into the wrong scene. If the data model gives you no reliable basis for
   the conversion — no per-paragraph timings, no alignment data — say so plainly
   and implement the documented fallback (resume at the start of the current
   chapter in the new mode) rather than inventing a proportional estimate that
   will drift. Report which you did.
9. Handle the offline and failed-write path. A failed upsert must not lose the
   position: keep it in the session slice, retry on reconnect, and never surface a
   toast or an alert for a background save. Reading is not interrupted by a save
   failure. Do not queue unbounded retries; state your cap.
10. Use `useMutation` with an optimistic update so the UI reflects the new
    position immediately and rolls back on failure
    (https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates).
    Invalidate only the position keys and the Library "continue reading" key — not
    the catalogue keys, which are unaffected and expensive to refetch.
11. Expose a single `getResumeTarget(bookId)` that Library and the story detail
    screen will call in prompts 21 and 22: it returns the most recent position for
    that book using the `(user_id, book_id, updated_at desc)` index from prompt 14,
    plus the mode to resume in. Build it now so those prompts consume it rather
    than each writing their own query.
12. Prove it with these tests, and paste the results: read for a while and
    force-quit, then reopen — the position is within your debounce window of where
    you stopped; background the app mid-chapter and return; switch chapters
    rapidly and confirm no orphaned or duplicated rows; sign out and sign in as
    another account and confirm neither position is visible to the other; go
    offline, read, come back online, and confirm the position lands.

Do not: write from more than one module; persist the parity position to
AsyncStorage; send `user_id` or a client `updated_at` from the client; compare
device clocks; write to `unlocks` or `library_items`; create, alter or drop any
table, column, index, view or policy — prompt 14 owns schema and this prompt is
additive code only; change any visual detail of M5; build the M5↔M6 handoff UI —
prompt 20 owns it, and this prompt only supplies the data it needs; play audio or
install `react-native-track-player`; show a toast, alert or spinner for a
background save.

Finish by running `npx tsc --noEmit`, then paste the five-step algorithm restated
from AGENTS.md with each step mapped to the code that implements it, your debounce
window from step 4, your offset↔millisecond decision from step 8, your retry cap
from step 9, and all five test results from step 12.

Next prompt: `18-player-ui.md`.
