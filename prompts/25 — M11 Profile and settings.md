Read AGENTS.md first and follow it strictly. Do only what is on this page.

> **Reviewed 2026-10-01 against the code (prompts 01–24, 21a and 23a are
> built, with the 2026-09-30 fixes), AGENTS.md, `material/10.png`, the live
> database and the Clerk development instance.** The review's calls are
> recorded in AGENTS.md § Decisions — 2026-10-01, "M11 (prompt 25 review)".
> What changed, and the calls the owner may want to flip:
> - **The frame is `material/10.png`.** `prompt_material/13-profile.png`
>   never existed. The frame stops below "Restore purchase"; everything under
>   it comes from AGENTS.md § M11 and this page.
> - **Stale names fixed.** The tokens are `bg`, `surface`, `raised`, `blush`
>   and `destructive` (#C9705F), in `src/global.css`'s `@theme` block: there
>   is no `plum-*`, no `danger` and no `tailwind.config.js`. The `reader`
>   slice is prompt 07's, billing is prompt 22's, downloads are prompt 24's,
>   and the accessibility pass is prompt 27. Downloads open the Downloads
>   screen (`app/downloads.tsx`), not a Library segment.
> - **The font row works.** Atkinson Hyperlegible has worked in M5's `Aa`
>   sheet since prompt 14, so there is no `TODO(28)` to leave.
> - **The three reading rows open M5's own sheet**, `ReaderSettingsSheet`,
>   reused as it is, on the same `reader` slice. *(Flip: separate pickers for
>   the font and the theme.)*
> - **Dropped:** a default playback speed (the `playback` slice isn't
>   persisted, and M6 owns speed), and a "clear cache" row (chapter text left
>   the cache in prompt 24, what remains is small and refreshes itself, and
>   downloads have their own screen). *(Flip: add either back.)*
> - **Added:** a "New chapter alerts" row, as prompt 23a's review asked,
>   built like Updates' row: it opens the alerts sheet, which already handles
>   the permission, the blocked state and the web. Not a second switch. And
>   the "Usage analytics" switch that prompt 21a promised, on
>   `optOutOfAnalytics()` and `optInToAnalytics()`.
> - **Initials only**, as the frame draws, even for Google accounts that have
>   a photo. *(Flip: Clerk's `imageUrl` when `hasImage`, through
>   `expo-image`.)*
> - **Sign-out is the existing `useSignOut()`**, whose order is already right.
>   The old step 7 would have flushed the reading place after the token was
>   gone. Its confirmation says how many downloaded chapters go (AGENTS.md
>   § Decisions — 2026-09-30, "M2 is remembered by the account").
> - **Account deletion is decided**, where the old step 8 waited for it. An
>   Edge Function, `delete-account`, in the dashboard repo, verifies the
>   reader's Clerk token, deletes their rows, then deletes the Clerk user
>   through Clerk's Backend API. Chosen over Clerk's client `user.delete()`,
>   which can demand a reverification screen the app would have to build,
>   and over a Clerk webhook, which can miss a delete and leave rows behind.
>   It can also be proven over HTTP without the phone. *(Flip: the client
>   path, with an SQL function for the rows and a reverification screen.)*
> - **Analytics:** `restore_tapped` gains `from: "profile"`, and there are two
>   new events, `signed_out` and `account_deleted`. *(Flip: none.)*
> - **Missing, reported, never invented:** the Terms and Privacy URLs, a
>   support email and a help page. Each row renders only once its value is
>   set.

**BEFORE THIS PROMPT — check these:**
1. The development build `9235ee79` is on the owner's phone (installed
   2026-10-01). This prompt adds no native module: `expo-application` is
   already linked (M10 reads it). No new build.
2. **Owner:** a yes to the `delete-account` function (step 9) before it is
   deployed or its secrets are set. Show the code first, as a migration is
   shown.
