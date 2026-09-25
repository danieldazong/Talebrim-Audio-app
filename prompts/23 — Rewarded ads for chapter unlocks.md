Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Owner decisions, 2026-09-25 (AGENTS.md § Decisions — 2026-09-25,
> "Retention and revenue"). Fold these in at this prompt's review:
> - **Wait-for-free is the second unlock path built here, beside the ad.**
>   One free unlock per reader per book every 24 hours, by the server's
>   clock. It unlocks the locked chapter the reader tapped, permanently, like
>   every unlock (AGENTS.md § Decisions — 2026-09-23). It is never offered on
>   a chapter free by access or position, already unlocked, or covered by a
>   subscription. It fills prompt 22's "Unlock free" slot.
> - **The server writes it, never the app.** Readers cannot insert
>   `unlocks` (AGENTS.md § Decisions — 2026-09-23, "Unlocks are
>   server-written only"). Recommended, as the audio policy was decided: two
>   `security definer` functions in an additive migration from the dashboard
>   repo, with the owner's yes before `supabase db push` and verified like the
>   reader tables. `claim_wait_unlock(chapter_id)` checks the caller
>   (`auth.jwt() ->> 'sub'`), that the chapter's book is published, that the
>   chapter is locked for this reader, and that the reader has no `wait`
>   unlock in this book in the last 24 hours; then it inserts the row.
>   `wait_unlock_status(book_id)` returns the seconds until the next free
>   unlock, 0 when it is available, so the sheet's countdown never trusts the
>   device clock. `unlocks.source` gains `wait` (its check constraint, on this
>   app's own table).
> - **Two conflicts to resolve at this prompt's review.** Step 7 has the app
>   insert `source = 'ad'` rows, which RLS forbids for the same reason: the ad
>   unlock must be server-written too, which means AdMob server-side
>   verification to an Edge Function and reverses step 13's "do not build
>   SSV". Step 16 makes subscribe the sheet's ember; AGENTS.md M5a makes
>   "Watch ad & continue" the ember, and with wait-for-free it is "Unlock
>   free" while that is available (prompt 22's note).
> - **Analytics (PostHog, prompt 21a):** `unlock_offered` (which options were
>   available), `wait_unlock_claimed`, `wait_unlock_unavailable` (seconds
>   left), `ad_requested`, `ad_unavailable`, `ad_rewarded`,
>   `ad_dismissed_early`, `unlock_recorded`, `unlock_record_failed`.
This is the second unlock path alongside the subscription from prompt 23. Both
write into the same `resolveChapterState()`; neither may bypass the other.

1. BUILD PREREQUISITE, verify before anything else: `react-native-google-mobile-ads`
   contains native code and does NOT run in Expo Go. A custom development build
   is required (https://docs.page/invertase/react-native-google-mobile-ads).
   Confirm the dev build from prompts 19 and 23 covers it. If not, STOP and tell
   me rather than writing ad code that cannot be exercised.
2. Before writing lifecycle code, check method signatures against the SDK
   ACTUALLY INSTALLED in this repo — open it in `node_modules`, confirm the
   classes, events and reward callback you intend to use exist at that version,
   and report the version and surface.
3. Configure the AdMob app IDs for both platforms in `app.json` as the config
   plugin requires. A missing iOS app ID crashes the app on launch rather than
   failing gracefully (see the documented Expo crash). Use TEST ad unit IDs in
   development and switch by environment — never ship test units, and never point
   development at live units, which risks an invalid-traffic strike on the
   account.
4. POLICY CONSTRAINT, non-negotiable: a rewarded ad must only be served after the
   user affirmatively and unambiguously opts in, with the action required and the
   reward offered both disclosed before the ad starts
   (https://support.google.com/admob/answer/7313578). So the flow is: locked
   chapter tapped → M5a sheet from prompt 23, which now offers BOTH subscribe and
   "watch an ad to unlock this chapter" → explicit tap → ad. Never autoplay an
   ad, never trigger one on screen entry, and never on app launch.
5. Preload the ad before the user needs it and handle the not-yet-loaded case
   honestly: disable the option with a brief "ad unavailable" message rather than
   showing an enabled button that does nothing. Ad fill is not guaranteed, so
   "no ad available right now" is a normal state, not an error.
6. GRANT THE REWARD ONLY ON THE SDK'S EARNED-REWARD CALLBACK — never on ad close,
   never on a timer, and never optimistically. A user who dismisses an ad early
   must not be rewarded. Log the distinction so you can tell dismissal from
   completion.
7. On earned reward, insert into `unlocks` with `source = 'ad'`, using `upsert`
   with `onConflict` on the `(user_id, chapter_id)` constraint from prompt 14 so
   a repeat cannot duplicate or throw. Do not send `user_id` — the column
   defaults to the Clerk claim and RLS re-asserts it. The unlock is PERMANENT per
   the prompt-14 decision: no `expires_at`, no sweep job, no TTL check.
8. UNLOCK SCOPE IS PER USER AND CHAPTER. One ad unlocks exactly the chapter the
   user tapped — never the book, never the next N chapters, never the catalogue.
   Pass the chapter id through the whole flow and assert it at the write.
9. Never gate a chapter the user already has. Before offering an ad, resolve the
   chapter with `resolveChapterState()`: if it is free within the live
   `free_chapters_at_start` from `app_settings`, already in `unlocks`, or covered
   by an active RevenueCat entitlement, the ad option must not appear at all.
   Showing an ad for content the user already paid for is the worst outcome
   available here.
10. After the unlock lands, invalidate the affected keys and return the user to
    the exact chapter at the position they were at — the same requirement as
    prompt 23 step 12. The chapter must be readable immediately, without a manual
    refresh.
11. TEARDOWN on both exit paths — reward earned and ad dismissed — plus unmount
    while an ad is loading or showing. Remove every listener you registered; a
    leaked rewarded-ad listener will fire against a stale chapter id and unlock
    the wrong chapter. Flush any pending parity write before presenting the ad,
    since the ad takes over the screen.
12. Audio must pause when a rewarded ad starts and resume after, if it was
    playing. Coordinate through the prompt-19 player module; do not stop the
    player or tear it down.
13. Server-side verification: AdMob offers SSV callbacks as protection against
    spoofed client-side rewards (https://developers.google.com/admob/android/ssv).
    Client-side granting is what this prompt implements, and it is spoofable. Do
    NOT build SSV here — it needs an endpoint and a signature-verification design.
    Note the exposure in your summary and recommend whether it is worth adding
    given that a spoofed reward costs one chapter, not a subscription.
14. States in the sheet, surface-matched: ad loading, ad unavailable, ad showing,
    reward granted, and reward failed-to-record — the last one matters, because
    the user watched the ad and the write failed, so retry the write silently and
    never make them watch twice. No `Alert.alert`, no red toast.
15. Consent and privacy: confirm what AGENTS.md specifies about ATT on iOS and a
    GDPR/UMP consent flow. If it specifies nothing, report it as a gap rather than
    implementing a consent flow on your own initiative — this affects store review
    and legal exposure, so it needs your sign-off.
16. Visual rules: the subscribe CTA remains the single ember element in the
    sheet; the watch-ad option is outline or text. No gradient, no pink or
    magenta, no raw hex outside `tailwind.config.js`.

Do not: serve an ad without an explicit opt-in tap; grant a reward on close,
timer, or optimistically; unlock more than the one chapter tapped; write
subscription entitlement into `unlocks`; add an `expires_at` or expiry logic;
show an ad to an entitled or already-unlocked user; ship test ad unit IDs or
point development at live units; add interstitial, banner, native or app-open
ads — rewarded only; alter any table, policy or view; change any visual detail of
M5, M6, M9 or M10 beyond the sheet's new option; build SSV.

Finish by running `npx tsc --noEmit`, then paste the installed SDK version, the
opt-in flow as implemented, proof that dismissing an ad early grants nothing,
proof that exactly one chapter unlocks per ad, confirmation that an entitled user
is never offered an ad, your SSV recommendation from step 13, and the consent gap
from step 15.
