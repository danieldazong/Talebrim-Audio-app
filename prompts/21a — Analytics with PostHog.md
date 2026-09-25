Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Written 2026-09-25 from the owner's decision (AGENTS.md § Decisions —
> 2026-09-25, "Retention and revenue"), and reviewed the same day against the
> code and `posthog-react-native` 4.77.1 (its package, not its docs). The
> number is 21a so that no existing prompt's number changes.

This prompt gives Talebrim the numbers that say whether it keeps readers and
turns them into paying ones:
- whether readers come back the next day and the next week;
- how many chapters they read or hear in a visit;
- how many who see the paywall then watch an ad, take a free unlock, or
  subscribe.

The tool is PostHog, approved by the owner on 2026-09-25. It is plain
JavaScript and runs in Expo Go, so this prompt needs no development build and
can come before the deferred setup. Prompts 22–23 add the paywall and unlock
events it is built to measure.

Done by the owner on 2026-09-25:
- A PostHog account on the **Free plan** (no card, 1 million events a month;
  recording stops at the cap and nothing is charged), **US Cloud**. The Free
  plan allows one project, so testing and real readers share it, told apart
  by step 4's `environment` property.
- In onboarding: autocapture, heatmaps, web vitals and session replay off; no
  data source connected; no teammates invited as admin.
- The project token and host are in `.env.local` as `EXPO_PUBLIC_POSTHOG_KEY`
  and `EXPO_PUBLIC_POSTHOG_HOST` (`https://us.i.posthog.com`), and
  `.env.example` names both. The token is a public client key, like the
  Supabase anon key.

