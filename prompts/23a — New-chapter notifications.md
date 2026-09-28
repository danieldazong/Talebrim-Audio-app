Read AGENTS.md first and follow it strictly. Do only what is on this page.

> **Reviewed 2026-09-25 against the code, AGENTS.md and `material/`.** The
> review's calls are recorded in AGENTS.md § Decisions — 2026-09-25,
> "New-chapter notifications (prompt 23a review)". The number is 23a so that
> no existing prompt's number changes. It is built before prompts 24 and 25
> (§ Decisions — 2026-09-25, "Build order from here"). What changed, and the
> calls the owner may want to flip:
> - **Frames.** No frame draws the alerts sheet or a notification. The bell
>   is in `material/3.png` (M3). M4 is `material/6.png`, whose `+ My List`
>   pill no frame draws (§ Decisions — 2026-09-25, "M7 as built"). M11 is
>   `material/10.png`, which draws no alerts row; prompt 25 adds it.
> - **No trigger on `chapters`.** A job scheduled every 5 minutes finds new
>   chapters and sends, so no dashboard-owned table is touched: there is no
>   third sanctioned change. *(Flip: a trigger through `pg_net` sends within
>   seconds, at the cost of a trigger on a dashboard table.)*
> - **Bundling and the cap are per book.** A book's new chapters wait until
>   none has arrived for 10 minutes, and a book alerts at most once in 24
>   hours. Chapters held back go into the next alert, never dropped.
>   *(Flip: the numbers.)*
> - **One permission, asked by this prompt only.** Playback never asks
>   (settled in the deferred setup, step 9). The "New chapters" channel is
>   created at "Notify me", never at launch.
> - **Android only**, as billing is: iOS scope is still open.
> - **A phone's token belongs to one account at a time**, through one server
>   function, so a sign-out that couldn't reach the server is put right at
>   the next sign-in on that phone.
> - **The bell opens the alerts sheet**, the same sheet the first My List add
>   shows, to turn alerts on or off. An inbox of past alerts would need a
>   table of what was sent; not built. *(Flip: hide the bell until an inbox
>   is wanted.)*
> - **"Not now" is remembered per account**, and cleared at sign-out with the
>   other per-account state, so another account on the phone is asked once.
>   *(Flip: per device.)*
> - **The lock screen hides the content** on a secure lock screen: every live
>   book is `mature_17`. *(Flip: show it.)*
> - **Fixed:** "iOS" is dropped; step 3's open question is settled; prompt
>   25's "no notification preferences" line predates this prompt and is
>   noted there; Expo Go, the web and the web build's server render never
>   load push code (the lesson of prompts 21a and 22).

**BEFORE THIS PROMPT — STOP until all of these are true:**
1. AGENTS.md § Deferred setup is done: the development build is installed on
   the owner's phone and signs in. Expo Go can't receive remote pushes on
   Android. **Done 2026-09-26** (owner): installed on an itel A662LM,
   Android 12, and signed in. Deferred setup steps 3, 5, 7, 8 and part of 9
   are still open, and none of them blocks this prompt; step 8 blocks
   prompt 24.
2. **Owner, Firebase:** a Firebase project with an Android app for
   `com.talebrim.app`. Its `google-services.json`, downloaded to the repo root:
   it is the app's client config, like the Supabase anon key, and is
   committed. Its FCM V1 service-account key, uploaded to EAS (`eas
   credentials` → Android → Google Service Account → push notifications, FCM
   V1). That key never enters this repo or the app. **Done 2026-09-25:**
   Firebase project `talebrim-4ba77`; the key is on EAS, and no copy is left
   on the PC or in the repo (checked 2026-09-26).
3. **Owner, Expo:** turn on enhanced push security for the Expo project and
   create an access token for it. Without it, anyone who learns a reader's
   push token can send to their phone. The token goes only into the Edge
   Function's secrets (AGENTS.md rule 1). **Done 2026-09-28** (owner). It
   was recorded as done on 2026-09-26, but at the build the account had no
   token and the toggle was off. The token is a robot user's (`supabase-push`,
   Developer role), set by the owner as the function's `EXPO_ACCESS_TOKEN`,
   and enhanced push security is on.
4. **Owner, the icon:** Android draws a notification's small icon as a white
   silhouette. Supply `assets/Image/notification-icon.png`, a white logo on a
   transparent background, 96 × 96 px. Never generated (AGENTS.md § Image
   Generation Rules). Until it exists, build with
   `// MISSING ASSET: notification-icon` beside the plugin entry and without
   the `icon` option.
5. **Owner:** a yes to the migration (step 10) and to the schedule (step 11)
   before `supabase db push` and before the function is deployed.

Design material: none draws this feature. Build the sheet from AGENTS.md
§ Design System and M5a's sheet (`app/paywall/[chapterId].tsx`). The bell is
in `material/3.png`; view it before wiring it.

## Part A — the app

