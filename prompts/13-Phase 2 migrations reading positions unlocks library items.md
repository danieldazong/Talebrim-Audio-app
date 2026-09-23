Read AGENTS.md first and follow it strictly. Do only what is on this page.
This is the gate: nothing in the reader, player, library or paywall can be wired
until these three tables exist. Schema work only — no UI in this prompt.

WHERE THIS WORK HAPPENS. Write, test and push the migrations from the dashboard
repo, `C:\Users\PC\Desktop\story-app-dashboad`, and follow its `AGENTS.md` as
well as this one. It holds this database's only migration history, including
this app's earlier `20260920000001_mobile_read_path` and
`20260923000001_reader_settings`. Do not create `supabase/migrations` in this
repo: two migration histories against one database break `supabase db push`,
and a local `supabase db reset` here would build a database with no `books` or
`chapters` for the foreign keys to point at. The tables still belong to this
app (AGENTS.md Data Contract); only the files live in the dashboard repo. The
type regeneration and the data-layer changes in steps 10–11 happen in this
repo.

1. FOUR DECISIONS ARE PRE-SET BELOW. Restate them back to me and WAIT for my
   confirmation before applying anything to the remote database. You may write the
   migration files and test locally against `supabase db reset` first, but do not
   push to the remote until I confirm.
   a. An ad unlock is PERMANENT — no expiry. Rationale: an expiring unlock makes
   `unlocked` time-dependent, which the persisted TanStack cache cannot see, so
   the UI would show access that has already lapsed. Adding a nullable
   `expires_at` later is purely additive.
   b. A reading position is PER ACCOUNT, not per device. Rationale: the whole
   point of the server row is the text↔audio parity handoff and the
   last-write-wins rule, neither of which means anything per device.
   c. `My List` has NO explicit order column — order by `created_at desc`.
   Rationale: M7 shows no drag-to-reorder, and a `position` column brings
   reindexing and write amplification for nothing. Nullable `sort_order` can
   be added later.
   d. An unlock is PER USER AND CHAPTER. Rationale: per-user-only would unlock the
   entire catalogue from one rewarded ad on an 85–200 chapter serial.
