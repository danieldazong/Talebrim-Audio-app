Read AGENTS.md first and follow it strictly. Do only what is on this page.

> **Reviewed 2026-09-25 against the code, AGENTS.md and `material/`.** This
> rewrite folds in the three earlier notes (prompt 18's entitlement mirror,
> prompt 20's M9 bottom bar, the owner's retention decisions of 2026-09-25)
> and records the review's decisions in AGENTS.md § Decisions —
> 2026-09-25, "Paywall (prompt 22 review)". What changed, and the calls the
> owner may want to flip:
> - **Frames.** `@prompt_material/12-paywall.png` never existed. M10 is
>   `material/11.png`; M9's bottom bar is in `material/5.png`. No frame
>   draws M5a, so the sheet follows AGENTS.md § M5a.
> - **"Unlock all chapters" is a caption, not a purchase.** In
>   `material/5.png` it is plain muted text beside the ember "Go Ad-Free"
>   pill: it says what the subscription does. There is no per-book product.
>   *(Flip: a real per-book purchase would need a store product per book.)*
> - **M5a has no plan cards.** Its "Go Ad-Free" opens M10, which is the one
>   place plans are chosen and bought. *(Flip: buy from the sheet.)*
> - **Until prompt 23, M5a has no ember button.** "Unlock free" and "Watch ad
>   & continue" are code positions marked `TODO(unlocks)`, never visible
>   placeholders (AGENTS.md § Decisions — 2026-09-23, "No UI without data
>   behind it"), as M9 had no ember until this prompt.
> - **The entitlement mirror is prompt 22a, not this prompt.** Subscribers
>   reach Postgres through the server only: RevenueCat → an Edge Function →
>   an additive `entitlements` table, in the dashboard repo, written after
>   this prompt is built. Until then a subscriber's *locked* chapter plays no
>   audio once the audio storage policy is live (§ Deferred setup, step 8).
>   That is a known gap; this prompt never works around it in the client.
> - **Android only.** iOS scope is still open (AGENTS.md § Important
>   Constraints), so no App Store products, keys or sandbox accounts.
> - **Store setup is split around a build.** Google Play won't let the owner
>   create subscriptions until a build with billing is uploaded, so this
>   prompt adds an EAS `production` profile, stops for the owner's store
>   setup (step 17), then runs the sandbox tests.
> - **Fixed references:** the development build comes from the deferred
>   setup, not "prompt 19"; markers read `TODO(paywall)` (14 of them, listed
>   in step 12), not `TODO(23)`; rewarded ads are prompt 23's, not 24's; the
>   rule against subscription rows in `unlocks` is AGENTS.md § Data
>   Contract's, not "prompt 14"'s; tokens are `bg`, `surface`, `raised` (no
>   `plum-*`), and raw hex lives only in `src/global.css`'s `@theme` (there
>   is no `tailwind.config.js`).
> - **Carried over from the analytics fixes (prompt 21a):** nothing billing
>   runs in the web build's server render (no `window`), and the one client
>   is created once.
> - **Other calls:** entitlement id `ad_free`; M10 preselects the "Best
>   value" plan for a non-subscriber; M10 keeps AGENTS.md's muted cancel link
>   though the frame doesn't draw it; Terms and Privacy render only once
>   their URLs exist (none do yet).

**BEFORE THIS PROMPT — STOP until all of these are true:**
1. AGENTS.md § Deferred setup is done: the development build is installed on
   the owner's phone, Google sign-in works on it, the audio storage policy is
   live, and the device checks have passed.
2. **Owner, Google Play:** a Google Play developer account, and an app
   created in Play Console for package `com.talebrim.app`. Its
   subscriptions come later, at step 17.
