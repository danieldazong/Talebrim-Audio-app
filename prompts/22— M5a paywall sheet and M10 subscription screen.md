Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revision note, 2026-09-24 (prompt 18 review). Subscriptions must also
> reach the `audio` storage policy that the deferred setup adds: its `security
> definer` function leaves a `-- TODO(paywall)` branch for an entitlement
> mirror (AGENTS.md § Billing Rules allows one for RLS). Settle how
> RevenueCat state reaches Postgres at this prompt's review. See AGENTS.md
> § Decisions — 2026-09-24, "Audio".
>
> Revision note, 2026-09-25 (prompt 20 review). M9 was built without its
> bottom bar ("Unlock all chapters" and the ember "Go Ad-Free"), because
> nothing stood behind either. It is left at `// TODO(paywall)`. This prompt
> adds the bar, from `material/5.png`, as a new M9 element and not only a
> marker swap. "Unlock all" still needs a product decision. Markers in the
> code read `TODO(paywall)`, not `TODO(23)`. See AGENTS.md § Decisions —
> 2026-09-25, "M9".
>
> Owner decisions, 2026-09-25 (AGENTS.md § Decisions — 2026-09-25,
> "Retention and revenue"). Fold these in at this prompt's review:
> - **The chapter end is where the paywall appears.** M5's end-of-chapter
>   Next, M6's next and its autoplay: when the next chapter is locked, they
>   open M5a naming that chapter, never a dead end or a silent no-op. One tap
>   from the end of a chapter lands on the choice to unlock it.
> - **M5a offers three ways in, laid out once, here:** unlock free
>   (wait-for-free), watch an ad, go ad-free. This prompt builds the sheet
>   with the subscription working and the other two as slots marked
>   `TODO(unlocks)`; prompt 23 wires them. The sheet's one ember action is
>   "Unlock free" while this reader's free unlock for the book is available,
>   and otherwise "Watch ad & continue" (AGENTS.md M5a). "Go Ad-Free" stays
>   teal outlined. When the free unlock isn't available, the sheet says when
>   it will be ("Next free chapter in 18h 20m"), from a time the server
>   gives, never the device clock alone.
> - **Analytics (PostHog, prompt 21a) from the first build:** `paywall_shown`
>   (book, chapter, and where from: reader end, player, M4, M9),
>   `plan_selected`, `purchase_started`, `purchase_completed`,
>   `purchase_cancelled`, `purchase_failed` (with step 11's outcome kind),
>   `restore_tapped`, `restore_completed`. Ids only: no prices (RevenueCat
>   reports revenue), no email.
>
> BEFORE THIS PROMPT: AGENTS.md § Deferred setup must be done. RevenueCat and
> Google Play purchases do not run in Expo Go, and Play products need the
> Android package name. STOP until it is.

Design material: @prompt_material/12-paywall.png — ensure everything is as is
shown. Both the UI and the real service land here, because a paywall built
against mocked prices is a paywall that ships with the wrong prices.

1. BUILD PREREQUISITE, verify before anything else: `react-native-purchases`
   contains native code and does NOT run in Expo Go, nor do purchases work in a
   simulator (https://www.revenuecat.com/docs/getting-started/installation/expo).
   A custom development build is required, plus sandbox tester accounts on both
   stores. Confirm the dev build from prompt 19 covers this and that sandbox
   accounts exist. If not, STOP and tell me — do not write purchase code that
   cannot be exercised.
2. Before writing lifecycle code, check method signatures against the SDK
   ACTUALLY INSTALLED in this repo. Open `react-native-purchases` in
   `node_modules`, confirm every method and type you intend to call exists at
   that version, and report the version and the surface you will use.
3. Configure the SDK once, at app start, with the public SDK key from an
   `EXPO_PUBLIC_` variable. The RevenueCat SECRET key must never appear in the
   app bundle, an `EXPO_PUBLIC_` variable, or this repo. Use the correct
   platform key for iOS and Android.
4. IDENTITY — this one matters: call RevenueCat's `logIn` with the CLERK USER ID
   as the App User ID (https://www.revenuecat.com/docs/customers/identifying-customers),
   so entitlement and every `unlocks` row key off the same identifier. Do not let
   the SDK stay on an anonymous id. Call `logOut` in the sign-out path alongside
   `clearUserScopedState()`, or the next account on the device inherits the
   previous customer's entitlement.
5. EVERY price, period, product title and intro offer comes from `getOfferings`
   (https://www.revenuecat.com/docs/getting-started/displaying-products). Do not
   hardcode a price, a currency symbol, or a "per month" string — the stores
   return localised, region-correct values and a hardcoded price is both wrong
   abroad and a store review rejection. Compute any "save 40%" badge from the
   fetched package prices; never hardcode the percentage.
6. Build two surfaces sharing one purchase module: M5a, the sheet that appears
   when a locked chapter is tapped, and M10, the full subscription screen. One
   `usePurchase` module, consumed by both — do not write two purchase paths.
7. Replace every `// TODO(23)` marker left by prompts 13, 15, 16, 19 and 21. A
   locked chapter tapped anywhere — story detail, the reader, the chapter list,
   or autoplay reaching a locked chapter — opens M5a. Audit for markers and list
   the ones you replaced.
8. ENTITLEMENT IS COMPUTED AT READ TIME from `customerInfo.entitlements.active`
   (https://www.revenuecat.com/docs/customers/customer-info), never written into
   `unlocks`. Prompt 14 forbids subscription rows there precisely so a lapsed
   subscriber needs no revocation job. Feed the active entitlement into
   `resolveChapterState()` alongside the live `free_chapters_at_start` and any
   `unlocks` row.
9. Cache entitlement carefully: it must survive an app restart offline — a paying
   subscriber on a plane must still read — but must also refresh when the
   customer info listener fires. Use the SDK's listener rather than polling, and
   state your offline grace behaviour.
10. Restore Purchases is MANDATORY and must be visible on M10
    (https://www.revenuecat.com/docs/getting-started/restoring-purchases). Apple
    rejects apps without it. Include it even if the design material omits it, and
    report that you added it.
11. Handle every purchase outcome distinctly: success, user cancellation (which
    is NOT an error and must not show an error state), payment pending or deferred
    (common with family approval), already-purchased, store unavailable, and
    network failure. Never leave the button spinning, and never show a raw store
    error code.
12. After a successful purchase, the locked content must unlock IMMEDIATELY —
    invalidate the entitlement-dependent query keys and return the user to exactly
    the chapter they tapped, at the position they were at. Do not dump them back
    at the story detail screen.
13. Visual rules: the purchase CTA is the single ember element with an
    `ink #1A1420` label. Plan cards use `plum-raised` and outline states, not
    ember, and the recommended plan is marked by border or label rather than a
    second ember fill. No gradient — that belongs to M6 alone. No pink, magenta or
    pastel. The paywall headline and body copy must match the strings AGENTS.md
    specifies; if none are given, report that copy is unspecified and use plain
    placeholder text flagged for review rather than inventing marketing language.
14. Legal: link Terms and Privacy on M10, and state the auto-renew and
    cancellation terms as the stores require. If those URLs are not in AGENTS.md,
    report them as missing rather than inventing them.
15. States, surface-matched on `plum-deep`: offerings loading (skeleton plan
    cards, not a spinner), offerings failed to load (retry, and the sheet must not
    render empty plan cards), and purchase in flight (CTA disabled with its label
    preserved so it does not resize). No `Alert.alert`, no red toast.
16. Accessibility: each plan card announces its full price and period as one
    coherent label rather than fragments, the recommended badge is announced, 44dp
    minimum targets, and Restore Purchases carries a clear label.

Do not: hardcode any price, currency, period or discount; put a RevenueCat
secret key in the app; write subscription entitlement into `unlocks`; grant
entitlement from the client without checking `customerInfo`; alter any table,
policy or view; implement rewarded ads — prompt 24 owns them; change any visual
detail of M5, M6, M9 or M4 beyond replacing the TODO markers; add a gradient,
a second ember element, or raw hex outside `tailwind.config.js`; invent legal or
marketing copy.

Finish by running `npx tsc --noEmit`, then paste the installed SDK version,
confirmation that the App User ID is the Clerk user id, the list of `// TODO(23)`
markers you replaced, your offline entitlement behaviour, and sandbox test
results for: a successful purchase unlocking the exact chapter tapped, a
cancelled purchase showing no error, Restore Purchases working on a second
device, and sign-out then sign-in as another account showing no inherited
entitlement.
