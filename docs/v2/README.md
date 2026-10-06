# Version 2 — deferred on purpose

Version 1 is **subscription-only** (the owner, 2026-10-06): Talebrim Unlimited
is the only way past a lock. M5a offers `See plans` and nothing else. This
folder holds what was built for the free ways past a lock, so version 2 can
pick it up. Nothing in it is in the app, and nothing in it runs.

AGENTS.md has the record: Decisions — 2026-10-06, "Version 1 is
subscription-only"; and, for what was learned, Decisions — 2026-10-03,
"Prompt 23 review" and "Prompt 23, Part A as built".

## Free ways to unlock a chapter (prompt 23)

The spec is `prompts/23 — Rewarded ads for chapter unlocks.md`, with a banner
saying it is version 2. It has three parts:

| Part | What | Status |
| --- | --- | --- |
| A | **Wait-for-free:** one free chapter per story every 24 hours, claimed from the server | Built 2026-10-03, proven, taken out 2026-10-06. Archived here. |
| B | **Rewarded ads:** a watched ad opens one chapter, written by a server function that Google's signed callback calls | Never started. |
| C | The public pages, the records and Google Play's forms for ads | Never started. |

### What is kept

- **`free-unlocks-app.patch`** (this folder): Part A's app side as one patch of
  11 files: M5a's `Unlock free` button, `lib/unlock.ts` (the server's answers,
  the countdown, the button's states), `hooks/use-unlock-options.ts`, the
  queries and keys, five analytics events, a scrolling `Sheet`, the tests and
  the two function signatures in `types/database.ts`. It was applied to a clean
  tree, typechecked and tested (43 tests pass), then reversed, on 2026-10-06.
- **The dashboard repo** (`C:\Users\PC\Desktop\story-app-dashboad`):
  - `supabase/migrations/20261003120000_wait_unlock.sql`: the SQL. It stays
    where it is, because an applied migration is history.
    `20261006120000_remove_wait_unlock.sql` undid it in the database.
  - `supabase/verify/v2/wait_unlock_rls.sql`: 58 checks. Rehearsed on
    2026-10-06: that migration's SQL, then this script, inside a transaction
    that rolled back, passed 58 of 58.

### Bringing Part A back

1. **Review the prompt against the code first** (the prompt review workflow).
   The page was written for the app of 2026-10-03.
2. **The database** (dashboard repo): add a NEW migration with the SQL of
   `20261003120000_wait_unlock.sql`, dry-run it inside `begin; …; rollback;`,
   show the owner, and push only with their yes. Then run
   `supabase/verify/v2/wait_unlock_rls.sql` and the older verify scripts, and
   regenerate types in both repos.
3. **The app:** `git apply docs/v2/free-unlocks-app.patch` from the repo root.
   If M5a or the `Sheet` has moved on, apply with `--3way`, or read the patch
   as the reference and port it. Typecheck, lint, test.
4. **M5a** keeps two comments that say where the buttons go: beneath `See
   plans`.
5. **Prove it live,** not only in tests: the archived work needed a live run
   to find a countdown bug (the words on screen and the timer behind them
   read two different clocks; see `countdownAt()` in the patch).

### Part B, rewarded ads: the owner's steps

Removed from AGENTS.md's owner reminders on 2026-10-06. The prompt's "BEFORE
PART B" list has the detail; in short:

1. An AdMob account for Nouvrix LLC, and the app `com.talebrim.app` in it.
2. One rewarded ad unit, with server-side verification pointing at
   `https://fwjrdzzdtshbqrfkgivd.supabase.co/functions/v1/admob-ssv` (the
   function to be written and deployed first), a European and a US-states
   consent message, and the owner's phone as a test device.
3. **Read AdMob's content rules against the catalogue first.** They restrict
   sexual text and refuse non-consensual themes; every live book is
   `mature_17`, and AdMob also reviews the app before real ads serve. If it
   refuses, the free routes are Part A and the plan.
4. A new native dependency (`react-native-google-mobile-ads`), a development
   build after it, a new Edge Function and its secret, and the public pages'
   change (Privacy says "we don't use it for advertising", which stops being
   true): each needs the owner's own yes.