2. Before writing a line of SQL, check what type the ADMIN DASHBOARD already uses
   for its per-user columns and match it exactly. With the Clerk third-party auth
   integration, `auth.jwt() ->> 'sub'` is a Clerk user id string such as
   `user_2abc…` — it is NOT a UUID. Every `user_id` column here must be `text`
   (https://clerk.com/docs/guides/development/integrations/databases/supabase).
   A type mismatch here breaks the per-user joins we protected by keeping the
   mobile client and the dashboard on one Clerk application. Report the type you
   found and the type you used.
3. ADDITIVE ONLY. Create three new tables. Do not alter, rename, drop or
   re-type any existing column, table, view, enum, policy or index. Do not modify
   `books`, `chapters`, `app_settings`, `books_catalog`, `chapters_catalog`,
   `chapters_list` or `chapters_needing_attention`. If you believe an existing
   object must change, STOP and tell me why.
4. `reading_positions`: `user_id text`, `chapter_id` FK, `book_id` FK
   (denormalised on purpose so Library can find the most recent position per book
   without joining `chapters`), `audio_ms integer`, `text_offset integer`,
   `last_mode` (text or audio), `updated_at timestamptz`. Give `text_offset` a
   column comment saying it is a CHARACTER offset into `chapters.script_text`,
   never a pixel scroll offset (AGENTS.md parity step 4). These column names
   are final: the hand-written `types/unbacked.ts` (`audio_position_ms`,
   `text_character_offset`, `last_written_by`) and the parity store
   (`audioMs`, `textOffset`, `lastWrittenBy`) map to them, not the other way
   round. UNIQUE on
   `(user_id, chapter_id)` — that constraint is what makes the parity upsert
   idempotent. Indexes on `(user_id, updated_at desc)` and
   `(user_id, book_id, updated_at desc)`.
5. `unlocks`: `user_id text`, `chapter_id` FK, `source` (`ad` or `purchase`),
   `created_at timestamptz`. UNIQUE on `(user_id, chapter_id)`. Do NOT write
   unlock rows for subscription entitlement — subscription access is computed
   from the RevenueCat entitlement at read time in the paywall prompt. If subscriptions
   wrote rows here, a lapsed subscriber would retain thousands of stale grants and
   you would inherit a revocation job. `unlocks` holds permanent grants only;
   state this in a table comment.
6. `library_items`: `user_id text`, `book_id` FK, `created_at timestamptz`.
   UNIQUE on `(user_id, book_id)`. Index `(user_id, created_at desc)`.
7. RLS FROM THE START, in the same migration as each `CREATE TABLE` — never a
   follow-up migration. Enable RLS, then write per-operation policies scoped
   `TO authenticated`: a user may select, insert, update and delete only rows
   where `user_id` equals their own Clerk `sub`. Wrap the claim read in a subquery
   — `(select auth.jwt() ->> 'sub')` — so Postgres evaluates it once per statement
   instead of once per row
   (https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv).
   Always name the role explicitly; never rely on the claim check alone to exclude
   `anon`. Default `user_id` to that same claim so a client cannot insert a row
   for someone else, and re-assert it in `WITH CHECK`.
8. Index every column an RLS policy filters on. An RLS predicate on an unindexed
   `user_id` turns every read into a sequential scan, which on this instance size
   (~450 ms floor on a trivial query) is immediately visible to the user.
9. Use the Supabase CLI in the dashboard repo: `supabase migration new` for
   each table, apply locally with `supabase db reset` there (that repo's
   history builds `books` and `chapters` first), and confirm the generated files are timestamped and
   committed (https://supabase.com/docs/guides/deployment/database-migrations).
   Do not edit an already-applied migration. Do not use the dashboard SQL editor
   for anything you intend to keep.
10. After the confirmed push, regenerate types in this repo with
    `npm run types:gen` and DIFF `src/types/database.ts` before and after.
    Regenerate the dashboard's types too, with its own script. The diff must contain additions only — three new table
    definitions and nothing else. If a single existing line changed, STOP and
    report it: something non-additive happened. Never hand-edit that file.
11. Delete `types/unbacked.ts` from prompt 03 and repoint every consumer at the
    generated types. The compiler must now tell you every call site that was
    stubbed; list them in your summary. Update `resolveChapterState()` so
    `unlocked`, `downloaded` and `reading` can be computed for real —
    `downloaded` stays local-device state and is NOT a table.
    Replace the three placeholder fetchers that throw on purpose —
    `lib/queries/reading-position.ts`, `lib/queries/unlocks.ts` and
    `lib/queries/library-items.ts` — with real reads against the new tables,
    through the existing keys in `lib/query-keys.ts`, and delete the
    "UNBACKED … until prompt 14" comments there and in the key factory. Reads
    only: no writers, hooks, screens or UI. Prompt 15 reads `unlocks` through
    this, and the parity prompt adds the `reading_positions` writer.
12. Re-run the admin dashboard's existing gates (`typecheck`, `lint`, `build`
    in `story-app-dashboad`) after regenerating its types, and run this repo's
    `npm run typecheck` and `npm run lint`. Confirm the dashboard still builds
    and its queries still pass. These tables are
    new, so nothing should break — proving it is the point.
13. RLS impersonation tests, as SQL, committed alongside the migrations. For each
    table prove: a user reads and writes only their own rows; a user cannot insert a
    row with another user's `user_id`; a user cannot read another user's rows; `anon`
    reads nothing at all. Run them as a non-admin user AND as an admin user — an
    admin must not gain implicit access to another reader's positions. Paste the
    results.
14. `free_chapters_at_start` stays in `app_settings` and remains the live source
    of truth. Do not copy it into a new table, do not hardcode it, and do not change
    its value.

Do not: create, alter or drop a view; touch an existing RLS policy; add a
trigger, a cron job, an Edge Function or a background job; enable an extension;
grant anything to `anon`; create a `profiles` table — genre selections stay local
in Zustand per prompt 07 unless I explicitly ask for one; build or modify any
screen, component or hook UI; write to `books` or `chapters`; create
`supabase/migrations` in this repo; push to remote before my confirmation in
step 1.

Finish by pasting: the four decisions restated for confirmation, the `user_id`
type the dashboard uses and the one you used, the migration file names in the
dashboard repo, the full `types/database.ts` diff proving additions only, the
compiler's list of previously-stubbed call sites from step 11 and the three
fetchers you made real, and all impersonation test results from step 13 marked
pass/fail.
