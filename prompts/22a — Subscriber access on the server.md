Read AGENTS.md first and follow it strictly. Do only what is on this page.

# 22a — Subscriber access on the server (the entitlement mirror)

> **Written 2026-10-02**, from the code as it stands that day, the live
> database, RevenueCat's documentation and AGENTS.md (Decisions —
> 2026-09-25, "Paywall"; 2026-10-01, "Prompt 22 (second review)"; 2026-10-02,
> "Subscribers download locked chapters"). Review it against the code again
> before building if anything below has changed since (the prompt review
> workflow).
>
> **Built 2026-10-02**, the same day, with the owner's yes for Part C's
> design and for every server change: AGENTS.md, Decisions — 2026-10-02,
> "Subscriber access on the server as built", records what was built, its
> deviations and the proofs.
>
> **Why it exists.** The app knows who subscribes (RevenueCat's SDK on the
> phone); the server doesn't. Two things follow, and both block launch:
> - A paying Talebrim Unlimited subscriber opens a chapter the dashboard
>   locked, and its narration is refused: the audio storage policy
>   (`public.can_play_audio()`) has no subscriber branch, only a
>   `-- TODO(paywall)`. Downloading it fails the same way.
> - Anyone signed in can read every locked chapter's text straight from the
>   API. The app never asks for it, but nothing on the server stops it
>   (AGENTS.md § Before production).
>
> **The calls the owner may flip:**
> - **The server learns about plans two ways:** RevenueCat's webhook (for
>   renewals, cancellations and expiries while the app is closed), and the
>   app asking the server to check right after a purchase or restore, so the
>   chapter just bought opens at once. Both fetch the truth from RevenueCat;
>   neither trusts what the phone says. *(Flip: webhook only, which can lag
>   behind a purchase by seconds.)*
> - **The `entitlements` table is server-only.** Readers can't read or write
>   it; one function answers "does the caller have a plan?". *(Flip: readers
>   may read their own row.)*
> - **Test Store and sandbox purchases count on the server too**, as they
>   count in the app. Google Play's license testers and the store's reviewers
>   buy in the sandbox. *(Flip: production purchases only, after launch.)*
> - **Locked text is protected by hiding locked rows of `chapters`** from
>   readers without access, while the two catalog views keep listing every
>   chapter's metadata (Part C). It changes a policy on a dashboard-owned
>   table: a third sanctioned change, and the owner's yes comes first.
>   *(Flip: protect only the `script_text` column, which breaks the
>   dashboard's own reads of it and needs changes there; or leave text
>   unprotected, which isn't safe to launch.)*
> - **Account deletion also deletes the reader's RevenueCat customer** and
>   their `entitlements` row (Part D), as planned on 2026-10-01. *(Flip:
>   keep the RevenueCat history.)*
> - **Settled, not a flip:** subscribers may download locked chapters; free
>   readers never can (the owner, 2026-10-02).

**BEFORE THIS PROMPT — STOP until all of these are true:**
1. **Prompt 22's Parts A, B and D are built** (2026-09-25 and 2026-10-01).
   Its Part C, Google Play, is not needed: everything here works against
   RevenueCat's Test Store, whose purchases send webhooks (`store`
   `TEST_STORE`).
2. **RevenueCat customers are keyed by the Clerk user id**: the app calls
   `logIn(userId)` before any purchase (`lib/revenuecat.ts`). Confirm it
   once the key below exists: the owner's account (`user_3K3ACK…`) is a
   customer under that id, with no anonymous id in front of it. **Confirmed
   2026-10-02** through the v2 API: the customer exists, and its only alias
   is the Clerk id. It had no active entitlement that day, since the test
   plans had ended.