1. **Install** `expo-notifications` (approved 2026-09-25) with `npx expo
   install`. Add its config plugin to `app.json` with the icon (above) and
   `color` set to ember, and set `android.googleServicesFile` to
   `./google-services.json`. It is native: rebuild the development build
   (`EAS_NO_VCS=1 npx eas-cli build --profile development --platform
   android`, AGENTS.md § Decisions — 2026-09-25, "Development build") and
   install it before testing. Check `.easignore` does not exclude
   `google-services.json`.
2. **Check the installed SDK before writing code**, in `node_modules`, and
   report its version and the surface used: `getPermissionsAsync` and
   `requestPermissionsAsync` (with `canAskAgain`),
   `setNotificationChannelAsync` (importance and `lockscreenVisibility`),
   `getExpoPushTokenAsync` (with the EAS project id from `expo-constants`),
   `addPushTokenListener`, `setNotificationHandler`,
   `addNotificationResponseReceivedListener` and the last response for a
   cold start. Report what importing it does in Expo Go on Android and in the
   web build's server render (no `window`).
3. **One module, `lib/push.ts`** (no React, AGENTS.md § lib/), shaped like
   `lib/revenuecat.ts`: `pushAvailable()` is false without a `window`, off
   Android and in Expo Go, and every call is then a no-op. If step 2 finds
   that importing `expo-notifications` logs, throws or reaches for a browser
   where push can't run, it is `require`d on first use there, as
   `lib/revenuecat.ts` loads its SDK. It holds:
   - The "New chapters" channel (id `new-chapters`), default importance, its
     content hidden on a secure lock screen. Created only when the reader
     taps "Notify me", right before the permission request, and when a
     reader who has alerts on signs in. **Never at launch:** Expo documents
     that on Android 13+ the system's prompt is tied to the first channel.
     Confirm on the phone that nothing prompts at launch or on a cold start.
   - The permission: granted, can ask, or blocked (denied with
     `canAskAgain` false).
   - The device's Expo push token.
4. **One sheet, two ways in.** `app/alerts.tsx`, a `transparentModal` like
   M5a, with `from` (`my_list` or `bell`). Move M5a's scrim-and-sheet frame
   into `components/ui/` so both share it (the second sheet of its kind). On
   `raised`, from the top:
   - Alerts off: a bell icon, the Fraunces headline "Get notified when new
     chapters come out?", one line that alerts are only for stories on My
     List, the ember "Notify me" (the sheet's one ember action, as M5a's will
     be), and a muted `TextLink` "Not now".
   - Alerts on: "New chapter alerts are on", and an outlined "Turn off".
   - Blocked by the system: one line that alerts are off in Android's
     settings, and an outlined "Open settings" (`Linking.openSettings()`).
   - `pushAvailable()` false (web, Expo Go): one line that alerts work in the
     Talebrim app for Android, as M10 says of subscriptions.
   - "Notify me" creates the channel, requests the permission, registers the
     token (step 6) and closes the sheet. A refusal closes it too and counts
     as "Not now".
5. **Ask once, at the right moment.** The first time an add to My List
   succeeds on the server (`hooks/use-my-list.ts`'s `onSuccess` for `"add"`,
   where `my_list_added` is tracked, never the optimistic change), M4 opens
   the sheet with `from: "my_list"`, but only when push is available, alerts
   are off, the permission isn't blocked, and this account hasn't answered.
   "Not now", or closing the sheet, is the answer: the app never opens it on
   its own again. Never at launch, never on a cold start. The bell on
   Discover (`components/discover/discover-header.tsx`, a no-op `TODO`
   today) always opens it, with `from: "bell"`: the reader asked.
6. **Per-account state and the token.**
   - A new persisted Zustand slice, `notifications`: `answered` and
     `enabled`. Per account, so `clearUserScopedState()` (`lib/session.ts`)
     clears it with the others, and ships with a `version` and a `migrate`
     from its first commit (AGENTS.md § store/).
   - The server knows a phone's token through one function (step 10),
     `set_push_token(token, enabled)`. Called with `true` when alerts are
     turned on, when the token changes (`addPushTokenListener`), and at each
     sign-in with alerts on. Called with `false` when they are turned off, at
     each sign-in with them off (so a token a previous account left behind
     on this phone is released), and at sign-out.
   - **Sign-out:** in `hooks/use-sign-out.ts`, after the parity flush and
     before Clerk's `signOut()`, while this account's token still works,
     bounded as the flush is (about 2 seconds) so sign-out never hangs.
     Offline, the next sign-in on the phone puts it right.
7. **The tap.** In the root navigator (`app/_layout.tsx`, inside the auth
   gate), the response listener and the cold start's last response open M4
   with `router.push`, only when signed in and past onboarding, only for a
   `book_id` that passes `isUuid()`, and each response once. Where Read and
   Listen resume from there. `notification_opened` with the `book_id`.
