Read AGENTS.md first and follow it strictly. Do only what is on this page.

# 28 — iOS: audit and plan (no code)

**BEFORE THIS PROMPT — STOP until all of these are true.** If any is false,
say which, and stop.
1. Every Android prompt is built and its device checks passed, the states
   and accessibility passes (26 and 27) included.
2. Everything is committed on `main` and tagged `android-v1.0`.
3. A production build is on Google Play's internal testing track.
4. **Owner:** iOS is confirmed in scope. **Done 2026-09-29** (AGENTS.md
   § Decisions — 2026-09-29, "iOS in scope").

Android v1 is finished, committed and tagged `android-v1.0`. The owner now
wants to add iOS. **Android is the reference: nothing it does may change or
break.**

**Do NOT write any code in this step.** No change to `src/`, `app.json`,
`eas.json`, `package.json` or `patches/`, no install, and no EAS build.
Instead:

1. **Audit the code** for everything that is Android-only, or has never run
   on iOS. For each one, say where it is, what it does on Android today,
   and what iOS needs. At least:
   - every `Platform.OS` check in `src/`
   - `billingAvailable()` (`lib/revenuecat.ts`): RevenueCat is off
     outside Android
   - `pushAvailable()` (`lib/push.ts`): new-chapter alerts are Android
     only (FCM, `google-services.json`)
   - `downloadsAvailable()` (`lib/downloads/files.ts`): downloads are
     Android only, and iOS must first keep `downloads/` out of iCloud
     backup
   - the `expo-audio` patch (`patches/expo-audio+57.0.5.patch`) and
     `buildFromSource` in `package.json`: Android only
   - `lib/audio/player.ts`'s iOS path (`SEEK_WHILE_LOADING` false: load,
     seek, check, play), the lock screen, background playback and
     interruptions, none of which has run on an iPhone
   - `app.json` (the `android` block, the plugins' iOS options) and
     `eas.json` (no iOS profile yet)
   - every screen's safe-area handling (the notch, the Dynamic Island,
     the home indicator): every frame is a 393 × 852dp Android frame
   - sign-in: Apple requires Sign in with Apple when an app offers Google
     sign-in, and M1's frame already draws an Apple button
   - rewarded ads (prompt 23), if built: App Tracking Transparency on iOS
   - anything else the audit finds

2. **Write the iOS work as a numbered prompt series** in `prompts/`: `28a`,
   `28b`, and on (AGENTS.md § Decisions — 2026-09-23, "Prompt numbers").
   One feature per prompt, in a safe order:
   - setup and a development build first (bundle ID `com.talebrim.app`
     unless the owner says otherwise, the iOS app inside the **same**
     Clerk application, an `eas.json` iOS profile, device registration)
   - then layout and safe areas
   - Sign in with Apple
   - audio (background, lock screen, interruptions)
   - push (APNs)
   - downloads
   - billing (App Store Connect, RevenueCat's iOS key)
   - ads, if built
   - App Store submission last (privacy details, age rating for Mature
     18+ content, screenshots, TestFlight, App Review)

   Each prompt must state its preconditions, how Android is protected
   (iOS differences behind `Platform` checks or `.ios.tsx` files, never
   by changing shared behaviour), and two checklists: one for the iOS
   feature, and one proving Android unchanged.

3. **List everything the owner must do themselves**: the Apple Developer
   Program (and a D-U-N-S number for an organisation), the Team ID, the
   bundle ID, Clerk (the iOS native app, Sign in with Apple), App Store
   Connect (the app record, products), RevenueCat, Expo (the APNs key),
   and anything else. Give step-by-step directions for each vendor
   dashboard, mark which prompt each one blocks, and say which have long
   lead times.

4. **Record the plan** in AGENTS.md under a new Decisions entry, then
   **stop for the owner's review**. Ask about anything the code can't
   decide. Build nothing.

## How each iOS prompt is built afterwards (for reference)

The owner sends each prompt through the usual two steps.

**Review:** "Review prompt 28a against the code and AGENTS.md, and revise
it." Then stop.

**Build:** "Implement prompt 28a." Every build follows these rules:
- Work on a git branch named `ios`. Never commit to `main`.
- Android must behave exactly as at `android-v1.0`. Keep iOS differences
  behind `Platform` checks or `.ios.tsx` files, never by changing shared
  behaviour.
- No new library without the owner's approval (AGENTS.md § Decision
  Making & Clarifications).
- Before finishing: `npm run typecheck`, `npm run lint` and `npm test`
  pass; give the owner an Android checklist proving nothing changed, and
  an iOS checklist for the new feature.
- Record the build in AGENTS.md.

Do not:
- write code, change configuration, install anything or start a build in
  this prompt.
- create a second Clerk application for iOS (AGENTS.md rule 5).
- change Android's behaviour, its build profiles, or its native patches.
- plan anything that needs the service-role key in the app (rule 1).