3. **Owner, a RevenueCat secret key.** In RevenueCat → Project settings → API
   keys, a new **secret** key. Prefer a v2 key with **Customer information:
   read & write** and nothing else; step 1 confirms what it must allow.
   Add it to the **dashboard's** `.env` as `REVENUECAT_SECRET_KEY`, and the
   project id (from the RevenueCat dashboard's address) as
   `REVENUECAT_PROJECT_ID`. Never the app's `.env.local`, never an
   `EXPO_PUBLIC_` name, never in chat (AGENTS.md § Billing Rules and
   rule 1's spirit). **Done 2026-10-02**, checked without printing the key:
   - The key is `talebrim-server`, v2, with **Customer information: read &
     write** and no access to anything else.
   - The project id is `ce9557c5`, used as is in v2 paths (no `proj`
     prefix).
   - Reading customers answers 200. Project configuration, the project list
     and charts answer 403.
   - Because of that 403, `ad_free`'s internal entitlement id can't be
     listed with this key. Step 1 finds it another way: the dashboard's
     entitlement page, or the active entitlement a fresh test plan returns.
4. **Owner, a fresh Test Store plan** for the phone checks, bought on the
   development build when the finish list asks for it. The test plans bought
   on 2026-10-01 have ended. **Done 2026-10-02**: a Weekly plan, bought from
   Profile at 16:40 UTC, which also gave `ad_free`'s id, `entlb97eb9391d`.
5. **Owner, a yes** before each migration is pushed, each function deployed
   and each secret set (as for every server change before this one). **Given
   2026-10-02**, for all of them at once.

## Part A — the mirror, in the dashboard repo

1. **Check RevenueCat's API before writing code**, and report what you
   found:
   - the endpoint and key that read a customer's **active entitlements**,
     with each one's identifier and expiry; whether `ad_free` comes back by
     its lookup key or by an internal id (v2 returns internal ids: if so,
     find `ad_free`'s id once and keep it as a setting, rather than giving
     the key project-configuration access);
   - what an unknown customer returns, and whether reading creates one (v1's
     `GET /subscribers` does);
   - the endpoint that **deletes** a customer, and what it returns for an
     unknown one (Part D);
   - how a plan in a billing-grace period and a plan with no end date look;
   - the rate limit (480 requests a minute for customer information when
     this was written).
   RevenueCat documents a Test Store quirk: around a renewal, its active
   entitlements read empty for about a minute. Production purchases don't do
   this. Expect it in the phone checks, and don't build around it.
2. **Migration**, in `story-app-dashboad/supabase/migrations`, with § Phase
   2's discipline (additive, RLS from the start, types regenerated and
   diffed, the dashboard's three gates):
   - `public.entitlements`: `user_id` text (the Clerk id, as every reader
     table stores it), `entitlement` text (`ad_free`), `expires_at`
     timestamptz (null for no end date), `product_id`, `store`,
     `environment`, `synced_at` timestamptz, primary key `(user_id,
     entitlement)`. RLS on, and **no grants** to `anon` or `authenticated`:
     only the functions below write it, with the project's secret key. A row
     exists while RevenueCat reports the entitlement active, and is deleted
     when it doesn't.
   - `public.has_active_plan()`: `security definer`, `stable`, `set
     search_path = ''`, executable by `authenticated` only. True when the
     caller (`auth.jwt() ->> 'sub'`) has an `ad_free` row whose `expires_at`
     is null or later than `now()`. The server's clock decides the end of a
     plan, so a lapse takes effect at its expiry even if no webhook arrives.
   - `public.can_play_audio()`: replace its `-- TODO(paywall)` with `or
     public.has_active_plan()`. Only the function body changes, as on
     2026-09-30. Subscribers can then play **and download** locked
     narration; nobody else can.
   - A verify script, `supabase/verify/entitlements_rls.sql`, in the style
     of `reader_tables_rls.sql`, rolled back at the end: readers and `anon`
     can neither read nor write `entitlements`; `has_active_plan()` is true
     for an active row, false for an expired one, for none, and for `anon`;
     a reader with an active row can sign a locked chapter's narration (the
     policy's check), one without can't, and the admin still can. Update
     `audio_read_policy.sql` with the subscriber cases, and re-run it,
     `reader_tables_rls.sql` and `new_chapter_alerts_rls.sql`.
3. **Two Edge Functions** sharing one module, `supabase/functions/_shared/
   entitlements.ts`. Its `syncCustomer(userId)` reads the customer's active
   entitlements from RevenueCat with the secret key, then upserts or deletes
   the reader's `entitlements` row, and returns `{ active, expiresAt }`. It
   only accepts an id shaped like a Clerk user id. Both functions are
   deployed with `verify_jwt` off and check their own credential (AGENTS.md
   § Connecting, "Edge Functions"):
   - **`revenuecat-webhook`**, called by RevenueCat. The request's
     `Authorization` header must equal `REVENUECAT_WEBHOOK_AUTH`, compared in
     constant time; anything else gets 401. A `TEST` event answers 200 and
     changes nothing. Every other event type syncs every Clerk-shaped id it
     names: `app_user_id`, `original_app_user_id`, `aliases`, and
     `transferred_from` and `transferred_to` for a `TRANSFER` (which has no
     `app_user_id`). The event's own fields are never trusted: the sync
     reads RevenueCat. So duplicate or out-of-order deliveries are harmless.
     It answers within seconds (RevenueCat waits 60, then retries 5 times
     over about 2.5 hours); a failure to reach RevenueCat or the database
     answers 500, so RevenueCat retries. The log names event types and
     counts, never ids or the payload.
   - **`sync-entitlement`**, called by the app with the reader's Clerk
     session token, verified as `delete-account` verifies it (JWKS, issuer,
     expiry). It syncs the caller and nobody else, and answers `{ active,
     expires_at }`. A row synced in the last 10 seconds answers from the
     table without calling RevenueCat, so a reader can't spend the
     project's rate limit.
4. **Secrets and the webhook:**
   - Set `REVENUECAT_SECRET_KEY` and `REVENUECAT_PROJECT_ID` from the
     dashboard's `.env`, through a temporary env file deleted afterwards,
     and confirm each by its stored digest, never by printing it.
   - Generate `REVENUECAT_WEBHOOK_AUTH` (a long random value), write it to
     the dashboard's `.env` without printing it, and set it the same way.
   - **Owner:** RevenueCat → Integrations → Webhooks → a new webhook. URL
     `https://fwjrdzzdtshbqrfkgivd.supabase.co/functions/v1/revenuecat-webhook`;
     Authorization header value: copy `REVENUECAT_WEBHOOK_AUTH` from the
     dashboard's `.env`; events from both production and sandbox; all event
     types. Then send RevenueCat's test event and watch it answer 200.
5. **Proven over HTTP before Part B:**
   - the webhook without the header, and with a wrong one: 401; the test
     event: 200;
   - `sync-entitlement` with no token and with a garbage token: 401;
   - with a throwaway reader made through Clerk's Backend API (as for
     `delete-account`): no plan → `{ active: false }`, and Storage refuses a
     locked chapter's narration under its token;
   - the same reader given a promotional `ad_free` entitlement in
     RevenueCat (its dashboard's customer page, or the REST API if the key
     allows): after a sync, `{ active: true }`, and Storage signs that locked
     narration (200, bytes served); the promotional entitlement revoked and
     synced again: refused again;
   - the throwaway reader deleted afterwards, in Clerk and in RevenueCat.

## Part B — the app

6. **One client call**, in `lib/` (no React): `syncServerPlan()` calls
   `supabase.functions.invoke("sync-entitlement")`, shares one request among
   callers made together, never throws to its caller, and logs failures in
   development only. It never decides access itself: the app's own lock rule
   still reads RevenueCat's SDK (AGENTS.md § State Management Rules).
7. **When the app asks the server to check:**
   - after a purchase or a restore that ends active (`hooks/use-purchase.ts`,
     `finish()`), and before `openUnlockedChapter()` opens the chapter just
     bought, waiting at most about 5 seconds, so a slow answer never holds
     the reader on M10;
   - once per session, at sign-in or start, when the SDK says the plan is
     active, which catches a renewal whose webhook was missed;
   - when the SDK's listener reports the plan turning active.
8. **Putting a late server right, once per open.** Where a chapter opened
   only by the plan (`openedByPlan()`, `types/states.ts`) is refused anyway,
   the app syncs once, then tries once more:
   - **M6** (`hooks/use-now-playing.ts`): a `refused` or `unavailable`
     source, today rechecked by refetching the chapter and the unlocks,
     syncs the plan first when the reader is subscribed;
   - **downloads** (`lib/downloads/queue.ts`, `sign()`): a refusal for a
     subscriber syncs once and signs again once, instead of failing for good;
   - **M5** (after Part C): a chapter whose catalog row says it has text,
     but whose text read comes back empty, syncs and reads once more. Still
     empty, it shows Failed with Retry, never "no text".
   No step here may wait on a JS timer to make progress: Android pauses
   them while the app is in the background (Decisions — 2026-10-02,
   "Autoplay with the screen off stalled; fixed").
9. **Downloads need nothing more.** The queue's lock check already counts
   the plan. A subscriber's downloads of locked chapters are deleted once
   the plan has ended: the online access check, or 30 days offline at the
   latest (Decisions — 2026-09-25, "Downloads").
10. **Tests** for the pure parts: when to sync (subscribed, opened only by
    the plan, not yet tried this open), and that a sync failure leaves the
    chapter's state as it was. The existing suites stay green.

## Part C — locked text on the server

11. **Show the owner the design, and get a yes, before writing it.** It
    changes the dashboard's `chapters_select` policy, whose 2026-09-16
    comment says locked chapters are deliberately not protected at the row
    level. That makes it the third sanctioned change to a dashboard-owned
    object, after the catalog broadcast triggers and the audio policy:
    - **`chapters_select`** becomes: `is_admin()`, or a published book's
      chapter that is free by its own access, unlocked by the caller, or
      opened by `has_active_plan()`. A reader without access to a locked
      chapter then gets no row from `chapters` at all, its `script_text`
      and `audio_path` included. The dashboard sees exactly what it sees
      today: every admin read passes `is_admin()`.
    - **`books_catalog` and `chapters_catalog`** keep listing every
      published chapter, the locked ones included, as M4, M9 and the paywall
      need. They stop running with the caller's RLS (`security_invoker =
      off`): they hold no text, and both select only published books by
      construction. Supabase's advisor will flag them as security-definer
      views. That is expected, and recorded with the reason.
    - **Their grants narrow:** they hold `ALL` for `anon` and
      `authenticated` today (Supabase's defaults), harmless only while they
      run with the caller's RLS. They become `SELECT` for `authenticated`,
      and nothing for `anon`. Check first that no signed-out screen reads
      either view.
12. **Migration and proof**, with the same discipline as Part A:
    - under a reader's token: a free chapter's text reads; a locked one's
      returns no row; unlocked (an `unlocks` row inserted as the server
      would, then removed) or with a plan, it reads;
    - `chapters_catalog` still lists the locked chapter for that reader;
      `books_catalog`'s counts are unchanged; drafts stay invisible; `anon`
      reads nothing;
    - the admin reads everything as before;
    - the dashboard's three gates; and, by the owner, opening a locked
      chapter in the dashboard's chapter editor, unchanged.
13. **Then tidy the app:** the "it is NOT security" comment in
    `hooks/use-chapter-reader.ts`, and AGENTS.md § Before production's
    first item, both become history.

## Part D — account deletion

14. **`delete-account`** replaces its `TODO(paywall)`: after the reader rows
    and before PostHog and Clerk, it deletes the reader's `entitlements` row
    and their RevenueCat customer. "Not found" counts as done, so a retry
    finishes the job; any other failure answers 502 while the reader can
    still retry. The answer gains `revenuecat_customer: "deleted" |
    "already_gone"`. Deleting the customer doesn't cancel a Google Play
    subscription: the app's deletion warning already says so. Prove it with
    a throwaway reader who has a promotional entitlement, as in step 5.
15. **Keep the public pages true** (`src/data/public-pages.ts`, the
    dashboard's AGENTS.md § Public pages): the privacy policy says the
    subscription status is also kept on our servers, so the chapters a plan
    opens can be served, and deleted with the account; the deletion page's
    "What's deleted" adds the subscription status and the record at
    RevenueCat. Publish with the owner's yes, as on 2026-10-01.

Do not: put RevenueCat's secret key, the webhook value or any other secret
in the app or its `.env.local`; let the app write `entitlements` or decide
access from its own claim; grant readers or `anon` anything on
`entitlements`; trust a webhook's own fields over RevenueCat's answer; touch
`books`, `chapters`, `app_settings` or `activity_log` beyond Part C's
policy, and that only with the owner's yes; change the dashboard's UI; add
iOS.

Finish by running `npm run typecheck`, `npm run lint` and `npm test` here,
and `deno check`, the three gates and every verify script in the dashboard
repo. Record the build in both repos' AGENTS.md, and close the gaps it
names (Decisions — 2026-09-25, "Paywall" and "Downloads (prompt 24
review)"; 2026-10-01, "Prompt 22 (second review)" and "Dashboard locks,
seen by a subscriber"; § Before production; § Data Contract's "Still does
not exist"). Then, on the development build, with the owner's fresh Test
Store plan, report:
- a locked chapter's narration playing for the subscriber, from M6 and from
  the mini player, within seconds of buying
- the same chapter downloading for the subscriber, and playing offline
- its text reading in M5 (after Part C)
- reader B (no plan) still locked out of the same chapter in the app, and
  refused by Storage over HTTP
- the plan ending in the Test Store: the narration refused, a playing
  locked chapter stopping (prompt 22's Part D), and its download deleted at
  the next online check
- the webhook's deliveries in RevenueCat's dashboard, each answered 200
- the flagged copy, if any line changed