8. **In the foreground**, `setNotificationHandler` shows the banner without a
   sound. **A signed-out phone** opens nothing from a tap.
9. **Analytics** (prompt 21a), in `AnalyticsEvents`: `notify_prompt_shown`,
   `notify_prompt_accepted` and `notify_prompt_declined`, each with `from`
   (`my_list` or `bell`); `alerts_turned_off`; and `notification_opened`
   with `book_id`. Never a token.

## Part B — the server, in the dashboard repo

10. **Migration**, in `story-app-dashboad/supabase/migrations`, with § Phase
    2's discipline (additive only, RLS from the start, regenerate types and
    diff them, the dashboard's three gates):
    - `push_tokens`: `id`, `user_id` text defaulting to the caller's `sub`,
      `token` text unique, `platform` (`android` only), `created_at`,
      `updated_at` (the dashboard's `set_updated_at()` trigger). RLS on.
      Readers may select their own rows and nothing else; `anon` nothing.
    - `set_push_token(p_token text, p_enabled boolean)`: `security definer`,
      `set search_path = ''`, for `authenticated` only. Rejects a token that
      isn't an Expo push token. With `true` it removes the token from any
      other account and upserts it for the caller; with `false` it deletes
      the token's row, whoever holds it: only the phone knows its token.
    - `chapter_alerts`: `chapter_id` primary key (references `chapters`, on
      delete cascade), `book_id` (references `books`, cascade), `found_at`,
      `sent_at`. Server only: no grants to `authenticated` or `anon`.
    - `book_alerts`: `book_id` primary key (cascade), `last_sent_at`. Server
      only.
    - `push_tickets`: Expo's ticket id, the token, `created_at`, for the
      receipts. Server only.
    - **Backfill:** every chapter already readable in a published book goes
      into `chapter_alerts` as sent, so the first run announces nothing old.
    - Enable `pg_cron` and `pg_net` if they aren't (check first).
    - Nothing is added to `books`, `chapters`, `app_settings` or
      `activity_log` (AGENTS.md rule 2): new tables may reference them, as
      the reader tables do.
    - Verify with impersonation, as `supabase/verify/reader_tables_rls.sql`
      does: reader A never sees B's tokens; `set_push_token` moves a token
      from A to B and releases it; readers can't read or write the three
      server tables; `anon` can do nothing.
11. **The Edge Function**, `notify-new-chapters`, the project's first, in
    the dashboard repo's `supabase/functions/`. `pg_cron` calls it every 5
    minutes through `pg_net`, with a shared secret kept in Supabase Vault
    and in the function's secrets; the function rejects any other caller.
    Check against Supabase's docs how a function is called without a JWT
    under this project's `sb_…` keys. The service-role key it uses is its
    own environment's, never the app's (AGENTS.md rule 1). Each run:
    - Finds chapters that are readable (`has_text` or `has_audio`) in
      published books and have no `chapter_alerts` row, and adds them with
      `found_at`. A draft book's chapters are never found.
    - For each book with unsent chapters: sends once its newest was found at
      least 10 minutes ago and its `last_sent_at` is 24 hours old or unset.
      The readers with the book in `library_items`, their tokens, one message
      per token on channel `new-chapters`, with `book_id` as the only data,
      through Expo's push API in batches of 100 with the access token. Then
      the chapters are marked sent and `last_sent_at` set. A book on no one's
      list is marked sent with nothing sent.
    - A ticket or a later receipt (checked on a run at least 15 minutes on)
      reporting `DeviceNotRegistered` deletes that token. Tickets older than
      a day are dropped.
    - A failure leaves the chapters unsent for the next run. Nothing it does
      can fail a dashboard write: it never runs inside one.
12. **Copy.** One chapter: "New chapter of {book title}", then "Chapter {n}:
    {chapter title}", or "Chapter {n}" untitled. Several: "{count} new
    chapters of {book title}", then "Chapters {first}–{last}". Plain, never
    promotional. Flag every string for the owner, the sheet's included.

Do not: ask for the permission at launch or more than once on the app's own
initiative; create the channel at launch; notify about a book that isn't on
the reader's My List; send promotional or marketing notifications; put the
service-role key, the FCM key or the Expo access token in the app or this
repo; notify a signed-out phone; add a trigger or anything else to a
dashboard-owned table; build an inbox; add iOS.

Finish by running `npm run typecheck`, `npm run lint` and `npm test` here, and
the dashboard's three gates and its RLS verification there. Record the build
in both repos' AGENTS.md. Then, on the development build, report:
- the SDK version and the surface used
- nothing prompting at launch, and the permission flow, including "Not now"
  never opening the sheet again and the bell turning alerts on and off
- a chapter published in the dashboard reaching a phone with that book on My
  List within about 15 minutes, and not reaching one without it
- three chapters published within minutes arriving as one alert
- tapping the alert opening M4, from a cold start too
- sign-out stopping the alerts, and a second account on the same phone never
  receiving the first one's
- the flagged copy list
