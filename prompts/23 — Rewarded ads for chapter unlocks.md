Read AGENTS.md first and follow it strictly. Do only what is on this page.

# 23 — Free ways to unlock a chapter: wait-for-free and rewarded ads

> ## DEFERRED TO VERSION 2 — DO NOT BUILD ANY OF THIS FOR VERSION 1
>
> **The owner's decision, 2026-10-06:** version 1 is subscription-only.
> Talebrim Unlimited is the only way past a lock; M5a has `See plans` and
> nothing else, and the app has no ads and no free unlock (AGENTS.md,
> Decisions — 2026-10-06, "Version 1 is subscription-only"). This page is
> kept as the version 2 spec.
>
> **Where it stands:**
> - **Part A (wait-for-free) was built on 2026-10-03 and taken out again on
>   2026-10-06.** The app code is archived in `docs/v2/free-unlocks-app.patch`
>   (how to bring it back: `docs/v2/README.md`). Its server side is the
>   dashboard repo's migration `20261003120000_wait_unlock.sql`, which stays as
>   history, and which `20261006120000_remove_wait_unlock.sql` undid in the
>   database. Its verify script is `supabase/verify/v2/wait_unlock_rls.sql`. The
>   record of what it taught (including a countdown bug that only a live run
>   found) is AGENTS.md, Decisions — 2026-10-03, "Prompt 23, Part A as built".
> - **Parts B and C were never started.** Nothing of them is installed,
>   configured or deployed.
> - **When version 2 starts,** review this page against the code again (the
>   prompt review workflow). The steps below were written on 2026-10-03 and
>   assume the app of that day; step 7 (M5a) in particular must be read against
>   whatever M5a has become, and the Part A steps that say "write the
>   migration" are done, in the archive.

> **Reviewed and rewritten 2026-10-03**, from the code as built through prompt
> 22a, the live database, `react-native-google-mobile-ads` 17.2.0 (its
> published package, read without installing it) and Google's AdMob
> documents. It replaces the draft of 2026-09-25, whose step 7 (the app
> inserting `unlocks` rows), step 13 (no server check) and step 16 (which
> button is the ember) conflicted with AGENTS.md. AGENTS.md, Decisions —
> 2026-10-03, "Prompt 23 review", records what changed and why. Review this
> page against the code again before building if anything has changed since
> (the prompt review workflow).
>
> **What it builds.** Two free ways to open ONE locked chapter, both on M5a
> (the locked chapter's sheet, `app/paywall/[chapterId].tsx`), under the
> "See plans" button that is there already:
>
> - **Unlock free** (wait-for-free): one free unlock per reader per story
>   every 24 hours, by the server's clock. Part A.
> - **Watch an ad to unlock**: a rewarded ad. One watched ad opens exactly
>   the chapter the reader tapped. Part B.
>
> Both unlocks are permanent: one row per reader and chapter in `unlocks`
> (AGENTS.md, Decisions — 2026-09-23). **The server writes both, never the
> app.** Readers hold SELECT on `unlocks` and nothing else, on purpose: an app
> that could insert there would let anyone replaying their own token unlock
> the whole catalogue.
>
> **Decided by the owner on 2026-10-03:**
>
> - **"See plans" stays the sheet's one ember button.** The two free options
>   are teal outlined buttons (`Button`, variant `accent`) under it. (The
>   2026-09-25 plan made "Unlock free" the ember while it was available. The
>   owner chose the stable ember instead, as built and seen on 2026-10-01.)
> - **A watched ad becomes an unlock only through Google's own signed
>   callback to a server function** (AdMob server-side verification, "SSV").
>   The app never claims an ad unlock.
>
> **Decided in this review, which the owner may flip:**
>
> - **Two parts, with a stop between them.** Part A needs no AdMob account
>   and no new build, so the owner can use it as soon as it is built. Part B
>   needs the owner's AdMob account, a new native dependency, a development
>   build made after it and a new Edge Function. Part C (the public pages and
>   the records) goes with Part B and is done before any ad can reach a
>   reader. _(Flip: one build of everything, after AdMob.)_
> - **The reader waits a few seconds after an ad.** Google's callback is not
>   instant ("may experience delays", its own words), and only the server may
>   open the chapter. The sheet says "Unlocking your chapter…" meanwhile, and
>   never makes the reader watch twice.
> - **Not a flip, required:** Google's consent message (its UMP SDK, bundled
>   in the library) for readers in the EEA and UK; it also covers regulated
>   US states. The 2026-09-25 draft said to report this as a gap. It is built
>   in Part B, Android only. Apple's tracking prompt waits for the iOS series.
>
> **Two risks to read before Part B** (full text in its gate):
>
> - AdMob's content rules mention "graphic sexual text" and "non-consensual
>   sexual themes". The live catalogue is all `mature_17` and includes
>   `dark_romance`. Ads may be restricted or refused. The plan (Talebrim
>   Unlimited) and Part A work without ads.
> - The server function that Google calls is public. It must verify the
>   signature AND that the ad unit is the owner's own (step 17).
>
> **Images.** None. No frame draws M5a or its free options (AGENTS.md
> § M5a is the spec), and this prompt cites no image path. The frames nearby
> are untouched: M10 `material/11.png`, M9's bar `material/5.png`, M11
> `material/10.png`.
>
> **M5a after this prompt, top to bottom:** the story's cover, "Keep reading
> {story}", the lock and the chapter, at most three benefits, the ember
> `See plans`, `Unlock free` (Part A), `Watch an ad to unlock` (Part B), a
> message line, then "Not now", Restore purchases and Manage subscription.
> Never shown for a chapter the reader can already open, so neither free
> option is ever offered to a subscriber, or for a free or unlocked chapter.