3. RevenueCat and Google Play aren't set up yet (AGENTS.md § Decisions —
   2026-09-25, "Build order from here", step 5), so `billingAvailable()` is
   false in every build today. The plan pill reads "Free plan"; "See plans"
   and "Manage subscription" open M10's "available in the Talebrim app for
   Android" message; Restore shows the same line. Expected, not a fault.
4. Not blocking: the legal URLs, the support email and the help page (step 7).

Design material:
- @material/10.png — M11, from the title down to "Restore purchase".
  Measured on the 393dp frame:
  - 16dp side padding. "Profile" in Fraunces, about 26px, champagne, as M10's
    "Your plan" (`text-[26px]`). Cards at the 16dp radius.
  - **Account card:** `surface` with a `raised` hairline. A 48dp `raised`
    circle with a 1dp `teal/20` ring, holding the initials in Fraunces
    champagne. The name in Fraunces champagne, the email in `muted` Inter
    beneath it. On the right, the plan pill: `blush/15` fill (#3D2B46
    measured) with a `blush` label.
  - **Upsell card:** `raised` (#2C1E42). "Go Ad-Free" in Fraunces champagne,
    a `muted` line under it, and the ember "See plans" pill with an `ink`
    label.
  - **Section headings** ("READING", "ACCOUNT"): small Fraunces capitals in
    champagne, letter-spaced.
  - **Rows:** 56dp, inside `surface` cards (#1F1530) with `raised` hairline
    dividers. Each has a teal outline icon, a `body` Inter 16 label and a
    `muted` chevron.
- No frame for anything below "Restore purchase", for the sign-out and
  deletion confirmations, or for the rows this page adds. Build them from the
  rows above, and report them for design review.

1. **The route.** Replace the placeholder at `app/(tabs)/profile.tsx` with one
   `ScrollView` (its `contentContainerStyle` through `StyleSheet`), with bottom
   padding `useBottomTabBarHeight() + 16`, as M7's list has. The tab shell's
   measured bar includes the mini player, so the last line is never hidden.
   The title is "Profile". Parts go in `components/profile/`, and the pure
   parts in `lib/profile.ts`, tested. The placeholder's Downloads button goes:
   its row replaces it. The development health probe stays reachable in
   development only (`__DEV__`), as a small `muted` link at the very bottom,
   because it holds the clear-storage button. Never in a release build.

2. **Account card**, from Clerk's `useUser()`:
   - **Title:** the reader's full name, trimmed. Readers who signed in with an
     email code have no name (reader B, checked 2026-10-01). For them the
     email is the title, with no second line. Otherwise the email is the
     `muted` second line. One line each, truncated.
   - **Initials:** the first letters of the first and last names; else the
     email's first letter; upper-cased. No image of any kind: no Clerk photo,
     no Gravatar, nothing generated.
   - **Plan pill**, from `useEntitlement()`:
     - "Ad-Free" while the entitlement is active;
     - "Free plan" once it is known not to be;
     - a `surface`-matched skeleton pill while it loads;
     - nothing when it failed, so a subscriber the app couldn't check never
       reads "Free plan".
     Without billing it answers "not subscribed" at once.
   - Never read or show `metadata.role` or `publicMetadata`.
   - Screen readers get one element: "{title}, {email}, {plan}".

3. **Upsell card.** "Go Ad-Free", "Unlimited chapters, no interruptions", and
   the ember "See plans" pill (`Button`, primary), which pushes M10
   (`/subscription`). It shows once the entitlement is known not to be
   active, and is hidden for a subscriber and while it loads. It is the
   screen's one ember element; a subscriber's screen has none.

4. **Rows.** A `SettingsRow` in `components/profile/`: a teal Ionicons outline
   icon, the label, an optional `muted` value, and at the end a `muted`
   chevron, a `Switch` or a small spinner. It is 56dp at the default text
   size, grows with larger text, and is never below 44dp. Its whole style
   comes from a `style` function, with no `className` beside it (AGENTS.md
   § Style Exception Rules). Groups are `surface` cards with `raised`
   hairline dividers, each under its heading.

   **READING**
   - **"Reading preferences"** → M5's `ReaderSettingsSheet`
     (`components/reader/reader-settings-sheet.tsx`), bound to the `reader`
     slice exactly as M5 binds it. Changes show in the reader at once, and
     changes made in M5 show here: it is one slice.
   - **"Font: Literata"** or **"Font: Atkinson Hyperlegible"**, from
     `atkinsonEnabled` → the same sheet.
   - **"Theme: Light"**, **"Sepia"** or **"Dark"** (`THEME_LABEL`) → the same
     sheet. It is the reader page's theme; the rest of the app stays dark.
   - **"Downloads & offline storage"** → `/downloads`, on every platform. Off
     Android, that screen already explains downloads are Android-only.

   **ACCOUNT**
   - **"Manage subscription"** → M10 (`/subscription`), where the plan,
     "Manage in Google Play" and "Cancel subscription" already are.
   - **"Restore purchase"** → `usePurchase("profile").restore()`, the app's
     one restore path.
     - While it runs, a spinner takes the chevron's place.
     - Its result is one line under the card: M10's messages
       (`NOTHING_TO_RESTORE`, `failureMessage()`), or "Your Ad-Free
       subscription is restored." on success.
     - Where `billingAvailable()` is false, the tap shows M10's line instead:
       "Subscriptions are available in the Talebrim app for Android."
   - **"New chapter alerts"** → the alerts sheet (`/alerts`, `from:
     "profile"`). Its value is the state from `useAlertsStatus()`: On, Off,
     "Off in Android settings" or "In the Talebrim app for Android". Move
     Updates' status words into one shared helper in `lib/alerts.ts`, and
     have both rows use it.
   - **"Usage analytics"**, a `Switch`, on while PostHog may send. Read
     `isAnalyticsOptedOut()` once at mount, then call `optOutOfAnalytics()`
     or `optInToAnalytics()`. A `muted` second line: "Helps us improve
     Talebrim." It belongs to the device, as the opt-out does, so sign-out
     keeps it.

   **SUPPORT** — only the rows whose target is set, and the heading only
   when at least one is:
   - **"Help"** → `HELP_URL`.
   - **"Contact us"** → a `mailto:` link to `SUPPORT_EMAIL`.
   Both live in a new `constants/support.ts`, `null` until the owner supplies
   them.

5. **Footer**, centred under the groups, in this order:
   - "Sign out" (step 8) and "Delete account" (step 9), as `TextLink`s in
     `destructive`, each reaching 44dp with hit slop. `TextLink` gains a
     `tone`: `muted`, the default, or `destructive`.
   - Terms and Privacy as `muted` links, each only once `LEGAL_URLS` has it
     (M10's rule).
   - The version, `muted` 13px: "Version {nativeApplicationVersion}
     ({nativeBuildVersion})" from `expo-application`, which reports the
     installed binary, not `app.json`. On the web: "Web preview".
   - The development link (step 1).

6. **Sheets and navigation.** Pushed screens (M10, Downloads, the alerts
   sheet) come back to Profile. The reading sheet is a `Modal`, as in M5;
   Android back closes it.

7. **Missing values.** `LEGAL_URLS` (`constants/legal.ts`) and
   `constants/support.ts`. Report which are unset. Never a placeholder domain
   or address.

8. **Sign-out.** Use the existing `useSignOut()` (`hooks/use-sign-out.ts`), the
   app's only path. It pauses and records playback, flushes the reading place
   and releases alerts (each bounded), signs out of Clerk, then runs
   `clearUserScopedState()`, which also logs RevenueCat out, resets analytics
   and deletes downloads. There is no second path, and the screen never calls
   `clearUserScopedState()` itself.
   - Confirm first with an `Alert`: "Sign out?", with Cancel and a destructive
     "Sign out". The message:
     - with downloads on the phone (`useDownloadEntries()`): "The {N}
       downloaded chapters on this phone will be removed. You can download
       them again after you sign in." (one chapter reads "chapter");
     - otherwise: "You can sign back in at any time."
   - `track("signed_out")` just before it runs. The auth gate then shows M1.

9. **Account deletion.** Google Play and Apple both require it in the app.

   **Server:** `supabase/functions/delete-account/index.ts` in the dashboard
   repo, beside `notify-new-chapters` and shaped like it.
   - **The caller.** A `POST` with the reader's Clerk session token as the
     bearer. The function verifies the token itself (`verify_jwt = false` in
     `supabase/config.toml`, as for `notify-new-chapters`), with `jose`
     (`npm:jose`):
     - its signature, against the instance's JWKS at
       `{CLERK_ISSUER}/.well-known/jwks.json` (RS256, checked 2026-10-01);
     - its issuer;
     - its expiry.
     The account is the token's `sub`, never anything in the body. A bad or
     missing token gets 401. Answer CORS, for the web preview.
   - **Admins.** A token whose `metadata.role` is `admin` gets 403, and
     nothing is deleted: admin accounts are deleted from the dashboard (the
     owner has two). The function reads that claim; the app never does
     (rule 4).
   - **The rows.** With the project's own secret key, as `notify-new-chapters`
     gets it, delete in this order:
     1. `push_tickets` rows for this account's push tokens;
     2. its `push_tokens`, `reading_positions`, `library_items` and `unlocks`
        rows.
     Those five tables hold everything keyed to a reader (checked
     2026-10-01). Any failure: 500, and the Clerk user is left alone.
   - **The Clerk user.** Then `DELETE https://api.clerk.com/v1/users/{sub}`
     with `CLERK_SECRET_KEY`. A 404 counts as done, so a retry after a
     half-way failure finishes the job. Anything else: 502.
   - **The answer.** 200 with the counts. The log names counts only: never a
     token, an email or a name.
   - **Secrets.** `CLERK_SECRET_KEY` (the development instance's, which the
     dashboard's `.env` holds) and `CLERK_ISSUER`
     (`https://cheerful-walleye-3066.clerk.accounts.dev`). Set both with
     `npx supabase secrets set` without printing either. At the production
     Clerk cutover, both change together.
   - **Deploy**, after the owner's yes, with
     `npx supabase functions deploy delete-account --no-verify-jwt --use-api`.
   - **Later:** a `TODO(paywall)` note in the function: once RevenueCat
     exists, it also deletes the RevenueCat customer. PostHog holds only the
     Clerk id, never a name or an email, so once the Clerk user is gone that
     id names nobody. Say so in the report: deleting the PostHog person too
     is the owner's call.

   **App:** `hooks/use-delete-account.ts`, the one path.
   - **Offline**, nothing starts, and a line under the link says "Connect to
     the internet to delete your account."
   - **Confirm** with an `Alert`: "Delete your account?", with Cancel and a
     destructive "Delete account". The message: "Your account, reading
     places, My List and unlocked chapters are deleted, and downloads are
     removed from this phone. This can't be undone." A subscriber whose plan
     renews also reads: "Your Ad-Free subscription isn't cancelled by this:
     cancel it in Google Play first."
   - **Before the call**, so nothing writes a row after the server has
     deleted them: `stopForSignOut()` and `flushWithin(2_000)`, so nothing is
     lost if the deletion then fails; then drop the parity queue
     (`clearParityQueue()`) and release the player (`releaseAudio()`).
   - **The call:** `supabase.functions.invoke("delete-account")`, which sends
     the Clerk token as the client's `accessToken` does. While it runs, the
     link reads "Deleting…" and is disabled.
   - **200:** `track("account_deleted")`, then Clerk's `signOut()`, then
     `clearUserScopedState()` in a `finally`, as `useSignOut()` does. The
     session died with the user, so a failed `signOut()` is ignored, but the
     app must still land on M1: check that on the phone.
   - **403:** "This account is managed from the Talebrim dashboard." Anything
     else: "Couldn't delete your account. Check your connection and try
     again." Either way the reader stays signed in, and a retry is safe.

10. **States.** Nothing on this screen waits on a network request to render:
    the account card and the rows come from Clerk and local slices.
    - The Clerk user not loaded yet: the card as a `surface` skeleton.
    - The entitlement: step 2. The alerts status while it's read: no value.
    - Offline, every row works except Restore (its failure line) and deletion
      (step 9).
    - No `Alert` except the two confirmations.

11. **Accessibility.**
    - Each row says its label, its value and where it goes: "Theme, Dark.
      Opens reading settings."
    - The switch says its state. The account card is one element (step 2).
      Section headings are headers.
    - "Sign out" and "Delete account" carry hints that say what they do.
    - 44dp targets throughout. Text scales to 1.3× without clipping; the rows
      grow.

12. **Analytics.** `restore_tapped`'s `from` gains `profile`. `ALERTS_FROM`
    gains `profile`, so the three `notify_prompt_*` events carry it. Two new
    events, `signed_out` and `account_deleted`, with no properties. Nothing
    else, and never a name or an email.

13. **Tests** in `lib/__tests__/profile.test.ts`:
    - the title, second line and initials: a full name, a first name only, no
      name, surrounding spaces, one-letter names;
    - the plan pill for active, not active, loading and failed;
    - the sign-out message for 0, 1 and several chapters;
    - the alerts words;
    - the version line.
    The function is proven over HTTP (the finish).

Do not:
- read or show `metadata.role` in the app, or show any avatar image;
- add profile editing, a photo upload, a name, email or password change, or
  notification settings beyond the alerts row;
- add a second sign-out or deletion path, or call `clearUserScopedState()`
  from the screen;
- write a dashboard-owned table, add a migration (none is needed), or deploy
  the function or set its secrets before the owner's yes;
- hardcode a plan name, price, legal URL, support address or help link;
- add a gradient, a second ember element, or raw hex outside `src/global.css`'s
  `@theme` block;
- give a `Pressable` both a `className` and a `style` function;
- change another screen, except the shared pieces named here: `TextLink`'s
  tone, the alerts words helper (which Updates then uses), `ALERTS_FROM`,
  `usePurchase`'s `from`, and the analytics events.

Finish by running `npm run lint`, `npm run typecheck` and `npm test`, then:

1. **The function, over real HTTP**, as deferred setup step 8 proved the
   storage policy.
   - Make a throwaway reader through Clerk's Backend API (a `+clerk_test`
     address). Give it a reading position, a My List book, an unlock and a
     push token, inserted as the server would. Mint a fresh session token
     (they live 60 seconds).
   - The call answers 200; the five tables hold nothing for it; Clerk answers
     404 for it; reader B's rows are untouched.
   - No token, a garbage token and an expired one: 401, nothing deleted.
   - The admin refusal: ask the owner before minting a session for an admin
     account. Never make a new admin.
2. **On the phone** (the owner's itel, over USB and Metro):
   - Profile beside `material/10.png`, down to "Restore purchase".
   - The Font and Theme rows follow the sheet, and a chapter opens in them.
   - Downloads, Manage subscription and the alerts row open their screens and
     come back. Restore shows the no-billing line today.
   - Usage analytics off: no new events reach PostHog. On again: they do.
   - Sign out with downloads on the phone: the count is right and M1
     follows. Signing back in skips M2, since the account remembers it, and
     the downloads are gone.
   - Delete account on a throwaway account signed in on the phone: M1
     follows, the account can't sign in again, and its rows are gone.
   - The version line matches the installed build.
3. **Record it.**
   - In AGENTS.md: § Decisions, "M11 as built"; § Screen Inventory, M11;
     § Connecting → Edge Functions gains `delete-account`, its two secrets
     and the production-cutover note; § Component Creation Rule, for
     `TextLink`'s tone.
   - In the dashboard's AGENTS.md: the function.
   - Report the copy for the owner, the missing URLs and addresses, and every
     deviation from this page.