Still open for the owner (report them; don't decide them):
- The privacy policy and Google Play's Data safety form must say the app
  collects app interactions, device and app details, and a pseudonymous user
  id for analytics. AGENTS.md has no privacy-policy URL yet; M10's legal links
  (prompt 22) need one too.
- Whether EU readers must opt in before anything is sent (a legal question).
- **IP and location, decided 2026-09-25: neither is stored.** The first
  test events showed that "Discard client IP data" alone still
  stores city, postal code and coordinates: PostHog's GeoIP step reads the IP
  before it is dropped. The owner chose no location at all. The project
  setting is on, and `lib/analytics.ts` marks every event
  `$geoip_disable: true`, which covers the person too. Nothing in step 12
  uses location.

1. **Install** `posthog-react-native` with `npx expo install`, so the
   version matches SDK 57 (4.77.1 was current on 2026-09-25; report the one
   installed). Every one of its Expo companions is optional, and the review
   found only one worth adding:
   - `expo-application`, which puts the app's version and build on every
     event, so a release can be compared with the one before it.
     **Recommended; the owner approves it at this review.** Ask before
     adding anything else.
   - Not `expo-file-system`: PostHog keeps its offline queue in AsyncStorage,
     already installed, when `expo-file-system` is absent. Prompt 24 installs
     `expo-file-system` later and PostHog then moves to it; its anonymous id
     starts over once, which doesn't matter for readers who are identified.
   - Not `expo-localization` (locale and timezone) for now, and never the
     session replay plugin (`posthog-react-native-session-replay`).
   - `expo-device` is already installed, so events carry the device model and
     OS version.
2. Before writing code, check the SDK surface ACTUALLY INSTALLED in
   `node_modules`, and report its version and the calls you use.
3. **One client, in `lib/analytics.ts`** (no React, AGENTS.md § lib/): a
   plain `new PostHog(key, options)`, created once. Never `PostHogProvider`:
   the provider is where autocapture and navigation tracking live, and this
   app captures only what it names. With no key set, the client is created
   with `disabled: true` and every call is a no-op, so tests and a fresh clone
   run without it. The options, as the review settled them:
   - `host`: `EXPO_PUBLIC_POSTHOG_HOST`.
   - `captureAppLifecycleEvents`: true (the default). Application Opened,
     Became Active and Backgrounded are what next-day and next-week retention
     are built on, and they carry nothing from the screen.
   - `enableSessionReplay`: false (the default), and the replay plugin is
     never installed.
   - `preloadFeatureFlags: false` and `sendFeatureFlagEvent: false`: the app
     uses no feature flags, so no flags request at every launch.
   - `personProfiles: 'identified_only'`: a person profile only once a reader
     signs in.
4. **Environment.** Register once, as a super property, `environment`:
   `development` when `__DEV__`, otherwise `production`. Every insight the
   owner builds filters on `environment = production`, so testing never mixes
   with real readers in the one project the Free plan allows.
5. **Identity.** `identify()` with the Clerk user id when a reader is signed
   in: the same id RevenueCat and every reader table use. It sits beside
   `setParityUser()` in `components/providers.tsx`, in an effect on `userId`.
   `reset()` goes in `clearUserScopedState()` (`lib/session.ts`), with the
   other per-account state, so the next account on the device starts fresh.
   Never send an email, a name or a phone number, and no person properties.
6. **Screens.** One `screen()` call per route change from the root layout
   (`app/_layout.tsx`), named from Expo Router's `useSegments()` with dynamic
   segments kept as written (`/reader/[chapterId]`, `/(tabs)/library`), and
   route ids as properties. Never the search text or any other free text.
7. **The first events**, in snake_case, with ids as properties and never
   titles or text:
   - `chapter_opened`: book_id, chapter_id, number, mode (`text` from M5,
     `audio` from M6), once per open when the screen reaches its ready state.
     No `from`: a route carries only the chapter id, and adding a source to
     every navigation would touch M3, M4, M7, M9, the handoff and autoplay.
     The entry points are counted by their own events below.
   - `chapter_finished`: book_id, chapter_id, mode. For text, once per open
     when M5's reading position reaches 95%. For audio, on `didJustFinish` in
     `lib/audio/player.ts`, where autoplay already starts (lib code may call
     `lib/analytics.ts`).
   - `continue_resumed`: from (`discover` or `library`), mode.
     `openResumeTarget()` (`hooks/use-continue.ts`) takes the `from`.
   - `my_list_added` and `my_list_removed`: book_id, sent from
     `hooks/use-my-list.ts` once the server confirms, not at the optimistic
     change.
   - `hero_opened`: book_id, position (the carousel page). `hero_swiped`,
     once per swipe, from the carousel's pan start.
   - `search_performed`: result_count, when a term's results arrive. Never
     the search text.
   - `handoff`: direction (`read_to_listen` or `listen_to_read`), mapped
     (`estimate`, `chapter-start` or `none`), from M5's `listen()` and M6's
     `readInstead()`.
8. The paywall and unlock events belong to prompts 22–23, which list them in
   their notes. The notification events belong to prompt 23a.
9. **Offline.** PostHog queues events in AsyncStorage (at most 1000; oldest
   dropped first) and sends them on reconnect. Confirm it in the installed
   version, and that an offline session's events arrive later.
10. **Opting out.** Expose PostHog's `optOut()` and `optIn()` through
    `lib/analytics.ts` for an "Analytics" switch on M11 (prompt 25 builds the
    row).
11. **Tests.** `lib/__tests__/analytics.test.ts`, with `posthog-react-native`
    mocked: disabled without a key, the `environment` property, identify and
    reset. `lib/audio/__tests__/player.test.ts` mocks `@/lib/analytics` once
    `player.ts` imports it, as it mocks the other modules.
12. **What the owner will look at.** List the PostHog insights to build from
    these events, each filtered to `environment = production`: next-day and
    next-week retention (on Application Opened), chapters per visit, and the
    paywall funnel once prompts 22–23 add its events.
13. **Development and release builds** read the same two `EXPO_PUBLIC_`
    variables. Note in the report that the deferred setup's `eas.json`, or
    EAS environment variables, must carry them; this prompt doesn't create
    `eas.json`.

Do not: use `PostHogProvider`, autocapture, session replay or screenshots;
send chapter text, search terms, titles, emails or names; add person
properties; add a second analytics tool; install anything but
`posthog-react-native` and, if approved, `expo-application`; block the UI or a
screen on sending an event; put anything but the public project token in the
app.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report the packages installed and why, each event and where it fires, the
offline behaviour, and events arriving in PostHog tagged `environment =
development` (a screenshot of PostHog's activity view is enough).