---

## Part A — Unlock free (no AdMob, no new build)

**BEFORE PART A — verify these first; do not rely on this page:**

1. **Prompts 22 (Parts A, B, D) and 22a are built.** The server already
   opens a locked chapter's text and its narration for a reader who holds an
   `unlocks` row (`chapters_select` and `public.can_play_audio()`), so a new
   unlock row needs no further policy change.
2. **The live state, read-only, on the day you build** (it was this on
   2026-10-03): `unlocks_source_check` allows `ad` and `purchase`;
   `unlocks_user_chapter_key` is unique on `(user_id, chapter_id)`; readers
   hold SELECT only (`authenticated`), `service_role` everything; no `wait`
   function exists; the table is empty. If any of it differs, stop and report.
3. **Run the dashboard's verify scripts first**, all of them, and expect them
   to pass before you change anything: `reader_tables_rls.sql`,
   `new_chapter_alerts_rls.sql`, `audio_read_policy.sql`,
   `entitlements_rls.sql` and `locked_text_rls.sql`.

**The steps**

1. **Show the owner the migration and get a yes before `supabase db push`.**
   Write it in the dashboard repo, `supabase/migrations/<next timestamp>_wait_unlock.sql`
   (the only migration history; this repo never grows one). Dry-run it first
   as `begin; …; rollback;` through `npx supabase db query --linked -f`. It is
   additive on this app's own table, plus two functions. It touches no policy,
   no view, and nothing in `books`, `chapters`, `app_settings` or
   `activity_log`.
