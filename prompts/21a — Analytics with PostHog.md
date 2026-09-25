Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Written 2026-09-25 from the owner's decision (AGENTS.md § Decisions —
> 2026-09-25, "Retention and revenue"). Not yet reviewed against the code:
> review it before building, as every prompt is. The number is 21a so that
> no existing prompt's number changes.

This prompt gives Talebrim the numbers that say whether it keeps readers and
turns them into paying ones:
- whether readers come back the next day and the next week;
- how many chapters they read or hear in a visit;
- how many who see the paywall then watch an ad, take a free unlock, or
  subscribe.

The tool is PostHog, approved by the owner on 2026-09-25. It runs in Expo Go,
so this prompt needs no development build and can come before the deferred
setup. Prompts 22–23 add the paywall and unlock events it is built to measure.

Owner, before this prompt:
1. Create a PostHog account, and two projects: "Talebrim dev" for testing and
   "Talebrim" for real readers, so testing never mixes with real numbers.
   Choose EU Cloud if you expect readers in the EU or the UK (their data stays
   in the EU), otherwise US Cloud.
2. Hand over each project's API key (it starts `phc_`) and its host. These are
   public client keys, safe in an `EXPO_PUBLIC_` variable, like the Supabase
   anon key.
3. Update the privacy policy, and Google Play's Data safety form, to say the
   app collects app interactions and a pseudonymous user id for analytics.
   AGENTS.md has no privacy-policy URL yet; M10's legal links (prompt 22) need
   one too.

1. Install `posthog-react-native` with the Expo modules its React Native docs
   list for Expo apps, through `npx expo install` so the versions match SDK
   57. Check the docs at build time for the current list, and report every
   package added and why. The owner approved PostHog and the companions it
   requires; ask before adding anything optional. `expo-file-system` is
   already approved (new API only, AGENTS.md § Tech Stack): confirm the
   installed PostHog uses an API this SDK still ships.
2. Before writing code, check the SDK surface ACTUALLY INSTALLED in
   `node_modules`, and report its version and the calls you will use.
3. One client, created once, in `lib/analytics.ts` (no React, AGENTS.md
   § lib/), from `EXPO_PUBLIC_POSTHOG_KEY` and `EXPO_PUBLIC_POSTHOG_HOST`. With
   no key set, every call is a no-op, so tests and a fresh clone run without
   it. Development builds use the dev project's key, releases the real one.
4. **Explicit events only.** Autocapture off, session replay off, no
   screenshots: nothing on screen, such as chapter text or a search, is ever
   captured by accident.
5. **Identity.** Call `identify()` with the Clerk user id after sign-in: the
   same id RevenueCat and every reader table use. Call `reset()` from
   `clearUserScopedState()` (`lib/session.ts`), so the next account on the
   device starts fresh. Never send an email, a name or a phone number.
6. **Screens.** One screen event per route change, from Expo Router's
   pathname with its dynamic segments named (`/reader/[chapterId]`), and the
   ids as properties.
7. **The first events**, in snake_case, with ids as properties and never
   titles or text:
   - `chapter_opened`: book_id, chapter_id, number, mode (text or audio), and
     from (m4, m9, continue, hero, handoff, autoplay)
   - `chapter_finished`: book_id, chapter_id, mode. The reader reaches the
     end of the text, or the audio completes.
   - `continue_resumed`: from (discover or library), mode
   - `my_list_added` and `my_list_removed`: book_id
   - `hero_opened`: book_id, position. `hero_swiped`.
   - `search_performed`: result_count. Never the search text.
   - `handoff`: direction (read_to_listen or listen_to_read), mapped
8. The paywall and unlock events belong to prompts 22–23, which list them in
   their notes. The notification events belong to prompt 23a.
9. **Offline.** PostHog queues events and sends them on reconnect. Confirm
   that in the installed version, and report the queue's limit.
10. **Opting out.** Expose PostHog's opt-out through `lib/analytics.ts`, for
    an "Analytics" switch on M11 (prompt 25 builds the row). Whether EU
    readers must opt in before anything is sent is a legal question for the
    owner: report it, don't decide it.
11. **What the owner will look at.** List the PostHog insights to build from
    these events: next-day and next-week retention, chapters per visit, and
    the paywall funnel once prompts 22–23 add its events.

Do not: turn on autocapture, session replay or screenshots; send chapter text,
search terms, titles, emails or names; add a second analytics tool; block the
UI or a screen on sending an event; put anything but the public project key in
the app.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report the packages installed and why, each event and where it fires, the
offline behaviour, and events arriving in the dev project (a screenshot of
PostHog's activity view is enough).
