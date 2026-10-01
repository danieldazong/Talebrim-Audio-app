Read AGENTS.md first and follow it strictly. Do only what is on this page.

> **Reviewed again 2026-10-01** against the code (prompts 01–25, 21a, 23a
> and 24, with the fixes of 2026-09-30 and 2026-10-01), AGENTS.md,
> `material/11.png`, `material/5.png` and the owner's phone. The calls are
> recorded in AGENTS.md § Decisions — 2026-10-01, "Prompt 22 (second
> review)". What changed, and the calls the owner may want to flip:
> - **Parts A and B are built.** The SDK, identity, the lock rule, M5a, M10,
>   M9's bar and every locked path were built on 2026-09-25 (AGENTS.md §
>   Decisions — 2026-09-25, "Paywall as built"). This run is **Part C**, the
>   store setup and the sandbox tests, and **Part D**, one small catch-up.
>   Step 0 checks that A and B still hold; never rebuild them.
> - **No new development build.** Build `9235ee79`, on the phone since
>   2026-10-01, already holds `react-native-purchases` 10.10.2: its manifest
>   has `com.android.vending.BILLING`, granted.
> - **The lock rule has no "free by position"** since 2026-09-30 (AGENTS.md §
>   Decisions — 2026-09-30, "A chapter's own access decides"). A chapter is
>   open when it is free by its own access, unlocked, or the reader
>   subscribes. The old step 6's wording is gone.
> - **M11 is built** (prompt 25). Its plan pill, the "See plans" upsell,
>   Manage subscription, Restore (`usePurchase("profile")`) and Delete
>   account's warning to a renewing subscriber all read this entitlement, so
>   step 18 tests them too.
> - **Everything renders at full size** since NativeWind's rem fix
>   (2026-10-01). M5a, M10 and M9's bar were built while rem-based classes
>   drew at 87.5%, so step 18 looks at them again beside the frames.
> - **Terms and Privacy have URLs** (`constants/legal.ts`, talebrim.com's
>   pages from the dashboard repo). M10 links them; they work once the owner
>   approves publishing them (AGENTS.md § Owner reminders, "Review
>   talebrim.com's pages").
> - **Play setup, recommended shape:** one subscription, "Ad-Free", with
>   three auto-renewing base plans (weekly, monthly, yearly). M10 names each
>   card by its period and the status card by the subscription's name, and a
>   plan switch is then a base-plan change. *(Flip: three subscriptions, if
>   the owner wants the status card to read "Ad-Free Weekly" as the frame
>   draws it.)*
> - **New, Part D:** a subscription that lapses stops a locked chapter that
>   is playing, as a lock set in the dashboard already does (AGENTS.md §
>   Decisions — 2026-09-30, "A lock set in the dashboard holds"). *(Flip:
>   leave it to the next catalog change or app start.)*
> - **Prompt 22a comes straight after this one.** It is the entitlement
>   mirror (RevenueCat's webhook → an Edge Function → an `entitlements`
>   table), and with it the audio storage policy's subscriber branch. It also
>   brings deleting the reader's RevenueCat customer when they delete their
>   account (`delete-account`'s `TODO(paywall)`), since both need RevenueCat's
>   secret key on the server. Until 22a, a subscriber's locked chapter can't
>   play its narration or be downloaded. Step 18 reports that and never
>   patches it. *(Flip: the customer deletion here.)*
> - **Unchanged from the first review (2026-09-25):**
>   - "Unlock all chapters" is M9's caption, not a purchase.
>   - M5a has no plan cards: its "Go Ad-Free" opens M10.
>   - M5a has no ember action until prompt 23 (two `TODO(unlocks)`
>     positions).
>   - Android only, until the iOS series (AGENTS.md § Decisions —
>     2026-09-29).
>   - The entitlement id is `ad_free`.
>   - M10 preselects "Best value" for a non-subscriber and keeps the muted
>     "Cancel subscription" link.

**BEFORE THIS PROMPT — STOP until all of these are true:**
1. **The development build** `9235ee79` (or later) is on the owner's phone,
   with Google sign-in working on it (AGENTS.md § Deferred setup, steps 3
   and 7; the owner confirms). The audio storage policy is live. The rest of
   step 9 (a phone call, Bluetooth buttons, the screen-off checks) doesn't
   block this prompt.
2. **Owner, Google Play:** a Google Play developer account, with its
   identity verified, and an app created in Play Console for package
   `com.talebrim.app`, as a free app (in-app purchases don't make it paid).
   - Play Console's App content asks for a privacy policy URL:
     `https://talebrim.com/privacy`, once the owner approves publishing it.
   - Its subscriptions come later, at step 17.
3. **Owner, RevenueCat:** an account and a project, with an Android app in
   it for `com.talebrim.app`.
   - Connect it to Play with Google service credentials: a service account
     with the Play Console permissions that RevenueCat's Google Play setup
     guide lists. RevenueCat may take up to a day or more to accept them;
     its dashboard shows when they are valid.
   - Create an entitlement with identifier `ad_free`.
   - Put the project's **public** Android SDK key (`goog_…`) in `.env.local`
     as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, then restart Metro with its
     cache cleared (`npx expo start -c`). Public variables are built into
     the bundle.
   - The RevenueCat secret key and the service-account key never enter this
     repo, an `EXPO_PUBLIC_` variable or the app.

**Design material:** `material/11.png` (M10, "Your plan", as a subscriber
sees it) and `material/5.png` (M9's bottom bar). View both before step 18.
M5a has no frame: AGENTS.md § M5a and the first review's decisions define
it. Every price, date, plan name and saving in the frames is placeholder
(AGENTS.md § What is NOT binding): each comes from RevenueCat.

## Built on 2026-09-25: Parts A and B (reference only, never rebuild)

AGENTS.md § Decisions — 2026-09-25, "Paywall as built", holds the detail.
In short:

- **The SDK and identity:**
  - `react-native-purchases` 10.10.2, with no config plugin.
  - `lib/revenuecat.ts` is the one client: `billingAvailable()`,
    `ENTITLEMENT_ID = "ad_free"`, and the App User ID is the Clerk user id.
    `logIn` happens beside `identifyReader()`, and `logOut` in
    `clearUserScopedState()`.
  - Nothing runs in the server render, on the web, in Expo Go or without a
    key.
- **The entitlement:** `entitlementOptions()` (`lib/queries/billing.ts`),
  read from `customerInfo` only and never persisted by TanStack. The SDK's
  listener writes updates into it (`components/providers.tsx`).
- **The lock rule:** `isSubscribed` in `types/states.ts`, tested. An
  entitlement not yet known is "can't tell yet", never "locked". Since
  2026-09-30 the rule is: free by the chapter's own access, unlocked, or
  subscribed.
- **One purchase path:** `hooks/use-purchase.ts`, with the pure parts in
  `lib/billing.ts`, tested. M10 buys and restores; M5a and M11 restore.
  Outcomes come from the SDK's error codes; a cancel shows nothing.
- **M5a** (`app/paywall/[chapterId].tsx`), **M10** (`app/subscription.tsx`
  with `hooks/use-plans.ts` and `components/subscription/`) and **M9's bar**
  (`AdFreeBar` in `app/chapters/[bookId].tsx`).
  - Plans come from the current offering, ordered by period, with "Save N%"
    and "Best value" computed from the store's own per-week prices.
  - A plan switch passes `{ oldProductIdentifier }` with the SDK's default
    replacement mode.
- **Every locked path opens M5a.** All 14 `TODO(paywall)` markers were
  replaced (none are left in `src`). Two `TODO(unlocks)` positions in M5a
  wait for prompt 23.
- **Analytics:** `paywall_shown`, `plan_selected`, `purchase_started`,
  `purchase_completed`, `purchase_cancelled`, `purchase_failed` (`kind`),
  `restore_tapped` (`from`: `paywall`, `subscription` or `profile`) and
  `restore_completed`. Ids and fixed words only, never a price.
- **`eas.json`** has the `production` profile: Node 24.15.0, `environment:
  production`, `autoIncrement`, an Android `app-bundle`.

0. **Check that it still holds** before anything else, without changing
   code:
   - `npm run typecheck`, `npm run lint` and `npm test` pass.
   - `grep -rn "TODO(paywall)" src` finds nothing.
   - `eas.json`'s `production` profile is as above.
   - `package.json` still pins `react-native-purchases` 10.10.2.
   - Report anything that differs before going on.

## Part C — the store setup and the sandbox tests

17. **The build Google Play needs, and the products:**
    - **Production variables.** The build embeds its JavaScript, so create
      the public variables for EAS's `production` environment, from
      `.env.local` (`eas env:create`, plain-text visibility: every one is
      public). There are six:
      - `EXPO_PUBLIC_SUPABASE_URL`
      - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
      - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
      - `EXPO_PUBLIC_POSTHOG_KEY`
      - `EXPO_PUBLIC_POSTHOG_HOST`
      - `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`

      Never `EXPO_PUBLIC_POSTHOG_DEBUG`, and never a secret. The Clerk key
      stays the development instance's (`pk_test_…`), the dashboard's
      instance (AGENTS.md rule 5): the production cutover is deferred. List
      the names you created in the report.
    - **The build.** The owner runs it, or asks the agent to:
      `EAS_NO_VCS=1 npx eas-cli build --profile production --platform
      android` (AGENTS.md § Decisions — 2026-09-25, "Development build",
      for why `EAS_NO_VCS`). Report the build id and its versionCode.
    - **The upload (owner).**
      - Upload the app bundle to Play's **internal testing** track. Play App
        Signing stays on, and the EAS keystore is the upload key.
      - Add the testers' Google accounts to the internal testers list and to
        Play Console's license testing. Each tester opens the opt-in link
        with that account, and the phone's Play Store is signed in with it.
      - Only then does Play Console allow subscriptions.
    - **Never install the Play build over the development build.** Play
      signs it with Google's key, so Android refuses it as an update. The
      sandbox tests run on the development build.
    - **The subscriptions (owner).**
      - Recommended: one subscription named "Ad-Free" (the product id is the
        owner's choice), with three auto-renewing base plans: weekly,
        monthly and yearly.
      - The owner sets every price (AGENTS.md: never invent one) and
        activates each base plan.
    - **RevenueCat (owner).**
      - Import the products, attach all three to the `ad_free` entitlement,
        and put them in the `default` offering, marked current, as its
        weekly, monthly and annual packages.
      - Recommended: Google's real-time developer notifications, set up per
        RevenueCat's guide, so renewals and cancellations reach RevenueCat
        at once (prompt 22a's webhook relies on that too).
    - **STOP here until the owner confirms the offering shows its packages
      with prices.** New products can take a few hours to appear.
18. **Sandbox tests,** on the development build, signed in to the app as a
    reader, with the phone's Play Store on a license tester's account. Google
    shortens test subscriptions to minutes and ends them after a few
    renewals: note what it does here, without relying on exact figures.
    - **M5a's path:** a purchase from a locked chapter's sheet opens exactly
      that chapter, in its mode. Back returns where the sheet was opened.
    - **A cancelled purchase** shows no error.
    - **M10**, opened from M11's "See plans":
      - "Best value" is preselected.
      - The cards' names, prices, badges and sublines, and the renewal line,
        come from the store.
      - After buying, the subscriber layout shows the status card: "Active",
        the renewal line and "Billed through Google Play".
    - **A plan switch** with "Confirm change". Report the replacement mode
      the SDK used.
    - **M11 after subscribing:**
      - The plan pill reads "Ad-Free", and the upsell card is gone, so
        Profile has no ember.
      - Manage subscription opens M10's subscriber layout.
      - M11's Restore says "Your Ad-Free subscription is restored." On an
        account that never bought, it says M10's "No active subscription
        was found…".
    - **Restore after reinstalling,** from M5a, M10 and M11.
    - **Sign out, then sign in as another account:** no subscription comes
      with it. The pill reads "Free plan", and locked chapters are locked.
    - **Offline after subscribing:** a locked chapter's text still opens
      from the SDK's cached entitlement. Report how long that cache holds.
    - **Delete account as a throwaway subscriber:** the confirmation says
      the subscription isn't cancelled by it. Cancel in Google Play first,
      or the test subscription runs out on its own.
    - **A lapse:** cancel in Google Play. Once the test subscription ends,
      locked chapters lock again on M4, M9 and M5, and the pill reads "Free
      plan". A locked chapter that was playing stops (step 19).
    - **Report, never patch, the gaps until prompt 22a:**
      - The storage policy refuses a subscriber's locked narration. Report
        what M6 shows.
      - Such a chapter can't be downloaded.
    - **At full size:** M10 beside `material/11.png`, M9's bar beside
      `material/5.png`, and M5a on the phone. They were built at 87.5%: fix
      what no longer matches, within each screen's own classes.
    - **Web and Expo Go** show the unavailable message, and don't crash.

## Part D — one catch-up since the build

19. **A subscription that lapses stops a locked chapter that is playing.**
    - In `components/providers.tsx`, when the entitlement listener's update
      turns `ad_free` from active to inactive, run `recheckLoaded(null)`
      (`lib/audio/player.ts`), as a catalog change does. A chapter now
      locked pauses, records its place, and unloads.
    - Offline, or after a failed check, it plays on.
    - The turn is a pure helper in `lib/billing.ts`
      (`entitlementLapsed(previous, next)`), tested. A first answer that is
      inactive is no lapse.
    - Nothing else in the listener changes.

Do not:
- rebuild Parts A or B, or make a new development build for this prompt;
- hardcode any price, currency, period, saving or plan list;
- put the RevenueCat secret key or the service-account key in the app, an
  `EXPO_PUBLIC_` variable or this repo;
- write a subscription into `unlocks`, or grant access from anything but
  `customerInfo`;
- alter any table, policy or view;
- build prompt 22a's mirror, the RevenueCat customer deletion, rewarded ads
  or wait-for-free (prompt 23);
- add iOS products;
- auto-open M5a on a locked screen;
- install the Play build over the development build;
- add a gradient, a second ember action or raw hex;
- invent legal, pricing or marketing copy.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:
- step 0's check;
- the EAS variable names, the production build id and its versionCode;
- the Play and RevenueCat setup as the owner made it: the product and base
  plan ids, and the offering's packages, never a price;
- step 18's results, with the plan-switch replacement mode, how long the
  offline entitlement holds, and what M6 shows for a subscriber's locked
  narration;
- step 19 and its tests;
- what changed on M5a, M10 or M9's bar at full size, with any copy flagged
  for the owner;
- § Owner reminders' open items (AGENTS.md).