2. **The migration:**
   - `unlocks_source_check` becomes `source in ('ad', 'purchase', 'wait')`
     (drop and add, in one transaction, with `set local lock_timeout`).
   - `public.wait_unlock_status(p_book_id uuid) returns integer`: the whole
     seconds, rounded up, until the caller's next free unlock in that story;
     0 when one is available, and 0 for a caller who never claimed. It counts
     only `source = 'wait'` rows of that book's chapters: the newest
     `created_at` plus 24 hours, against the server's `now()`.
   - `public.claim_wait_unlock(p_chapter_id uuid) returns jsonb`. Its answers
     are data, never errors, in this order: 1. no caller, no such chapter, or its book isn't published →
     `{"status":"unavailable"}`; 2. the chapter is `access = 'free'`, or the caller already holds an
     `unlocks` row for it → `{"status":"not_locked"}`; 3. `public.has_active_plan()` → `{"status":"subscribed"}` (a subscriber
     never spends the free unlock); 4. take `pg_advisory_xact_lock(hashtextextended(<caller> || ':' || <book
id>, 0))`, then check 2 and the cooldown again inside the lock, so two
     claims at once for one story cannot both pass; 5. cooldown running → `{"status":"cooldown","seconds_left":N}`; 6. insert `(caller, p_chapter_id, 'wait')` with `on conflict do nothing`,
     and answer `{"status":"claimed"}`.
   - Both are `security definer`, `set search_path = ''`, and read `chapters`
     as their owner, so 22a's withholding of locked rows doesn't hide the
     chapter from them. The caller is always `auth.jwt() ->> 'sub'`; nothing in
     an argument says who is asking.
   - Grants: `revoke all … from public, anon`, then `grant execute … to
authenticated`. The project's default privileges hand `anon` EXECUTE on
     every new function (2026-09-28's dry run caught it), so revoke it
     explicitly and prove it.
3. **`supabase/verify/wait_unlock_rls.sql`**, in the style of
   `entitlements_rls.sql`: fake readers, impersonated with `SET ROLE` and
   `request.jwt.claims`, everything rolled back, a pass/fail report. At least:
   a first claim on a locked chapter → `claimed`, with exactly one `wait` row
   for that reader and chapter; a second chapter of the same story → `cooldown`
   with 0 < seconds ≤ 86400 and no new row; a chapter of another story →
   `claimed`; the status function agrees with every one of those; with the
   newest `wait` row moved back 24 hours (as the verify's own setup), the next
   claim → `claimed`; a free chapter and an already unlocked one →
   `not_locked`, and no cooldown is spent; a reader with an active
   `entitlements` row → `subscribed`; an unpublished book's chapter and a
   random uuid → `unavailable`; `anon` → permission denied on both functions
   (42501); a reader's direct `insert`, `update` and `delete` on `unlocks` →
   still refused (42501); `unlocks_source_check` accepts `wait` and refuses any
   other word (23514); reader B's claim never touches reader A's rows. Run the
   five existing verify scripts again afterwards. All must pass.
4. **Prove it over HTTP** with throwaway readers made through Clerk's Backend
   API, as 22a did (read the dashboard's `.env` in-process, never print a key;
   delete every throwaway reader afterwards through `delete-account`): claim a
   locked chapter → `claimed`; that reader then reads the chapter's text
   and signs its narration (the locked chapter's row and file are served);
   a second chapter of the story → `cooldown`; a reader with a plan row →
   `subscribed` and no row written; a free chapter → `not_locked`; no token → 401. Fingerprint every real reader's `unlocks` rows (count and md5 of ids)
   before and after: unchanged.
5. **Types.** Regenerate in both repos as AGENTS.md § Phase 2 describes
   (`--linked` in the dashboard, `--linked --schema public` here) and diff:
   only the two functions are added. Run the dashboard's three gates.
6. **App, data.**
   - `lib/query-keys.ts`: a `waitUnlock` root, `status(userId, bookId)`, and
     add that root to `NEVER_PERSISTED` in `lib/query-client.ts`: a countdown
     must never come back from disk.
   - `lib/queries/unlocks.ts`: `waitUnlockStatusOptions(userId, bookId)`
     (`supabase.rpc("wait_unlock_status", { p_book_id })`, `staleTime: 0`,
     enabled only for a locked chapter and a known user) and
     `claimWaitUnlock(chapterId)` (`supabase.rpc("claim_wait_unlock", {
p_chapter_id })`).
   - `lib/unlock.ts` (new, pure, tested): `parseWaitClaim(value: unknown)` →
     `claimed | cooldown(secondsLeft) | not_locked | subscribed | unavailable |
failed` (anything else, a missing field or a non-number is `failed`: the
     answer is untrusted data); `formatCountdown(seconds)` → "5h 12m", "42m",
     "less than a minute", and its spoken form; and the rule for which free
     options M5a shows.
7. **App, M5a** (`app/paywall/[chapterId].tsx`, with a hook,
   `hooks/use-unlock-options.ts`). Replace both `TODO(unlocks)` markers (the
   header comment at line 27 and the block at line 172).
   - `Unlock free` is a `Button` variant `accent`, directly under `See plans`
     with 12dp between them. `See plans` stays the one ember element: add no
     second.
   - Its states, each distinct, none a spinner on a blank sheet:
     - status loading: disabled, label "Unlock free";
     - available: enabled, with the line "One free chapter per story every 24
       hours.";
     - cooldown: disabled, the label itself is "Next free chapter in 5h 12m";
     - claiming: the button's `loading`;
     - offline: disabled, "Connect to the internet to unlock.";
     - the claim failed: enabled again, "Couldn't unlock this chapter. Check
       your connection and try again." in a polite live region. No
       `Alert.alert`, no red toast.
   - **The countdown trusts the server, never the phone's clock.** Show the
     seconds the server returned minus the time since that answer, measured
     with `performance.now()`. Refetch the status when it reaches 0 and every
     time the app returns to the foreground: never carry a count across a
     background, because Android's monotonic clock may not tick while the
     phone sleeps. Redraw it at most once a minute, and announce it to screen
     readers no more often than that.
   - After a claim: `claimed`, `not_locked` and `subscribed` refetch the
     reader's unlocks (and, for `subscribed`, ask the server about the plan
     with `syncServerPlan()`), and M5a's existing effect then replaces the
     sheet with the chapter once `usePaywallChapter()` says `open`. Do not
     navigate by hand, and never open the chapter on `claimed` alone: only the
     unlock row, read back, opens it. `cooldown` refetches the status.
     `unavailable` shows the failed line.
   - Every label says what the button does and its state ("Unlock this chapter
     free. One free chapter per story every 24 hours."; "Unlock free. Not
     available: next free chapter in 5 hours 12 minutes.").
   - **Check the sheet's height** at 360 × 640dp and at 1.3× text with every
     state showing. `Sheet` doesn't scroll today. If the content doesn't fit,
     make M5a's body scroll inside the sheet's own height (never the
     benefits' count or the buttons' sizes), and say so in the report.
8. **Analytics** (`lib/analytics.ts`, typed, ids and fixed words only, never
   a title or a time): `unlock_offered` (`book_id`, `chapter_id`, `wait`,
   `ad`: which free options showed, once per open once the status is known),
   `wait_unlock_claimed` (`book_id`, `chapter_id`), `wait_unlock_unavailable`
   (`book_id`, `chapter_id`, `seconds_left`, once per open when the countdown
   shows), `unlock_recorded` (`book_id`, `chapter_id`, `source`: `wait` | `ad`,
   `seconds`: from the tap to the unlock being read back) and
   `unlock_record_failed` (`book_id`, `chapter_id`, `source`, `kind`:
   `network` | `timeout` | `refused`).
9. **Tests** (Jest, beside the others): `parseWaitClaim` with every answer and
   with garbage; `formatCountdown` at 0, 59, 60, 3 599, 3 600, 43 200 and 86 400
   seconds; the free-option rule for locked, open, subscribed, offline and
   status-failed; the status key is never persisted
   (`query-client.test.ts`). Typecheck, lint and the whole suite pass.
10. **On the phone**, signed in as a reader with no plan (reader B, or the
    owner's account once its Test Store plan has ended: read RevenueCat's
    customer for that account first, since a plan makes `claim` answer
    `subscribed`; the owner's "View as a free reader" switch changes only what
    the phone shows, not what the server knows). Signing out deletes the
    phone's downloads: tell the owner first. Check, and report what you saw: a locked chapter opens M5a with
    `Unlock free` enabled; the tap opens the chapter's text within about a
    second; a second locked chapter of that story shows the countdown;
    another story's locked chapter is available; airplane mode; a cold
    restart keeps the countdown right; the sheet at the largest text size.
11. **STOP.** Report Part A, with the owner's reminders. Part B starts only
    when the owner says go and the gate below is true.

---

## Part B — Watch an ad to unlock (needs the owner's AdMob, a new build)

**BEFORE PART B — STOP until all of these are true. Confirm each by name, never
from the owner's word alone** (prompt 23a's "Done" was wrong once):

1. **Part A is built, and the owner has seen it work.**
2. **Owner, in AdMob** (give these directions step by step; the owner needs
   them):
   1. admob.google.com, signed in with the Nouvrix Google account → create the
      AdMob account (country, time zone and currency). The payments profile
      can come later.
   2. Apps → Add app → Android → not yet on Google Play → name "Talebrim" →
      copy the **App ID** (`ca-app-pub-…~…`).
   3. Ad units → Add ad unit → Rewarded → name "Chapter unlock" → reward item
      "chapter", amount 1 → under **Server-side verification** enter the
      callback URL `https://fwjrdzzdtshbqrfkgivd.supabase.co/functions/v1/admob-ssv`
      (add it once step 17 has deployed the function) → copy the **Ad unit ID**
      (`ca-app-pub-…/…`; its digits after the slash are what the function
      checks).
   4. Privacy & messaging → create the European regulations message and the US
      states message for the app, and publish them.
   5. Settings → Test devices → add the owner's phone (read its id from
      logcat the first time ads load: "Use … setTestDeviceIds").
      The App ID and the Ad unit ID are not secrets, and the owner may paste them
      in chat. No AdMob login ever goes in the repo.
3. **Owner, the content rules.** Read AdMob's two policy pages themselves,
   against the catalogue, and say in the owner's own words that they accept the
   risk. What they said when read on 2026-10-03 (a summary: the pages rule):
   - Google Publisher Policies do not allow content that includes graphic
     sexual text, image, audio, video or games, or non-consensual sexual
     themes, simulated or real
     (https://support.google.com/admob/answer/10502938).
   - Separately, content that is sexually gratifying or sexually suggestive is
     _restricted_: fewer ad sources bid on it, so fewer ads and lower earnings
     (https://support.google.com/admob/answer/10437795).
   - AdMob reviews an app before real ads serve (its console shows the
     status); test ads work before that.
     If AdMob refuses or limits the app, Part B ships nothing and the free
     routes are Part A and the plan. The owner decides then, not the agent.
4. **The owner's yes**, each separately: the new native dependency and the
   development build after it; the new Edge Function and its secret; the
   public pages' change (Part C).

**The steps**

12. **Check the SDK you installed**, not this page: `node_modules/
react-native-google-mobile-ads` (17.2.0 on 2026-10-03, peers `expo >=47`
    and `react-native >=0.86.0`, both met). Confirm and report: the default
    export's `initialize()` and `setRequestConfiguration()`; `RewardedAd`,
    `RewardedAdEventType.LOADED` and `.EARNED_REWARD`, `AdEventType.CLOSED` and
    `.ERROR`; `RequestOptions.serverSideVerificationOptions` (`userId`,
    `customData`); `useRewardedAd({ adUnitId, requestOptions, autoLoad })` and
    its `status` (`idle | loading | loaded | showing | closed | no-fill |
error`), `earnedReward`, `show`, `load`, `retry`, `destroy`; `AdsConsent`
    (`gatherConsent`, `getConsentInfo` → `canRequestAds`, `status`,
    `privacyOptionsRequirementStatus`, `showPrivacyOptionsForm`); `TestIds.REWARDED`.
    Where the real package differs from this list, the package wins: say so.
13. **Install** with `npm install react-native-google-mobile-ads` (it isn't in
    Expo's version table, so not `expo install`), then rewrite the lock with
    `npx npm@11.12.1 install --package-lock-only` (AGENTS.md, Decisions —
    2026-09-25, "Development build"). - `app.json` plugin: `["react-native-google-mobile-ads", { "androidAppId":
"<the App ID>" }]`. The option names are `androidAppId` and `iosAppId`
    (camelCase). Leave `androidSdk` unset (the default is the classic SDK;
    "nextgen" is Google's newer one and nothing here needs it). Leave `iosAppId`
    out: iOS isn't built, and the plugin prints one warning for it until the
    iOS series. Until the owner's App ID exists, use Google's sample
    `ca-app-pub-3940256099942544~3347511713`, and **a store build must never
    carry it**: prompt 22's step 17 and this prompt's step 23 check it. - The development build, with the owner's yes, as before:
    `EAS_NO_VCS=1 npx eas-cli build --profile development --platform android`.
    Install it over USB (`adb -d install -r`, which keeps the app's data). - Then `aapt dump permissions` on the APK. Report every permission the
    library added (the advertising ID one among them) for Play's forms, and
    confirm `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` are still
    blocked and `allowBackup` is still false.
14. **`lib/ads.ts`**, the one ads client, shaped like `lib/revenuecat.ts` (read
    it first). The SDK is `require`d inside it, never imported at the top of a
    module, and typed with `import type`.
    - `adsAvailable()` is true only inside the Android app (not the web or its
      server render, not Expo Go) with a usable unit.
    - **Unit selection, one function, tested:** a development build uses
      `TestIds.REWARDED`; a store build uses
      `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID` and, if it is missing, has **no ads**:
      it never falls back to a test unit. A development build uses the live unit
      only when that variable and `EXPO_PUBLIC_ADMOB_TEST_DEVICE` (the phone's
      hashed id, registered through `testDeviceIdentifiers`) are both set, so a
      live unit is never served to an unregistered device. Neither variable is
      a secret, and `EXPO_PUBLIC_ADMOB_TEST_DEVICE` never goes to EAS's
      production environment.
    - **Expect no server callback from Google's demo unit.** It isn't in the
      owner's account, so no callback URL of ours is set on it (Google's
      documents don't say; step 19 finds out). A development build on
      `TestIds.REWARDED` would then never get an unlock: log that once in
      development (`[ads] test unit: no server callback, no unlock will arrive`).
      The end-to-end proof in step 19 uses the live unit on the registered test
      device.
    - `releaseAds()` destroys any loaded ad. Wire it into
      `clearUserScopedState()` (`lib/session.ts`) beside `releaseAudio()`: an ad
      loaded for one account carries that account's id in its callback.
    - A development-only log, `[ads]`, for consent status, which unit kind, and
      each event, as the other modules do.
15. **Consent, before any ad request.** `lib/ads.ts` runs it once per session,
    the first time an ad is about to be offered, never at launch:
    `AdsConsent.gatherConsent()`, then `getConsentInfo()`; only if
    `canRequestAds` is true, `setRequestConfiguration({
tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false, … })`
    and then `mobileAds().initialize()`. (The audience is adults, and M1 says
    18+.) Leave `maxAdContentRating` unset. - M11 gets one row, "Privacy choices", in the Account group, drawn only when
    `privacyOptionsRequirementStatus` is `REQUIRED`, opening
    `showPrivacyOptionsForm()`. It is in no frame: for design review. - To test the European message, set `debugGeography` to the EEA in
    development only, and report what the form looked like.
16. **Analytics**, typed, beside Part A's: `ad_requested` (`book_id`,
    `chapter_id`: the reader tapped the button), `ad_unavailable` (`book_id`,
    `chapter_id`, `kind`: `no_fill` | `error` | `not_ready` | `consent`),
    `ad_rewarded` (the SDK's earned-reward event), `ad_dismissed_early`. No
    ad unit, no advertising ID, no reward detail.
17. **The server function `admob-ssv`**, in the dashboard repo. Show the
    owner the code and get a yes before deploying it or setting its secret.
    - Files: `supabase/functions/admob-ssv/index.ts`, with the pure parts in
      `supabase/functions/_shared/admob.ts`; reuse `mirrorDatabase()` and
      `isClerkUserId()` from `_shared/entitlements.ts`. `config.toml` gets
      `[functions.admob-ssv]` with `verify_jwt = false` and a comment: Google
      calls it, with no Supabase token, and the function verifies the callback
      itself. Deploy with `--no-verify-jwt --use-api`.
    - One new secret, `ADMOB_AD_UNIT_ID`: the digits after the slash of the
      owner's Ad unit ID. Set it through a temporary env file, never printed,
      and confirm it by its stored digest, as every other secret was.
    - **Verifying a callback** (Google's SSV document and its key list were
      read on 2026-10-03):
      1. `GET` only; anything else is 405. Take the **raw query string**. Google
         sends `ad_network`, `ad_unit`, `custom_data`, `reward_amount`,
         `reward_item`, `timestamp`, `transaction_id`, `user_id`, then
         `signature` and `key_id` last. The signed message is everything
         before `&signature=`, exactly as received (never re-encoded or
         re-ordered).
      2. The keys are at `https://www.gstatic.com/admob/reward/verifier-keys.json`:
         `{ "keys": [{ "keyId": number, "pem": …, "base64": … }] }`, served with
         `Cache-Control: max-age=0`. Cache them in memory for at most an hour,
         and refetch once when a `key_id` isn't in the list.
      3. The signature is ECDSA P-256 over SHA-256, base64url, **ASN.1 DER
         encoded**. WebCrypto's `verify` wants the raw 64-byte `r ‖ s`, so
         convert it (mind the leading zero bytes of a 33-byte integer). Import the
         key from its `base64` as SPKI. Unit-test it with a locally generated
         key pair whose signature you convert _to_ DER, since that is what Google
         sends.
      4. After the signature, and only then: **`ad_unit` must equal
         `ADMOB_AD_UNIT_ID`** (otherwise 403). This one matters most: anyone with
         an AdMob account could point their own unit's callback at this URL and
         receive validly signed callbacks carrying any `user_id` and
         `custom_data` they like. Google's document shows `ad_unit` as the
         digits alone: confirm the form it really sends with the console's test
         tool before relying on it, and compare in that form.
      5. `timestamp` within the last 24 hours; `user_id` must pass
         `isClerkUserId()`; `custom_data` must be a uuid.
      6. The chapter must exist in a published book (service-role read);
         otherwise answer 200 and write nothing.
      7. Insert `(user_id, chapter_id, 'ad')` into `unlocks`, ignoring a
         duplicate. A replayed callback therefore changes nothing.
    - **Status codes:** 200 for a written or deliberately ignored callback; 400
      malformed; 403 a bad signature, an unknown key or a foreign ad unit; 405;
      500 for a failure that may pass (the key list, the database), so Google
      retries (it retries up to five times, a second apart). The log holds the
      outcome and counts only, never a user id.
    - **Prove it:** the unit tests above, plus Deno's `deno check`; AdMob's own
      callback test tool in its console (a signed callback with test values: the
      function answers 200 and writes nothing, and say so); then a real callback
      from the phone (step 19).
18. **App, the ad flow** (`hooks/use-rewarded-unlock.ts`, and M5a's third
    button). Use `useRewardedAd` with `requestOptions.serverSideVerificationOptions
= { userId: <the Clerk id>, customData: <the chapter id> }`, so Google's
    callback names the reader and the one chapter. A new ad instance for each
    chapter the sheet shows. - **Opt-in.** An ad is requested to be shown only by the reader's tap on
    `Watch an ad to unlock`, whose line above the tap says what happens and
    what they get ("A short video ad, then this chapter opens."). Never
    autoplay, never on a screen's entry, a launch, a chapter's end or a timer. - **Preload on M5a's mount**, so the ad is ready by the tap. Never retry on
    its own: after `no-fill` or `error` the line says "No ad is available
    right now." with a `TextLink` "Try again", which is `retry()`. No ad is a
    normal state, not an error. - **The reward is the SDK's earned-reward event and nothing else**
    (`earnedReward`): not the ad closing, not a timer, and never a guess. A
    reader who dismisses the ad early gets nothing: the line says "Watch the
    whole ad to unlock this chapter.", the old ad is destroyed and a new one
    loads, and the button stays disabled until it has. - **After the reward, wait for the server.** Refetch the reader's unlocks
    every 1.5 seconds for 20 seconds, while the sheet is up. M5a's own effect
    opens the chapter the moment the row appears. The button is disabled and
    the line reads "Unlocking your chapter…" (a polite live region). After 20
    seconds: "Taking longer than usual. This chapter opens as soon as it
    arrives.", and keep checking every 5 seconds for two minutes. If the row
    still hasn't come, send `unlock_record_failed` (`kind: timeout`) and stop.
    The unlock is permanent, so it appears at the next unlocks read whenever
    the callback lands, and the reader never watches twice for one chapter. If
    the app is closed meanwhile, nothing is lost. - **Audio.** `flushWithin(2_000)` the parity writer, then `pausePlayback()`
    and remember whether it was playing, before `show()`. If the ad closes with
    no reward and audio was playing, resume it (`togglePlayback()`). Don't stop
    or release the player (`lib/audio/player.ts`). - **Never offer an ad where none is due:** M5a already isn't shown for an
    open chapter. Also hide the button, with no dead space, where `adsAvailable()`
    is false: the web preview and Expo Go. Where ads can't run on the Android
    app itself (no unit, consent refused), draw the button disabled with
    "Ads aren't available right now." - **Teardown** on both exits (reward, dismissal) and on unmount while
    loading or showing: every listener removed, the ad destroyed, nothing left
    to fire against a stale chapter id. The hook owns the ad; use its
    `destroy()`. - States, each distinct: loading ("Getting an ad ready…"), ready, no ad,
    consent needed, unlocking, slow, dismissed early. No `Alert.alert`, no
    red toast. `Button` variant `accent`, with a leading play icon. The
    accessible label says what it does and its state. - Add `unlock_offered`'s `ad` flag, and the events of step 16.
19. **Tests and proofs.**
    - Jest: the unit-selection rule (a store build never gets a test unit and
      has no ads without the variable; a development build uses the live unit
      only with a registered test device); the availability matrix; the polling
      bounds as pure functions; `clearUserScopedState()` releases the ad (in
      `downloads.test.ts`'s sign-out order, with a control run that fails
      without it).
    - Deno: the signature tests of step 17.
    - **On the phone, with the live unit on the registered test device and the
      callback URL set in AdMob:**
      - dismiss an ad early: no `source = 'ad'` row appears (read `unlocks`
        with the service role before and after: count and ids);
      - watch one to the end: exactly one `source = 'ad'` row, for exactly the
        tapped chapter, appears; report how many seconds after the reward
        (Google says callbacks can lag);
      - the chapter opens by itself, with its text and its narration;
      - a subscriber, and a chapter already unlocked, are never offered an ad;
      - airplane mode, and the web preview and Expo Go (the button isn't drawn);
      - the European consent form, with `debugGeography` on the EEA.
    - If Google sends no callback for a test ad on the live unit, say so
      plainly and prove the end to end another way the owner agrees to: do not
      assume it.
20. **STOP.** Report Part B with the owner's reminders. Part C goes with it.

---

## Part C — The pages, the records and Play (before an ad reaches a reader)

21. **The dashboard's public pages** (`src/data/public-pages.ts`; the owner's
    yes, then `dev`, then `main` fast-forwarded, as 22a did; check the live
    pages afterwards). Rewarded ads make these untrue today:
    - Privacy, its introduction (about line 86): "We don't sell your personal
      information, and we don't use it for advertising." Say what is true: we
      don't sell it, and when you choose to watch a rewarded ad, Google AdMob
      receives your device's advertising ID, IP address and device details to
      serve and measure it.
    - "What we collect", "Who processes it for us" (add Google AdMob: the ads
      you choose to watch, and your choices about them) and "Your choices and
      rights" (Profile → Privacy choices where your region requires it, and the
      phone's own ad settings). Check "Children" still reads true.
    - Help, "Locked chapters": the two free ways, one free chapter per story every
      24 hours, and a short ad. Terms, "What Talebrim offers", if it needs it.
    - Move the pages' `updated` date. Run the dashboard's three gates.
22. **Records.** The app's AGENTS.md: a Decisions entry "Prompt 23 as built";
    Data Contract (`unlocks.source` gains `wait`, the two functions and who may
    call them, `admob-ssv` in the Edge Functions list); Billing Rules; the build
    order; the production variable list (a seventh public variable,
    `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID`, and never
    `EXPO_PUBLIC_ADMOB_TEST_DEVICE`); the iOS series' list (`iosAppId`,
    `skAdNetworkItems`, `userTrackingUsageDescription`, Apple's tracking prompt).
    The dashboard's AGENTS.md: the migration, the function, the verify script
    and the pages. Update the owner reminders, removing one only when the owner
    says it is done.
23. **Owner, in Play Console, before the first store build with ads:** App
    content → Ads: "Yes, my app contains ads"; the advertising ID declaration:
    Yes; and the Data safety form gains what the SDK collects (use the
    permissions step 13 reported and Google's AdMob data disclosure guidance).
    The App ID in `app.json` must be the owner's own, never Google's sample.

---

**Do not:** serve an ad without an explicit opt-in tap, autoplay one, or show one
on a screen's entry, a launch, a chapter's end or a timer; grant a reward, or
show a chapter as unlocked, on an ad's close, a timer, or optimistically (only
the `unlocks` row, read back, opens it); write `unlocks` from the app or add a
client insert policy; unlock more than the one chapter tapped, unlock a whole
story, or expire an unlock; write a subscription into `unlocks`; offer either free
option to a subscriber or for an open chapter; ship a test unit, or Google's
sample App ID, in a store build, or serve a live unit to a device that isn't a
registered test device; add interstitial, banner, native or app-open ads (rewarded
only); alter `books`, `chapters`, `app_settings`, `activity_log`, any policy or any
view (every new object is this app's own); put a secret in the app or in an
`EXPO_PUBLIC_` variable (the only new secret is the function's
`ADMOB_AD_UNIT_ID`); change any visual detail of M5, M6, M9 or M10, or of M5a
beyond its two buttons and their lines, or of M11 beyond its one conditional row;
add a second ember element; build Apple's tracking prompt or any iOS ad
configuration (the iOS series); deploy a function, set a secret or push a
migration without the owner's yes.

**Finish each part by** running `npm run typecheck`, `npm run lint` and
`npm test`, and reporting: the verify scripts' pass counts (before and after);
the HTTP proofs; the installed SDK version, its surface where it differs from
step 12, and the permissions it added; the opt-in flow as built; the proofs that
dismissing early grants nothing and that exactly one chapter unlocks per ad and
per free claim; how many seconds Google's callback took; that a subscriber and an
unlocked chapter are never offered either option; the consent flow's behaviour;
what you did about the sheet's height; and every owner reminder still open
(AGENTS.md § Owner reminders), one line each.