3. **Owner, RevenueCat:** an account and a project; an Android app in it for
   `com.talebrim.app`, connected to Play with a Google service-account key
   (RevenueCat's Play setup guide); an entitlement with identifier
   `ad_free`; and the project's **public** Android SDK key (`goog_…`) in
   `.env.local` as `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. The RevenueCat
   secret key and the service-account key never enter this repo.

Design material: `material/11.png` (M10, "Your plan", as a subscriber sees
it) and `material/5.png` (M9's bottom bar). View both before building. M5a
has no frame: build it from AGENTS.md § M5a and this page. The frames'
prices, dates, plan names and savings are placeholder (AGENTS.md § What is
NOT binding): every one of them comes from RevenueCat.

## Part A — the SDK, identity and the lock rule

1. **Install** `react-native-purchases` with `npx expo install` (RevenueCat
   is in AGENTS.md § Tech Stack), and add its config plugin to `app.json` if
   the installed version has one. It is native code: rebuild the development
   build (`EAS_NO_VCS=1 npx eas-cli build --profile development --platform
   android`, AGENTS.md § Decisions — 2026-09-25, "Development build") and
   install it before testing anything below. Report the version installed.
2. **Check the installed SDK before writing code.** Open it in
   `node_modules` and confirm, at that version: `configure`, `logIn`,
   `logOut`, `getAppUserID`, `getCustomerInfo`,
   `addCustomerInfoUpdateListener` (and how to remove it), `getOfferings`,
   `purchasePackage` with a Google product change (for a plan switch),
   `restorePurchases`, the error codes (`PURCHASES_ERROR_CODE` or its
   successor), each product's localized price string and per-period price
   strings, and what the SDK does in Expo Go and on the web. Report the
   surface you will use.
3. **One client, in `lib/revenuecat.ts`** (no React, AGENTS.md § lib/):
   - Configured once, with `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. The secret
     key never appears in the bundle, an `EXPO_PUBLIC_` variable or this repo.
   - Never configured in the web build's server render (`typeof window ===
     "undefined"`: the same trap prompt 21a's analytics fell into), on the
     web, in Expo Go if the installed SDK can't work there, or without a key.
     In each of those, `billingAvailable()` is false and every call is a
     no-op, so the web preview, Expo Go and tests keep running.
   - The entitlement id is one constant, `ENTITLEMENT_ID = "ad_free"`: the
     owner's RevenueCat identifier. Nothing else names it.
4. **Identity: the App User ID is the Clerk user id.** `logIn(userId)` sits
   beside `identifyReader()` in `components/providers.tsx`, in the effect on
   `userId`, so entitlement, every `unlocks` row and every reader table key
   off one id. `logOut` goes in `clearUserScopedState()` (`lib/session.ts`)
   with the other per-account state, catching the error the SDK raises for an
   anonymous user, so the next account on the device never inherits a
   subscription. Before any purchase or restore, confirm `getAppUserID()` is
   the signed-in Clerk id, and `logIn` first if it isn't: never buy under an
   anonymous id.
5. **Entitlement is server state, read from `customerInfo` only**
   (AGENTS.md § State Management: TanStack Query owns entitlements):
   - `entitlementOptions(userId)` under a new key in `lib/query-keys.ts`.
     Its query calls `getCustomerInfo()` and returns what the app needs: is
     `ad_free` active, its expiry, whether it will renew, its product id, its
     store, and the management URL.
   - `addCustomerInfoUpdateListener` writes each update into that query with
     `setQueryData`: no polling.
   - Not persisted by TanStack (`shouldPersistQuery()` returns false for it):
     the SDK keeps its own copy on the device, which is what serves a
     subscriber on a plane, and sign-out must leave no copy behind. State the
     offline behaviour you observe: how long the SDK's cached entitlement
     holds with no network.
   - Never written into `unlocks` (AGENTS.md § Data Contract: "A
     subscription never writes here"), so a lapsed subscriber needs no
     revocation job.
6. **The lock rule gains the subscription**, in `types/states.ts`, still in
   one place:
   - `ResolveChapterStateInput` gains `isSubscribed`: a subscribed reader's
     chapters are all accessible. `ChapterLockInputs` carries it.
   - `lockStateFor()` treats an entitlement not yet known as it treats
     unlocks not yet known: `null` ("can't tell yet") for a chapter free
     neither by access nor by position. It is never "locked", so a subscriber
     never sees a paywall flash while the entitlement loads.
   - Thread it through every caller: `hooks/use-book-detail.ts`,
     `hooks/use-chapter-reader.ts` (the open chapter and its next),
     `hooks/use-now-playing.ts`, `lib/audio/resolve.ts` (reading the query
     through `queryClient`, as it reads the unlocks), `lib/chapter-list.ts`
     and `lib/library.ts`.
   - Add `src/types/__tests__/states.test.ts`: free by access, free by
     position, unlocked, subscribed, subscription unknown, and a null
     `access`. The rule has no direct tests today.
   - When the reader subscribes, every locked chapter opens at once, with no
     refetch. M5's text query, gated on the lock, starts by itself.

## Part B — the surfaces

7. **One purchase module**, `hooks/use-purchase.ts`, used by M5a and M10.
   There is no second purchase path. Its pure parts go in `lib/billing.ts`,
   tested in `lib/__tests__/billing.test.ts`:
   - `offeringsOptions()`: the current offering, not persisted.
   - `purchase(pkg)` and `restore()`, each returning one outcome: success,
     cancelled (not an error: nothing is shown), pending (for example a
     parent's approval), already owned, store unavailable, network, or other.
     Classify them from the SDK's error codes, never from message text.
   - The button never spins forever, and a raw store code is never shown.
     No `Alert.alert` and no toast.
8. **Every price, period and saving comes from the offering** (AGENTS.md §
   Billing Rules):
   - Plans are the current offering's packages, whatever they are, ordered
     by period, shortest first. Never a hardcoded list of three.
   - Savings are computed in `lib/billing.ts` against the shortest-period
     plan, per week of access. A plan that saves gets a blush "Save N%"
     badge, and the one that saves most gets "Best value" instead. No saving,
     no badge.
   - The sublines ("Billed every 7 days", "Save $4.97 vs weekly",
     "$1.73/week · Save 65%" in the frame) are built from the SDK's
     localized price and per-period strings. Never format a currency by hand
     if the SDK gives the string.
9. **M5a, the paywall sheet**, as a route: `app/paywall/[chapterId].tsx`,
   with `mode` (`text` or `audio`: where the tap was going) and `from`, shown
   over the current screen as a bottom sheet (`presentation:
   "transparentModal"`, a scrim, and the sheet on `raised`).
   - From the top: a lock icon; a Fraunces headline naming the chapter
     ("Chapter 12: The Moon Rises", or "Chapter 12" untitled); one line
     stating the ad-free value proposition (AGENTS.md § M5a); teal outlined
     "Go Ad-Free", which opens M10 carrying `chapterId` and `mode`.
   - Muted "Restore purchases". A restore that finds `ad_free` active goes
     straight to the chapter (step 10's return).
   - Muted "Manage subscription" only when `customerInfo` has a management
     URL, meaning the reader had a subscription. It opens that URL.
   - "Unlock free" and "Watch ad & continue" are `TODO(unlocks)` positions
     for prompt 23, above "Go Ad-Free". Nothing visible stands in for them,
     so the sheet has no ember element until then.
   - Never shown for a chapter that isn't locked. On mount it checks the
     lock rule, and a chapter that turns out open (a subscription, an unlock)
     replaces the sheet with that chapter.
   - States: loading shows a skeleton headline on the sheet, not a spinner.
     Failed and offline show a message with Retry or Back.
   - `paywall_shown` (step 13), once per open.
10. **M10, the subscription screen**: `app/subscription.tsx`, a pushed stack
    route (no tab bar, no mini player), per `material/11.png`:
    - The header: back chevron and a Fraunces "Your plan".
    - **Subscriber:** a status card with a check disc, the plan's name (the
      store product's title; check how Android renders it, since Play appends
      the app name), and a teal "Active" pill. Under a hairline: "Renews
      {date} · {price}/{period}", or "Ends {date}" when it won't renew; then
      "Billed through Google Play". Below it, "Switch plan" and the plan
      cards.
    - **Not subscribed:** no status card. A heading and the plan cards, with
      the "Best value" plan preselected.
    - **Plan cards**, one per package: on `surface` with a hairline border.
      The selected card has an ember border and a filled ember radio: a
      selection mark, as M6's cover rim is a decorative edge. Each card shows
      the name with its blush badge, the price in Fraunces, and the subline.
    - **The one ember action**, with an `ink` label: "Confirm change" for a
      subscriber (disabled while the selection is the current plan), or the
      subscribe label for everyone else. A switch uses the SDK's Google
      product change, with its default replacement mode; report which that
      is. While a purchase runs, the button is disabled and keeps its label
      and width.
    - Teal outlined "Restore purchase", and teal outlined "Manage in Google
      Play" (the management URL, or Play's subscriptions page).
    - For a subscriber, a muted "Cancel subscription" link to the same Play
      page. It is in AGENTS.md § M10 though the frame doesn't draw it, and
      cancelling happens in Play.
    - One factual line under the button stating the renewal from the
      selected package's period ("Renews every month until you cancel in
      Google Play").
    - **Terms and Privacy** render only from URLs in `constants/legal.ts`.
      None exist yet, so both are omitted and reported as a launch blocker
      (the Play listing needs a privacy policy too).
    - **After a purchase or restore succeeds:** the entitlement updates from
      the returned `customerInfo` or the listener. Opened from M5a, M10
      replaces itself with the chapter tapped, in its mode (M5 for `text`, M6
      for `audio`, at that chapter's saved place), and back from there returns
      to where the paywall was opened, not to M10 or M5a. Opened any other
      way, it stays and shows the subscriber layout.
    - **States:**
      - Offerings loading: skeleton plan cards on `bg`, not a spinner.
      - Offerings failed: a message and Retry, never empty cards.
      - Offline: a message, with a subscriber's cached status card still
        shown.
      - `billingAvailable()` false (web, Expo Go, no key): one message that
        subscriptions are available in the Android app.
      - Pending: a message that Google Play is still confirming.
    - **Accessibility:** each plan card is one radio whose label reads its
      name, full price, period and badge as one sentence. The status pill is
      announced. Every target is at least 44dp, and Restore is clearly
      labelled.
11. **M9's bottom bar**, per `material/5.png`: a `raised` bar over the
    bottom safe area. On the left, the muted caption "Unlock all chapters",
    which is text and not a control. On the right, the ember pill "Go
    Ad-Free", opening M10 with no chapter; back returns to M9.
    - Shown only when the reader isn't subscribed and at least one chapter
      of this book is locked for them. Hidden while the entitlement is
      unknown.
    - The route measures the list's height before mounting it
      (`openingRowIndex()`), so the bar's height comes out of that
      measurement.
12. **Every locked path opens M5a.** Replace the 14 `TODO(paywall)` markers
    and list each in your report:
    - M4: a locked Read or Listen target (`app/book/[id].tsx:67`), and a
      locked preview row (`components/book/chapter-preview-row.tsx:41`),
      with `from: "book"`.
    - M9: a locked row (`app/chapters/[bookId].tsx:57`,
      `lib/chapter-list.ts:104`), with `from: "chapter_list"`; the bottom bar
      (`app/chapters/[bookId].tsx:29`) is step 11.
    - Continue, on M3 and M7: a locked chapter
      (`hooks/use-continue.ts:183`), with `from: "continue"`.
    - M5, at the end of a chapter: when the next chapter is locked, "Next
      chapter" opens M5a for it (`from: "reader_end"`, `mode: "text"`)
      instead of navigating. M5 already works out the next chapter's lock
      (`hooks/use-chapter-reader.ts:193`).
    - M6: next on a locked neighbour opens M5a for it (`from: "player"`,
      `mode: "audio"`). M6 works out its next chapter's lock as M5 does.
    - Autoplay (`lib/audio/player.ts:452`): the player reports that it
      stopped before a locked chapter. M6, if it is on screen and the app is
      in front, opens M5a for that chapter, once. Otherwise nothing opens by
      itself: never a sheet over another screen, or one arriving from the
      background.
    - The locked states of M5 and M6 (`components/reader/reader-states.tsx:149`,
      `components/player/player-states.tsx:96`): an outlined button that
      opens M5a (`from: "locked_screen"`). They never open it by themselves:
      a dismissed sheet must not come straight back.
    - The entitlement markers (`hooks/use-chapter-reader.ts:131`,
      `hooks/use-now-playing.ts:131`, `lib/audio/resolve.ts:79`,
      `lib/chapter-list.ts:69`, `lib/library.ts:190`) are step 6.
    - A locked chapter never opens M5 or M6: that would be a paywall bypass.
      Every one of these paths is a push, so back returns where it was.
13. **Analytics** (prompt 21a): add each event to `AnalyticsEvents` in
    `lib/analytics.ts`, with ids and fixed words only (no price, no email):
    - `paywall_shown`: `book_id`, `chapter_id`, and `from` (`reader_end`,
      `player`, `book`, `chapter_list`, `continue` or `locked_screen`).
    - `plan_selected`, `purchase_started`, `purchase_completed` and
      `purchase_cancelled`: each with `package_id`.
    - `purchase_failed`: `package_id`, and `kind` (step 7's outcome).
    - `restore_tapped` (`from`: `paywall` or `subscription`), and
      `restore_completed` (`entitled`).

    RevenueCat reports revenue; PostHog never sees a price.
14. **Visual rules:**
    - M5a's sheet is `raised`. M10 sits on `bg`. Cards are `surface`.
    - Exactly one ember action per screen: M10's button, M9's "Go Ad-Free",
      and none on M5a until prompt 23.
    - Ember labels are `ink`. Blush appears only as badge labels. "Active" is
      a teal labelled pill.
    - No gradient, and no raw hex outside the `@theme` block in
      `src/global.css` (with its `src/theme/colors.ts` mirror for props that
      take no className).
    - Use `Button`. Never give a Pressable both a `className` and a `style`
      function (AGENTS.md § Style Exception Rules).
15. **Copy.** AGENTS.md specifies no paywall strings:
    - Use the frame's own labels as drawn: "Your plan", "Active", "Billed
      through Google Play", "Switch plan", "Confirm change", "Restore
      purchase", "Manage in Google Play", "Go Ad-Free", "Unlock all chapters".
    - Every other string is plain and flagged for the owner in one list in
      your report: the sheet's value proposition, the non-subscriber heading
      and button, the renewal line, and the pending, failed and unavailable
      messages. No marketing language.
16. **Tests** in `lib/__tests__/billing.test.ts`:
    - ordering by period
    - "Save N%" and "Best value", including a single plan and a plan that
      saves nothing
    - outcome classification, cancelled included
    - the per-week subline

    Plus the lock-rule tests of step 6.

## Part C — store setup and sandbox tests

17. **The build Google Play needs:**
    - Add a `production` profile to `eas.json`: `"node": "24.15.0"` as
      `development` has, `autoIncrement: true`, and an Android
      `app-bundle`.
    - That build embeds its JavaScript, so first create the five
      `EXPO_PUBLIC_` variables for the `production` environment on EAS
      (`eas env:create`), public values only.
    - The owner builds it (`EAS_NO_VCS=1 npx eas-cli build --profile
      production --platform android`) and uploads it to Play's internal
      testing track, adding their test Google accounts as license testers.
      Only then does Play Console allow subscriptions.
    - The owner then creates the subscriptions (for example weekly, monthly
      and yearly, with prices they choose), imports them into RevenueCat,
      attaches them to `ad_free`, and puts them in the `default` offering.
    - **STOP here until the owner confirms the offering shows its packages.**
18. **Sandbox tests**, on the development build with a license tester:
    - a purchase from M5a's path opens exactly the chapter tapped, in its
      mode
    - a cancelled purchase shows no error
    - a plan switch on M10
    - Restore after reinstalling
    - sign-out, then sign-in as another account, shows no inherited
      subscription
    - offline after subscribing, a locked chapter's text still opens
    - web and Expo Go show the unavailable message and don't crash

    Audio for a subscriber's locked chapter waits for prompt 22a: report it,
    don't patch around it.

Do not: hardcode any price, currency, period, saving or plan list; put a
RevenueCat secret or service-account key in the app, an `EXPO_PUBLIC_`
variable or this repo; write a subscription into `unlocks`; grant access
from anything but `customerInfo`; alter any table, policy or view (the
mirror is prompt 22a's); build the entitlement mirror, rewarded ads or
wait-for-free (prompt 23); add iOS products; auto-open M5a on a locked
screen; add a gradient, a second ember action or raw hex; invent legal,
pricing or marketing copy.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:
- the SDK version and the surface used
- confirmation that the App User ID is the Clerk user id
- the 14 markers replaced, and the new `TODO(unlocks)` positions
- the offline entitlement behaviour
- the plan-switch replacement mode
- the flagged copy list
- the missing legal URLs
- step 18's results
