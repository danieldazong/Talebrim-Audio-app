You are an expert React Native + Expo engineer helping build a production-quality reading and audiobook app.

You write clean, simple, maintainable code. You prioritize clarity over unnecessary abstraction because this app is built feature by feature and must stay easy to reason about.

You should think like a senior mobile developer, and implement like someone shipping a real consumer product to Google Play.

---

## STOP — five rules that are not negotiable

Read these before writing any code. Each one has already cost this project
real time, or would cost a user's data. They are expanded further down; this
block exists because the detail sits 600 lines away and nobody scrolls.

**1 · The service-role key never enters this app.** Not in `.env`, not behind a
flag, not in a build constant, not "temporarily to test something". It bypasses
every RLS policy in this document. Anything needing it runs in an Edge
Function. If a task seems to require it in the client, the task is wrong.

**2 · Never write to `books`, `chapters`, `app_settings` or `activity_log`.**
This app is a **reader**. Those tables belong to the admin dashboard — a
separate repo, `C:\Users\PC\Desktop\story-app-dashboad`, with its own
`AGENTS.md` — which is in production at `talebrim.com`. Create your
own per-user tables; altering theirs breaks a live product.

**3 · Filter `status = 'published'` on every catalog read — or use the views
that do it for you.** A draft is unfinished admin work. `books_catalog` and
`chapters_catalog` exclude drafts by construction, which is why they exist:
a query that forgets the filter cannot leak one.

**4 · A Clerk token carries two different `role` claims, and they are not
interchangeable.** Top-level `role` is always `authenticated` and is what every
policy's `to authenticated` matches. The operator role is the **nested**
`metadata.role`. Conflating them makes `is_admin()` false for everyone and
every policy denies everything. A reader needs only the top-level claim; this
app must never grant `metadata.role`.

**5 · One Clerk application, shared with the dashboard — and the same
instance.** The mobile client is a **Native application** inside the existing
`Talebrim` app, never a second Clerk application: two apps mint two `sub`
namespaces, so the same human becomes two unrelated accounts and no per-user
table can ever be joined across them. Reader-versus-admin is decided by
`metadata.role`, not by which app someone signed into (see Identity model).

The **instance** matters too: the dashboard is on **development** right now
(the production cutover was rolled back on 2026-09-19, cause unresolved).
Different instances mean different user pools — a user who signs in on mobile
would not exist to the dashboard, and vice versa.

> **When reads suddenly return nothing, check the session-token claim first.**
> Both Clerk instances are configured with
> `{"metadata": "{{user.public_metadata}}"}`. Without it, `auth.jwt() ->
'metadata'` is empty and every policy denies everything. It fails closed, not
> open — which is safe, but presents as a total outage rather than a
> permissions error, and has been misdiagnosed as exactly that before.

---

## Owner reminders — repeat them at the end of every feature

The owner has put these off on purpose and asked to be reminded (2026-10-01).
**Whenever you finish a feature, end your report with every item below that is
still open, one line each.** A feature here means a prompt, a fix, or any
change the owner asked for. Remove an item only when the owner says it is
done, and date it in the entry it points to.

1. **For prompt 22, next: Google Play** (prompt 22's BEFORE list;
   Decisions — 2026-10-01, "Prompt 22 (second review)" and "RevenueCat's
   Test Store until Google Play").
   - A Google Play developer account (US$25), and an app for
     `com.talebrim.app` in Play Console. Identity checks take days, and a
     personal account must also run a 14-day closed test with 12 testers
     before production. The owner expects to open it about a week after
     2026-10-01.
   - Recommended on 2026-10-02: open it as an organization account for
     Nouvrix LLC, the operator. That needs a D-U-N-S number, which the Apple
     Developer Program also needs for a company. Organization accounts skip
     the 12-tester, 14-day closed test.
   - The RevenueCat project exists, on its Test Store (2026-10-01). Still to
     add to it: a Play Store app for `com.talebrim.app` with Google service
     credentials and real-time notifications, the Play products attached to
     `ad_free` and to the `default` offering's packages, and the app's
     public `goog_…` key in `.env.local` in place of the Test Store key.
   - Then, at prompt 22's step 17: the internal testing upload, license
     testers and the subscriptions.
   - Until then only the development build can buy, and its purchases are
     simulated.
   - The subscription is named **Talebrim Unlimited** (2026-10-01). Change
     the title of the three Test Store products in RevenueCat to it now (M10's
     status card shows the store's title), and give the Play subscription
     that name.
2. **Before launch, in Play Console:** set the privacy policy
   (`https://talebrim.com/privacy`) and the account deletion URL
   (`https://talebrim.com/delete-account`), and use `support@nouvrix.com`
   as the store listing's contact email. (Resend's half of this item was
   done on 2026-10-02: Decisions — 2026-10-02, "Support emails come from
   talebrim.com".)

Removed on 2026-10-02: the deferred setup's last check, connectivity lost
mid-chapter, which the owner reported working (§ Deferred setup, step 9).
The deferred setup is complete. The Apple Developer Program is not a reminder
until the owner has an iPhone and says so (Decisions — 2026-10-02, "iOS waits
for an iPhone").

---

## Project Overview

We are building **Talebrim**, a read-and-listen mobile app for serialized romance, werewolf, vampire and fantasy fiction.

The app serves readers through:

- a text reader with light, sepia and dark modes
- chapter narration audio with background and lock-screen playback
- **read/listen parity** — one bookmark shared between reader and player, in both directions, across devices
- genre-based discovery and search
- a personal library with continue-reading and offline downloads
- rewarded-ad chapter unlocks and an ad-free subscription
- Mature content behind an age gate (**the label is `Mature 18+`** — see Data Contract)

The core differentiator is parity. If a user listens to chapter 12 in the car and opens the reader at home, the text must open exactly where the audio stopped. Architectural decisions defer to that.

Audience: adult women, core 25–44.

---

## Tech Stack

Use the following stack:

- Expo
- React Native
- TypeScript
- Expo Router
- NativeWind / Tailwind CSS
- Zustand
- AsyncStorage
- TanStack Query
- Clerk for authentication (`@clerk/expo`)
- Supabase for database and media storage (`@supabase/supabase-js`)
- `expo-audio` for audio playback — replaces `react-native-track-player`
  (decided 2026-09-24; installed by prompt 18)
- RevenueCat for subscriptions and entitlements
- `react-native-google-mobile-ads` for rewarded ads
- Server-side route handlers or Supabase Edge Functions for secrets and privileged operations
- `expo-keep-awake` — M5 only (approved 2026-09-23; installed by prompt 14)
- `@react-native-community/netinfo` — wired once into TanStack Query's
  `onlineManager` in `lib/query-client.ts` (approved 2026-09-23; installed by
  prompt 15)
- `jest-expo` with `jest` — dev-only, unit tests under `__tests__/` (approved
  2026-09-24; installed by prompt 16)
- `expo-dev-client` — the development build, through EAS, Android first
  (approved 2026-09-24; installed 2026-09-25 by the deferred setup, see
  Build order)
- `patch-package` — dev-only; the `postinstall` script reapplies `patches/`
  after every install, EAS's included. It holds one patch, to `expo-audio`
  (approved 2026-09-25; Decisions — 2026-09-25, "Development build"): pause
  on unplugging, and since 2026-09-30 ExoPlayer owning audio focus
  (Decisions — 2026-09-30, "Another app's audio pauses the narration").
  Check the patch still applies whenever `expo-audio` is upgraded.
- `expo-file-system` — offline downloads, new API only (`File`, `Directory`,
  `Paths`), never the legacy one (approved 2026-09-25; 57.0.7, a direct
  dependency since 2026-09-28, installed by prompt 24 with `npx expo
  install`). Linked into every build before that as a dependency of `expo`.
  It declares `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` up to
  Android 12, as `expo-image`'s Glide declares the first: `app.json` blocks
  both (`android.blockedPermissions`). Only `lib/downloads/files.ts` imports
  it, and only on Android (`downloadsAvailable()`)
- `posthog-react-native` — analytics, explicit events only, with the Expo
  modules it requires (approved 2026-09-25; installed by prompt 21a)
- `expo-notifications` — new-chapter alerts for books on My List (approved
  2026-09-25; 57.0.21, installed 2026-09-28 by prompt 23a with `npx expo
  install`). Native, so it needs a development build made after it.
  Required inside `lib/push.ts` only where push runs, never imported at the
  top of a module: in Expo Go its import logs a warning, and Android's Expo
  Go has no remote push. Android pushes go through Firebase Cloud Messaging:
  the app carries `google-services.json` (client config, committed), and the
  FCM V1 service-account key lives only in EAS
- `react-native-purchases` — RevenueCat's SDK, the "RevenueCat" above
  (10.10.2, installed 2026-09-25 by prompt 22 with `npx expo install`; no
  config plugin). Native, so it needs a development build made after it.
  Required inside `lib/revenuecat.ts` only where billing runs, never imported
  at the top of a module: its import pulls in a browser bundle that the web
  build's server render and Jest can't load (Decisions — 2026-09-25,
  "Paywall as built")

Do not introduce new major libraries unless there is a strong reason.

---

## Development Philosophy

Build feature by feature.

For every feature:

1. Understand the user request.
2. Check this file before coding.
3. Keep the implementation simple.
4. Avoid overengineering.
5. Prefer readable code over clever code.
6. Build the smallest useful version first.
7. Refactor only when repetition or complexity appears.
8. Finish vertically — a screen is done when it renders real Supabase data and handles loading, empty, error and offline states.

---

## Decision Making & Clarifications

If something is unclear or could be improved:

- Proactively suggest better approaches
- If a new library would significantly simplify the implementation:
  - Recommend the library
  - Clearly explain why it is useful
  - Ask the user for permission before adding or installing it

Example:

> "Chapter lists run past 100 rows, so `@shopify/flash-list` would scroll better than `FlatList` here. Do you want me to add it?"

Do not install or use new libraries without user approval.

Also:

- Never replace a documented pattern with a deprecated one, even if an older snippet shows it (see Supabase Rules).
- Never invent product decisions — prices, plan names, discount percentages, chapter counts and free-chapter thresholds come from config or from RevenueCat.

---

## Architecture Guidelines

Use this structure unless there is a strong reason to change it. Everything
below lives under `src/` (`src/app`, `src/components`, …) and `@/` resolves to
`src/`. The one exception is `assets/`, which stays at the repo root
(`@/assets/*` → `./assets/*`).

```txt
app/
  (auth)/
  (tabs)/
  reader/
  player/
components/
constants/
data/
hooks/
lib/
store/
types/
assets/
```

### app/

Routes and screens only.

Screens compose components and call hooks/stores. They should not contain large reusable UI blocks or business logic.

### components/

Create a component only when:

- it is reused in multiple places
- it makes a screen easier to read
- it represents a clear UI concept like `StoryCard`, `ChapterRow`, `MiniPlayer`, `GenreChip`, `ProgressBar`, `SegmentedControl`, or `PrimaryButton`

Do not create tiny one-off components too early.

When unsure, ask:

> Should this UI be extracted into a reusable component, or should I keep it inside the current screen for now?

---

## UI Implementation Rules (VERY IMPORTANT)

For any UI-related task:

- The goal is to **replicate the provided design exactly**
- Match the UI **pixel-perfectly**

When the user provides a design image:

You MUST:

- match layout exactly
- match spacing and padding
- match font sizes and hierarchy
- match colors precisely
- match border radius
- match alignment and positioning
- match proportions of elements
- replicate all visible UI elements
- match component states: default, pressed, selected, disabled, locked, downloaded, reading
- match which screens show the bottom nav and which show the mini player

Do not approximate. Do not simplify unless explicitly asked.

### What is NOT binding in a design image

The V1 frames were produced by a UI generator. **All content inside them is placeholder** and must never be hardcoded:

- book titles, author names, synopsis and blurb copy, chapter titles
- counts and totals — chapter counts, audio ratios, result counts, footer tallies
- durations, word counts, file sizes
- dates and timestamps
- avatars, user names, email addresses
- prices, plan names, renewal dates, discount badges

All of it renders from Supabase or from seed content. Placeholder values are useful only as a hint at realistic string lengths — build for overflow, truncation and wrapping.

Numeric disagreements between frames (the same serial showing different chapter counts on two screens) are placeholder noise, not defects. Do not reconcile them and do not preserve them as data.

### Known design-file defects — fix, do not replicate

- overlapping elements in places
- mismatched or inconsistent icons
- segmented controls filled on the wrong option; the **selected** option is the filled one

---

## Design System

### Colors

| Token           | Hex       | Use                                                    |
| --------------- | --------- | ------------------------------------------------------ |
| `bg`            | `#150E1F` | Screen background                                      |
| `surface`       | `#1F1530` | Cards                                                  |
| `raised`        | `#2C1E42` | Nav, modals, sheets, toolbars                          |
| `ember`         | `#E8663F` | Primary CTA, progress, active tab                      |
| `ember-pressed` | `#FF8A5C` | Pressed state only                                     |
| `teal`          | `#9FD8D0` | Secondary accent, audio affordances, badges            |
| `blush`         | `#E9A8C0` | Decorative chips and labels only                       |
| `champagne`     | `#F4E3CE` | Serif headings on dark                                 |
| `body`          | `#F7F4F0` | Body text on dark                                      |
| `muted`         | `#A79BB5` | Captions, metadata, inactive nav                       |
| `reader-light`  | `#FBF7F1` | Reader light mode                                      |
| `reader-sepia`  | `#F2E5D0` | Reader sepia mode                                      |
| `ink`           | `#1A1420` | Text on light surfaces **and labels on ember buttons** |
| `destructive`   | `#C9705F` | Sign-out, destructive links                            |

Rules: flat surfaces; no shadows, glows, sparkles or text shadows; **no gradients anywhere except** one soft vertical `#150E1F → #2C1E42` on Now Playing, plus two fades approved on 2026-09-23 because a flat scrim left a hard seam over cover art: the onboarding collage fade and the M3 hero card's cover fade. All three live in `src/theme/colors.ts`; add no others without approval; **exactly one ember element per screen**, on the primary action; blush is decorative only, never body text; status is always a labelled pill, never color alone.

Ember button labels are `#1A1420`. Never white.

### Typography

- Fraunces 600 — titles and headings, in champagne
- Literata 18sp, line-height 1.7 — reader body text only
- Inter 14–16sp — all UI chrome
- Atkinson Hyperlegible — the reader's optional accessibility font, body
  text only. The original family (Regular, Italic, Bold, Bold Italic) is
  bundled, not the newer "Next" release.
- No script or decorative fonts

### Layout

393 × 852dp frames, 8pt grid, 16dp side padding, 16dp card radius, pill buttons, 2:3 covers at 12dp radius, 56dp mini player, three-item bottom nav (Discover, Library, Profile) with active ember and inactive `#A79BB5`: the selected tab is its icon alone on an ember circle that slides from tab to tab, the others an icon over a label (Decisions — 2026-10-03, "The tab bar's sliding circle"; iOS draws the system's bar).

---

## Screen Inventory

> Provenance note: these specs come from the design prompts and design-review notes for this project. Where a design image disagrees, **the image wins for layout and this file wins for tokens** — and flag the conflict rather than silently choosing.

**M1 · Sign In / Sign Up** — Cover collage across the top third. Fraunces headline "Pick up where you left off". Outlined pill buttons for Google and Apple. Email input. Ember pill `Continue with email`. Legal line noting 18+ (see Data Contract on the label-vs-enum split). No bottom nav, no mini player.

**M2 · Onboarding Genre Picker** — Top-third collage. Headline "What do you love to read?". Genre chip grid — the dashboard's genre list, mirrored in `data/genres.ts` (see Decisions); selected chips blush-filled, unselected outlined. Step indicator. Ember pill `Start Reading`. Muted `Skip`. Selections seed recommendations; persist them and never re-show the screen.

**M3 · Home / Discover** — The brand left: the logo beside the name, at half the size of the frame's text wordmark (Decisions — 2026-10-03, "M3's header brand"); search and notification icons right. The bell opens Updates, the new-chapter inbox, with a teal dot while a chapter is new (Decisions — 2026-09-30, "Updates inbox"); until then it opened the alerts sheet, with no inbox (Decisions — 2026-09-28). Horizontal tab strip with ember underline on active: Discover, New, then one tab for every genre a published story carries (the frame draws Werewolf, Romance, Vampire and Fantasy). A genre the app has never heard of gets its tab as soon as a story carries it, and a genre with no story has none, so no tab opens onto an empty screen (Decisions — 2026-10-02, "M3's tabs follow the genres of the published stories"). Hero card with a single ember `Read or Listen` — since 2026-09-25 a swipeable carousel of the tab's 5 newest stories, and on the Discover tab a `Continue` card above it for returning readers (Decisions — 2026-09-25, "M3's hero carousel"). Three carousels: Picked for You, Trending Now, New Audio Releases — audio titles carry a teal headphone badge. Mini player above bottom nav. Search icon routes to M8.

**M4 · Story Detail** — Flat `bg` surface (no backdrop); round back and share icons, and a `+ My List` pill left of Share that no frame draws (Decisions — 2026-09-25, "M7 as built"), then a round download button between the pill and Share that no frame draws either (Decisions — 2026-09-30, "M4's download button"). Centred 2:3 cover. Fraunces title, author beneath. Metadata row: rating · chapters · length · status. Blush genre chips. `Read` ember pill beside `Listen` teal outlined pill. Thin progress line with resume label. Synopsis with `More`. Preview chapter rows with durations and lock icons (and M9's teal Downloaded disc on a downloaded chapter), ending in an entry point to M9. **No bottom nav, no mini player.**

**M5 · Reader** — Light mode `#FBF7F1` by default (sepia and dark are user choices). Literata 18sp/1.7. Minimal top bar: back, chapter title, `Aa`. Fraunces chapter heading. Floating bottom toolbar on `#2C1E42` with brightness, `Aa`, bookmark, and a teal Listen icon that hands off to M6 at the equivalent position. Ember progress bar with position label. **No bottom nav, no mini player.**

**M5a · Paywall bottom sheet (over Reader)** — `#2C1E42` sheet. Since 2026-10-01 it sells the story (Decisions — 2026-10-01, "The paywall for a first visit"): the story's cover, "Keep reading {story}" ("Keep listening to…" from the player), a lock beside the locked chapter's name, at most three true benefits, the ember `See plans`, then muted `Not now`, restore-purchases and manage-subscription links. States what the subscription gives before any purchase. Never shown for an already-unlocked chapter. `See plans` opens M10 rather than listing plans (Decisions — 2026-09-25, "Paywall"). Prompt 23 adds "Unlock free" and `Watch ad & continue`, and the owner then decides which button is the ember. Until 2026-10-01 the plan was for "Unlock free" to be the ember while the reader's free unlock for the book is available, otherwise the ad (Decisions — 2026-09-25, "Retention and revenue").

**Alerts sheet (over M4 or Discover)** — No frame; built from M5a's sheet (`components/ui/sheet.tsx`). `#2C1E42` sheet, bell icon. Off: Fraunces "Get notified when new chapters come out?", a muted line that alerts are only for stories on My List, ember `Notify me`, muted `Not now`. On: "New chapter alerts are on" and an outlined `Turn off`. Blocked in Android's settings: one line and an outlined `Open settings`. Web preview and Expo Go: one line that alerts work in the Android app, and `Close`. Opens by itself once per account, after the first My List add the server confirms; Updates' alerts row always opens it, and so will M11's (prompt 25). The Discover bell opened it until 2026-09-30. Built by prompt 23a (Decisions — 2026-09-28).

**M6 · Now Playing** — The app's only full-screen gradient. Dismiss chevron. Large square cover with a thin ember rim. Title, author, chapter. Scrub bar with ember track and thumb, elapsed and remaining labels. Transport row: back-15, previous, 72dp ember play/pause with a `#1A1420` icon, next, forward-15. Secondary teal controls: speed, `Sleep timer`, `Read instead` — hands back to M5 at the equivalent position.

**M7 · My Library** — Fraunces title. Segmented toggle (Books / Audiobooks) on a dark track. `Continue` card: cover, title, progress label, ember progress bar, resume button. `My List` as a 3-column cover grid with an ember progress line under each; audiobook items carry a teal headphone badge. Mini player above bottom nav. Frame: `material/9.png`. Books are added and removed from M4's `+ My List` pill, which no frame draws (Decisions — 2026-09-25, "M7"). Built by prompt 21 ("M7 as built").

**M8 · Search & Results** — Back chevron plus search field in the header. Filter chips, active chip blush-filled. Result count line. Rows: cover thumbnail, title, author, metadata, audio badge where applicable. Recent searches when the query is empty. Needs a real empty state and a distinct no-results state.

**M9 · Full Chapter List** — Sticky header with cover and title. Sort toggle (Newest / Oldest). `Download all`. Long scrolling rows, each in exactly one state with a distinct visual: **Reading Now**, **Unlocked**, **Downloaded**, **Locked**. For a subscriber, a chapter the dashboard locked starts its second line with a teal open lock and "Unlimited", as on M4's preview rows (Decisions — 2026-10-01, "Dashboard locks, seen by a subscriber"). Bottom bar with an ember `See plans` (the frame's `Go Ad-Free`, renamed with the plan on 2026-10-01) and, beside it, the muted caption `Unlock all chapters` (text saying what the subscription does, not a second purchase: Decisions — 2026-09-25, "Paywall"). Must be virtualised — serials run well past 100 chapters. Frame: `material/5.png`. Built by prompt 20 ("M9 as built"); the bottom bar by prompt 22 ("Paywall as built"); `Download all`, the Downloaded disc and each openable row's long-press sheet by prompt 24 (Decisions — 2026-09-28, "Downloads as built").

**M10 · Subscription & Manage Plan** — Status card with current plan and renewal date. Switch-plan cards for Weekly, Monthly (blush savings badge) and Yearly (blush "Best value"); active plan carries an ember border. Confirm-change button. `Restore purchases` and `Manage in Google Play`. Muted cancel link. **Every price, plan title, badge percentage and renewal date is dynamic.** That is the subscriber's screen, as the frame draws it. A reader who doesn't subscribe gets "Choose a plan", one line on what every plan gives, and Restore, Terms and Privacy as links. No frame draws that layout (Decisions — 2026-10-01, "The paywall for a first visit").

**M11 · Profile & Settings** — Frame: `material/10.png`, which stops below "Restore purchase". Fraunces "Profile". Account card: the account's own photo in a `raised` circle, or its initials when it has none (Decisions — 2026-10-01, "M11's avatar is the account's photo"), name and email, and a `blush` plan pill ("Free plan" or "Unlimited"). Upsell card (`raised`), "Talebrim Unlimited" over "Every chapter of every story", with ember `See plans`, hidden for a subscriber. Grouped 56dp rows: Reading (Reading preferences, Font and Theme, each opening M5's reading settings sheet, then Downloads & offline storage), Account (Manage subscription, Restore purchase, New chapter alerts, Usage analytics), Support (Help, which opens the in-app message form, `app/support.tsx`: Decisions — 2026-10-01, "Help is a message to support"). `Sign out` and `Delete account` links in `destructive` (`#C9705F`), then Terms and Privacy (once their URLs exist) and the version string. Development builds only, and only for the owner's account (the address set as `EXPO_PUBLIC_DEVELOPER_EMAIL` in `.env.local`), above the links: a "Development" group with "View as a free reader" (Decisions — 2026-10-01; 2026-10-02, "Development tools belong to the owner's account"). Mini player above bottom nav. This is the Profile bottom-nav destination. Reviewed 2026-10-01 (Decisions — 2026-10-01, "M11 (prompt 25 review)"); built by prompt 25 the same day ("M11 as built"). Account deletion runs through the `delete-account` Edge Function, live since 2026-10-01.

---

## Image Generation Rules

Do **not** generate, synthesize or substitute artwork, covers, avatars or illustrations. Cover art enters the system only through the admin CMS upload path, and missing art uses the placeholder in `constants/images.ts`. **That placeholder is not supplied yet:** until `cover-placeholder.png` exists, `Cover` renders a flat `surface` box (`// MISSING ASSET: cover-placeholder`).

Do not describe or imply AI-generated imagery in shipped UI copy.

If the user explicitly enables image generation for a local asset:

- match the provided reference exactly — do not change style, colors or composition
- keep consistency with the design system above
- place output in `assets/Image/` (capital I, singular — the folder on disk) with clear naming:

```txt
assets/Image/
  onboarding-collage.png
  auth-header.png
  cover-placeholder.png
```

Art direction when art is supplied: moody cinematic, moonlit tones, plum / charcoal / amber. No bright stock photography.

---

## Styling Rules

Use NativeWind Tailwind classes for styling strictly. Do not use `StyleSheet` unless the thing cannot be styled with Tailwind classnames.

Prioritize clean, readable mobile UI.

When building from an attached design image:

- match spacing closely
- match typography hierarchy
- match border radius
- match layout structure
- use consistent reusable styles
- make the UI responsive across screen sizes

Design tokens live in the `@theme` block of `src/global.css` as named colors, so classes read `bg-bg`, `bg-surface`, `text-ember`. Tailwind v4 and NativeWind v5 are CSS-first and read no JS config — there is no `tailwind.config.js`, and none should be created. **Raw hex appears in exactly one place: that `@theme` block**, mirrored in `src/theme/colors.ts` only for props that take no className (see Style Exception Rules).

Prefer reusable class patterns through utilities in `global.css`. If no utility exists and you see a repeated pattern, create one there following the BEM method.

Avoid large inline styles unless required.

---

## NativeWind Rule

Use the NativeWind version already installed in this app.

Before implementing styling or NativeWind-related code:

- Check the current NativeWind version in `package.json`
- Follow the syntax, setup, and patterns supported by that exact version
- Do not use APIs, config patterns, or examples from a different NativeWind version
- Do not upgrade NativeWind unless the user explicitly approves it
- Keep `inlineRem: 16` in `metro.config.js`. Without it, react-native-css
  converts `rem` at 14 on native, so every Tailwind size renders at 87.5% on
  the phone while the web preview uses 16 (Decisions — 2026-10-01). After a
  change there, restart Metro with `npx expo start -c`.

Refer to this for more info: https://www.nativewind.dev/v5/llms-full.txt

> Note: NativeWind v5 is a pre-release and its own installation docs state it is not recommended for production; v4.2.x is the stable line. The architecture handover for this project specifies v5. If `package.json` pins v5, confirm that is intentional before relying on v5-only syntax.

---

## Style Exception Rules

Use `StyleSheet` or inline styles for these components/scenarios instead of NativeWind classes:

| Component / Scenario                        | Why                                                                                | Use Instead                           |
| ------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| **SafeAreaView**                            | From `react-native` or `react-native-safe-area-context` — className not supported  | Inline styles or `StyleSheet`         |
| **Button**                                  | Only supports `title` and `onPress` — cannot customize background, border, padding | `TouchableOpacity` with custom styles |
| **KeyboardAvoidingView**                    | Behavior props not supported by className                                          | Inline styles or `StyleSheet`         |
| **Modal**                                   | `visible`, `transparent` props                                                     | Inline styles                         |
| **ScrollView**                              | `contentContainerStyle`, `indicatorStyle`                                          | `StyleSheet`                          |
| **TextInput**                               | Input-specific props like `underlineColorAndroid`                                  | Inline styles                         |
| **Animated.View / Reanimated**              | Animated style values                                                              | `StyleSheet` with animated values     |
| **Dynamic styles**                          | Progress-bar width %, scrub thumb position, computed at runtime                    | `StyleSheet.create()` or inline       |
| **Platform-specific**                       | iOS-only or Android-only props                                                     | Conditional inline styles             |
| **Pressable/TouchableOpacity**              | `style` prop for pressed states                                                    | `StyleSheet`                          |
| **Shadow (iOS/Android)**                    | Different syntax per platform                                                      | `StyleSheet` with platform checks     |
| **Transform arrays**                        | Complex transform combinations                                                     | `StyleSheet`                          |
| **Z-index**                                 | Sometimes needs explicit StyleSheet                                                | `StyleSheet`                          |
| **expo-linear-gradient** (the three approved gradients only) | Colors are a prop, not a style                                    | Color array prop                      |
| **react-native-svg props**                  | No className support                                                               | `StyleSheet` or props                 |

**Never give a Pressable both `className` and a `style` function.** On this
NativeWind (react-native-css 3.1.0-rc.0), a className turns `style` into
`[classStyle, fn]`. React Native only calls `style` when it is itself a
function, and flattening drops a function inside an array. So the pressed,
disabled or colour styles in it never render, and nothing warns. Found
2026-09-24: M6's play button lost its 72dp ember circle on device. A Pressable
with a pressed or disabled style takes its whole style from the function,
through `StyleSheet` (see `components/player/player-controls.tsx`). A plain
`style` object beside a className is fine. M6 is fixed, and so is `Button`
(prompt 19): it tracks pressed with `onPressIn`/`onPressOut` and passes a plain
style object. Prompt 26 fixes the other Pressables that still combine the two
(`grep -rn "style={({ pressed })" src`).

### When to Use StyleSheet

- The prop is React Native-specific (not web-equivalent)
- The value is dynamic or calculated at runtime
- Platform-specific behavior is needed
- NativeWind does not map the property to a style

### SafeAreaView Example

```tsx
// ✅ CORRECT - Use inline styles or StyleSheet
import { SafeAreaView } from "react-native-safe-area-context";

function ReaderScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FBF7F1" }}>
      {/* content */}
    </SafeAreaView>
  );
}

// ❌ INCORRECT - Do not use NativeWind classes
function ReaderScreen() {
  return (
    <SafeAreaView className="flex-1 bg-reader-light">
      {/* content */}
    </SafeAreaView>
  );
}
```

Similarly for the other exception components. Otherwise, always stick to NativeWind utilities.

---

## UI Quality Bar

The app should feel:

- nocturnal
- premium
- immersive
- mobile-first
- visually close to the provided design references

Avoid neon, pastel or girlish treatments.

Use:

- flat plum surfaces
- clear spacing
- progress indicators on everything resumable
- friendly empty states
- large touch targets (≥ 44dp)
- restrained motion; no decorative animation

Every screen implements loading, empty, error and offline states. A spinner on a blank screen is not a loading state — match the surrounding surface.

Meet WCAG 2.2 AA contrast: 4.5:1 body, 3:1 large text.

Before calling a screen done, test the Reader at the largest supported text size and every list at the longest placeholder title.

---

## Image Rule

Use centralized image imports.

Before using any image asset:

1. Check if `constants/images.ts` exists.
2. If it does not exist, create it.
3. Import and export all app images from `constants/images.ts`.
4. Use images through the centralized object.

Example:

```ts
import onboardingCollage from "@/assets/Image/onboarding-collage.png";
import coverPlaceholder from "@/assets/Image/cover-placeholder.png";

export const images = {
  onboardingCollage,
  coverPlaceholder,
};
```

Use images like this:

```tsx
<Image source={images.coverPlaceholder} />
```

Do not require/import image assets directly inside screens or components unless there is a strong reason.

Remote covers come from Supabase Storage / CDN URLs stored in the database. Render them with `expo-image`, always with a placeholder and a 2:3 aspect ratio. Never hotlink third-party image URLs.

Covers are WebP of about 150 KB, served with a one-year `Cache-Control`, so Supabase's CDN caches them. The dashboard compresses them in the browser at upload (its AGENTS.md § Upload Rules, "Cover images", 2026-09-25). The three live covers were 1.6 MB PNGs served `no-cache` (the CDN missed every request, and M4's cover visibly drew from the top down) until they were replaced the same day. `expo-image` decodes WebP on Android and iOS, and the URL keeps the stored path's extension. Supabase's image transformations, which would resize per screen, are not enabled on this project's plan.

`Cover` caches in memory as well as on disk (`cachePolicy="memory-disk"`), so a cover seen on Discover shows at once on M4. The one large cover on a screen (M4's, M6's, and M3's hero) loads at `priority="high"`, ahead of the carousel covers.

Where a cover must be cropped to a frame that is not 2:3 — the M3 hero card is the case today — use `contentFit="cover"` with `contentPosition="top"`. Cover art puts the title lettering at the top, and the default centre crop cut it off (fixed 2026-09-23). Crop from the bottom, where the card's fade covers the loss anyway.

---

## data/

Use this for seed and static content.

```txt
data/
  genres.ts
  seed-catalog.ts
```

Content must be typed. Never inline prose or catalog data into components.

---

## store/

Use Zustand stores here — one store per concern, not one god store.

Use Zustand for:

- in-flight read/listen parity position
- playback status and scrub position
- reader settings (theme, text size, font choice)
- reader position — a **character offset** into `script_text`, never a pixel
  scroll offset (a pixel offset breaks on a font-size change and cannot map to
  audio; see parity step 4)
- selected genre chips
- app settings

Use AsyncStorage persistence where needed — `persist` + `createJSONStorage`
over `@react-native-async-storage/async-storage`, with `partialize` so only
local-only data is written to disk. Never persist a session token, a Clerk
object, an email, or a verification code — those belong in
`expo-secure-store`. Every persisted store ships a `version` and a `migrate`
function from its first commit, so a future shape change has somewhere to go
instead of handing a stale object to a component.

**Built (prompt 07):**

| Store        | Holds                                                              | Persisted?                                     |
| ------------ | ------------------------------------------------------------------- | ----------------------------------------------- |
| `onboarding` | `hasCompletedOnboarding`, `selectedGenres`                          | yes — per phone, cleared at sign-out; since 2026-09-30 also kept on the account, in Clerk's `unsafeMetadata.onboarding` (`lib/onboarding.ts`), so a returning account skips M2 |
| `reader`     | `theme`, `fontSize`, `lineSpacing`, `atkinsonEnabled`                | yes — device-level, not per-account, so sign-out does not clear it |
| `playback`   | `currentChapterId` (mirrors the player's loaded chapter), `speed`, and the sleep timer's end time and chosen length. Only `lib/audio` writes it. Playing and the position are read from the player, never copied here (prompt 18) | no — session only |
| `parity`     | the in-session authoritative reading position, keyed by chapter, with the server `updated_at` it last saw and a dirty flag | no — see Read/listen parity below; only `lib/parity/writer.ts` writes it |
| `search`     | M8's `recentSearches` (most recent first, at most 8) — added in prompt 11 | yes — per account, so sign-out clears it; never written to the database, and no search-history table exists or should |
| `notifications` | new-chapter alerts: `answered` (the ask was answered, so the app never opens it again) and `enabled` — added in prompt 23a | yes — per account, so sign-out clears it; the server's copy is `push_tokens`, written only through `lib/push.ts` |
| `downloads` | the offline downloads index: the account it belongs to, and per chapter its files (extension, real size, the `audio_path` it came from), `verifiedAt`, `updated_at`, and what M5 and M6 need to open it with no network (number, title, parts, duration, the book's title, author and cover URL) — added in prompt 24 | yes — per account, so sign-out clears it with the files in `downloads/`; never a table, never a signed URL. Only `lib/downloads` writes it |
| `updates` | when the account last looked at Updates: a time on the server's clock (the newest chapter it had in front of it) — added 2026-09-30 | yes — per account, so sign-out clears it; the account keeps its own copy in Clerk's `unsafeMetadata.updates.seenAt`, and the later of the two counts |

Onboarding being done also drives the routing gate: `app/_layout.tsx` uses
Expo Router's `Stack.Protected` (not an imperative `router.replace` in a
`useEffect`) to compose it with the Clerk auth gate — not signed in → M1;
signed in and incomplete → M2; signed in and complete → past onboarding.
"Complete" is `useOnboardingComplete()` (`hooks/use-onboarding.ts`): done on
this phone, or on the account. A completed user cannot navigate back into M2
by any path, including a force-quit, a sign-out and back in, a reinstall or
a new phone, because the screen is removed from the navigator rather than
merely redirected away from. (Until 2026-09-30 the answer lived only on the
phone, so a sign-out and back in showed M2 again: Decisions — 2026-09-30,
"M2 is remembered by the account".)

`lib/session.ts`'s `clearUserScopedState()` — called by sign-out and by a
`__DEV__`-only button on the temporary index route — clears the persisted
TanStack cache, the persisted `onboarding` slice (so the next account on
this device sees M2 again, not the previous account's genres) and the
persisted `search` slice (one account's recent searches are not the next
one's) and the persisted `notifications` slice (the next account is asked
about alerts once, and starts with them off), and every offline download (the
`downloads` slice and the `downloads/` folder, after stopping the download
queue and releasing the player, in that order), and resets
`parity`/`playback` in memory. It deliberately leaves the `reader` slice
alone, and never touches anything in `Paths.document` outside `downloads/`:
PostHog keeps its event queue and the analytics opt-out there.

---

## lib/

Use this for external service helpers and pure functions.

```txt
lib/
  supabase.ts
  token-age.ts  a Clerk token's age by the server's clock, which supabase.ts
                checks on every request (2026-10-02, the screen-off autoplay fix)
  clerk.ts
  developer.ts  whose account sees the development tools; dev-preview.ts the
                "View as a free reader" flag (2026-10-01, owner-only since 2026-10-02)
  parity/       the one reading_positions writer, and its pure rules
  query-status.ts  how a screen's status reads the queries it waits on (M5, M6)
  chapter-list.ts, library.ts, hero.ts, discover-tabs.ts  M9's, M7's, M3's hero's and M3's tab strip's pure parts, each with its tests
  audio/        the one app-wide player (expo-audio), from prompt 18
  revenuecat.ts  the one billing client; billing.ts its pure parts; paywall.ts every way into M5a
  server-plan.ts asks the server to check its copy of the reader's plan (prompt 22a)
  push.ts       the one push client (new-chapter alerts); alerts.ts its pure parts
  updates.ts    the Updates inbox's pure parts (what shows, what is new, "seen")
  profile.ts    M11's pure parts; confirm.ts its two confirmations
  downloads/    offline downloads (prompt 24): files.ts the only expo-file-system
                code, queue.ts the one queue, manage.ts the checks and removals,
                local.ts "is it downloaded", rules.ts the pure parts
  format.ts
  cn.ts
```

No React, no hooks, no JSX in `lib/`.

Never expose secret keys in the mobile app.

---

## State Management Rules

Strict split — violating it causes the parity bug this app exists to avoid.

**TanStack Query** owns all server data: catalog, book and chapter metadata, chapter text, audio URLs, entitlements, unlock records. (Unlock records live in `unlocks`, which the app can read but never write. Subscription access comes from RevenueCat's `customerInfo`. The server keeps its own copy, the `entitlements` mirror (prompt 22a, live since 2026-10-02), for its own checks only: the app can't read or write it, and only asks the server to check it again (`lib/server-plan.ts`). See Data Contract.) It also owns offline caching via a persister. Query keys are declared in one place.

**Zustand** owns transient client state, as listed under `store/`.

Use local component state for temporary UI state.

### Read/listen parity — required algorithm

> **Built by prompt 16 (2026-09-24), in `lib/parity/`.** `writer.ts` is the
> only code that writes `reading_positions` or the `parity` slice.
> `reconcile.ts` is the last-write-wins rule; `convert.ts` maps text ↔ audio.
> M5 and the player (`lib/audio/player.ts`) record through it, and the M5 ↔
> M6 handoff (prompt 19) restores from it. How each step is resolved is
> recorded under Decisions — 2026-09-24; the handoff, under Decisions —
> 2026-09-25.
>
> **The server sets `updated_at` on every write**, which last-write-wins
> depends on: dashboard migration `20260924190305`, applied 2026-09-24. Its
> verify checks (`reader_tables_rls.sql`, 47 in all) prove a client-sent time
> is overwritten on insert and update.

1. Write the position to Zustand immediately; local is the source of truth for the current session.
2. Debounce the write to Supabase — on pause, on chapter change, on app background, and on an interval.
3. Resolve conflicts **last-write-wins against the server timestamp**, never the device clock.
4. Store the position chapter-scoped as a pair: audio milliseconds **and** text character offset, plus which mode wrote it last, so a mode switch can map from the authoritative side.
5. Never block the UI on a parity sync, and never lose a local position because a sync failed.

---

## TypeScript Rules

Use TypeScript strictly.

Avoid `any`. No non-null `!` on genuinely nullable values. No `@ts-ignore` without a one-line justification.

Derive row types from the generated `types/database.ts` rather than redeclaring shapes. **Never hand-edit that file.**

Prefer discriminated unions over optional-field soup for asset states (`locked | unlocked | downloaded | reading`).

Keep types simple and readable.

---

## Feature Implementation Rules

When the user asks to build a feature:

1. Read this file first.
2. Identify files to change.
3. Keep changes focused.
4. Do not rewrite unrelated code.
5. Follow existing patterns.
6. Ensure the feature works end-to-end against real Supabase data.
7. Fix errors before finishing.

---

## Supabase Rules

Create the client with an `accessToken` callback that returns the Clerk session token:

```ts
// lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createSupabaseClient(
  getToken: () => Promise<string | null>,
): SupabaseClient<Database> {
  return createClient<Database>(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    { accessToken: async () => (await getToken()) ?? null },
  );
}
```

Get `getToken` from Clerk's `useAuth()`.

### Deprecated pattern — do not use

```ts
// ❌ DEPRECATED — do not reintroduce
createClient(URL, ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${clerkToken}` } },
});
```

Supabase documents the former Clerk Integration (project JWT secret + Clerk JWT templates) as **deprecated as of 1 April 2025**, because sharing the project JWT secret with a third party is a poor security practice, rotating that secret causes significant downtime, and minting a separate JWT adds latency versus using Clerk session tokens directly. Projects on the deprecated integration are excluded from Third-Party MAU charges only until at least 1 January 2026.

The architecture handover document for this project contains the deprecated snippet. It is superseded by this section.

### RLS

Identify the caller with `auth.jwt() ->> 'sub'` (the Clerk user ID, stored as `text`, never `uuid`). Roles come from Clerk `publicMetadata` via session-token claims. **RLS is the enforcement boundary** — client-side role checks are UX, not security.

---

## Identity model — ONE Clerk application, role decides access

**Decided 2026-09-20. Do not create a second Clerk application for the mobile
app.** The question was asked and answered; this section exists so it is not
re-litigated.

```
Talebrim  (one Clerk application)
├── Web application     → admin dashboard   → metadata.role = "admin"
└── Native application  → mobile reader     → no role (authenticated only)
```

Both surfaces share one user pool, one issuer, and one session-token claim.

### Why not a separate app for readers

The instinct is reasonable — different audiences, different products. It does
not work against this database:

**Supabase identifies every caller by `auth.jwt() ->> 'sub'`**, and validates
tokens against registered issuers. Two Clerk applications mint **two different
`sub` namespaces**. The consequences are permanent and hard to undo:

- `reading_positions.user_id` would hold ids from one app while
  `activity_log.actor_id` holds ids from the other. They could never be joined
  or compared.
- The same human signing into both surfaces would be two unrelated accounts.
- "Which readers are stuck on chapter 3", or an admin inspecting a reader's
  library, become impossible rather than merely unbuilt.

**The separation you want already exists, and it is not app-level.** It is
`metadata.role`:

|        | Token carries                                         | Result                                     |
| ------ | ----------------------------------------------------- | ------------------------------------------ |
| Reader | top-level `role: "authenticated"`, no `metadata.role` | passes RLS as a reader, `is_admin()` false |
| Admin  | both, with `metadata.role: "admin"`                   | `is_admin()` true, dashboard access        |

That guard is verified in production: on 2026-09-19 an uninvited account signed
up through the live site and landed on `Not authorised`. One pool, two levels,
enforced in RLS rather than by which app someone signed into.

**"But there is only one admin" argues the other way.** One Clerk app means one
operator plus N readers in a single pool — ordinary. Two apps means two sets of
SSO credentials, **two session-token claims** (miss one and every policy denies
everything), two instances to keep in step, and two places to debug when auth
breaks.

### When a second app WOULD be defensible

Recorded so this is a judgement rather than a rule: if readers later need a
different MFA posture, a different consumer plan, or you positively want **no**
identity crossover between operators and readers. None of that applies now, and
splitting later is far easier than merging later.

### How to set it up

**Clerk → Talebrim → Configure → Native applications → add one for Expo.**

That yields a publishable key and redirect handling for the native client,
**inside** the existing application. Supabase needs no change — same issuer,
already registered.

⚠️ Point it at the **development** instance. The dashboard is on development
after the 2026-09-19 production rollback (rule 5, and `AGENTS.md` Deferred
Security Task 3). Two halves of one product on different instances means
different user pools, which is the exact failure this section exists to
prevent.

---

## Decisions — 2026-09-23

Made while reconciling prompts 12–15 with this file, the design frames and the
code. The prompts carry the detail; this is the record.

- **Prompt numbers.** The file names in `prompts/` are the numbers. The
  prompts were renumbered down by one, so code comments written before
  2026-09-23 may cite the old number (old 14 = current 13). Prompts not yet
  written are referred to by feature, never by number: `TODO(paywall)`,
  `TODO(parity)`, `TODO(handoff)`. A prompt added later takes a letter
  after the number it follows (21a, 23a, added 2026-09-25), so no existing
  prompt's number ever shifts again.
- **No UI without data behind it.** A frame element with no backing table or
  column is omitted and reported, not mocked: M4's resume card, My List
  (since built by prompt 21, on `library_items`), finished-chapter marks,
  rating and "Ongoing" status; M5's bookmark.
- **M4 Share** sends the title and author only. There is no public book URL
  and no deep-link scheme yet.
- **M4 layout.** No blurred backdrop: the frame has none, and the flat-surface
  rule argues against one. No mini player: the frame shows none, and the mini
  player lives in the tab shell, which M4 is pushed over.
- **Genres are the dashboard's slugs.** `books.genres` holds values such as
  `dark_romance`, written by the dashboard from
  `story-app-dashboad/src/data/genres.ts`. This app's `data/genres.ts`
  mirrors that list exactly; keep the two in step. Filters and saved
  onboarding picks use the slug. Every screen shows `genreLabel()`
  (`lib/labels.ts`), never the raw value. M2 offers the dashboard's twelve
  genres, replacing the eleven chips copied from the M2 frame, three of which
  (Mafia, Royalty, Forbidden) the dashboard cannot tag. The `onboarding`
  store's version 2 migrates saved names to slugs.
- **M5 Reader.**
  - Themes: `light` (default), `sepia`, `dark`.
  - Listen is teal outlined. The reader has no ember button; its only ember
    element is the progress bar.
  - The toolbar's sun icon cycles the theme. There is no brightness library.
  - Previous/next sit at the end of the chapter, not in the toolbar.
  - The position label sits inside the toolbar, in the bookmark's slot,
    and reads "N of M · X%", where X is progress through this chapter. A
    floating label over the text was tried and read as clutter.
  - A tap on the page toggles the toolbar; scrolling down hides it.
  - The reading position is a character offset, recorded once the scroll
    settles. Android sends no momentum-end event to a UI-thread scroll
    handler, so scroll-end events alone record the wrong spot.
  - Settings sheet: text size, theme, line spacing and a working Atkinson
    Hyperlegible switch.
- **Chapter text** is read once per chapter from `chapters` (the sanctioned
  exception in Data Contract). It is cached for 24 hours. Dashboard edits
  apply on the next open, never mid-read.
- **Migrations** live in the dashboard repo (Phase 2).
- **Unlocks are server-written only.** Readers can select their own
  `unlocks` rows and cannot insert, update or delete any. Otherwise anyone
  replaying their own token could grant themselves every locked chapter. The
  paywall prompt writes unlocks from a server function (`service_role`) after
  the ad network or the store verifies the ad or purchase.
- **Supabase's advisor flags all nine reader-table policies** with
  "auth_rls_initplan". That is a false positive of its text match: Postgres
  stores `(select auth.jwt() ->> 'sub')` as `( SELECT (auth.jwt() ->> …))`,
  which the lint does not recognise. `EXPLAIN` shows the claim read once per
  query as an InitPlan, with an index scan. Do not "fix" these policies.
- **Libraries approved:** `expo-keep-awake` and
  `@react-native-community/netinfo` (Tech Stack).

## Decisions — 2026-09-24

Made while building prompts 15–17 and reviewing each prompt before it.

- **One lock rule.** `chapterStateFor()` in `types/states.ts` wraps
  `resolveChapterState()` for a `chapters_catalog` row and treats a null
  `access` as locked. M4 and M5 both call it; nothing else decides a lock.
- **M5 as wired (prompt 15).** Text is fetched only for a published chapter
  that does not resolve to locked. The first text a reader receives stays
  until the screen unmounts. Next and Previous `router.replace` to the nearest
  chapter numbers either side, never n ± 1. The label's "of M" is the book's
  highest chapter number. The next chapter's text is prefetched at 80%, never
  for a locked chapter. Known gap: a dashboard edit made while a chapter is
  closed shows one open late, because the open paints the cached copy first.
- **Prompt cross-references.** Prompts 16–27 (written 2026-09-23 and 24) cite
  each other one number too high: they call the parity writer "prompt 17", M6
  "18–19" and the handoff "20". The file names are right. Fix each prompt's
  references when it is reviewed.
- **Parity writer (prompt 16).** How the five-step algorithm is resolved:
  - The server owns `updated_at`, through one additive trigger on
    `reading_positions` (`before insert or update`, reusing the dashboard's
    `set_updated_at()`), pushed from the dashboard repo.
  - One writer module, `lib/parity/`. Its queue and timers are module state, so
    an unmount can never cancel a write. It is not a `useMutation`: a failed
    write keeps the position instead of rolling it back.
  - Each write sends `chapter_id`, `book_id`, `last_mode` and only its own
    side. The upsert leaves the other side as it was, so reading never clobbers
    a listening position.
  - Last write wins by the server's clock. A session position carries the
    server `updated_at` it last saw, plus a dirty flag. A dirty position is
    flushed and wins. A clean one gives way to a newer server row. Device
    clocks are never compared.
  - Sign-out flushes first, then drops anything queued under the old account.
    The table's `user_id` defaults to whoever's token is on the request, so a
    late write would land in the next account.
  - Text ↔ audio maps proportionally within a chapter, from the text length
    and `audio_duration_seconds`. It falls back to the chapter's start when
    there is no duration. The data has no alignment, so it reports which of the
    two it did, and the handoff says so to the user. Start-of-chapter alone
    would restart every handoff, defeating parity.
  - M4's Read resumes the book's most recent position through
    `resumeTargetOptions()`, and M9 reuses it. Library's Continue card spans
    every book, so it reads `recentPositionsOptions()` instead (Decisions —
    2026-09-25, "M7").
- **M6 Now Playing (prompt 17).** Decided while reviewing prompt 17 against
  `material/8.png`:
  - Built on real chapter and book data, with only the playback mocked. The
    no-audio, locked and not-available states need real rows, and prompt 18
    wires audio, not metadata.
  - The hamburger has no defined function, so it is omitted, with a spacer
    keeping the header centred. The narration credit has no column, so it is
    omitted too. The red glow around the cover is dropped (no glows).
  - The cover's thin ember rim stays: AGENTS.md M6 specifies it. It is a
    decorative edge, so the play button remains the screen's one ember action.
  - "AUDIO SYNC ACTIVE" and "Shared Bookmark" render as static copy in the
    shell. Prompt 18 makes them truthful or hides them.
  - M6 slides up from the bottom, to match its down-chevron dismiss.
  - The scrubber is custom (gesture-handler and Reanimated), because no slider
    library draws the frame's 4dp track on Android.
  - The mocked shell never sets `currentChapterId` or `isPlaying`, or the mini
    player would show a track that isn't playing.
  - Speeds 0.75–2.0 and sleep timers of 5–60 minutes are standard player
    options, not taken from the frame. Revisit them if the product wants
    others.
- **M6 as built (prompt 17).** `app/player/[chapterId].tsx`, with its parts in
  `components/player/`:
  - `hooks/use-now-playing.ts` resolves the state in M5's order: offline →
    failed → loading → not available → locked → no audio → ready. M5 and M6
    now share `waitFor()` (`lib/query-status.ts`) and `lockStateFor()`
    (`types/states.ts`). A null `has_audio` counts as no audio.
  - The playback is `hooks/use-shell-playback.ts`, a reducer marked `SHELL`.
    Prompt 18 replaces it. Elapsed ticks at the chosen speed and stops at the
    end. The sleep timer counts down on the wall clock and pauses the shell at
    zero. Only `setSpeed` reaches the `playback` slice.
  - `Cover` takes an optional `aspectRatio` (default 2:3). Any other ratio
    crops from the top. M6's square cover is 72% of the width where that fits.
    It shrinks on a short screen or at a large text size, so the controls
    never scroll out of reach.
  - A duration that is null or 0 is unknown. The scrubber then draws no fill
    and no thumb, and dragging is off. Its right-hand label reads "Duration
    unknown". Times print through `formatDuration()` ("4:15", not the frame's
    "04:15"). Screen readers hear `formatDurationSpoken()`.
  - `GestureHandlerRootView` wraps the whole app in `app/_layout.tsx`. Every
    gesture-handler gesture needs one above it, and M6's scrubber was the
    first.
  - "Read instead" in the ready state was a `TODO(handoff)` no-op, and so was
    M5's Listen. Prompt 19 wired both (Decisions — 2026-09-25, "Handoff as
    built"). The no-audio state's "Read instead" opens the reader, with
    `router.replace`: there is no audio position to carry.
  - Android back pops the player. With nothing behind it (a deep link), it goes
    to `/` instead of leaving the app.
  - Retry and Go back use `Button`'s `outlined` variant. `secondary`'s
    `raised` fill disappears on the gradient.
- **Audio (prompt 18 review).** Approved by the owner on 2026-09-24:
  - **The `audio` bucket stays private** (Phase 0, decision 2). The app signs
    its own URLs with `createSignedUrl` under the reader's Clerk token.
  - **The dashboard's `audio_read` policy is replaced by one that checks
    entitlement on the server.** It allows `is_admin()`, or a `security
    definer` function that passes a published chapter's current `audio_path`
    when the chapter is free by access or position, or unlocked by the
    caller. This is the second sanctioned change to a dashboard-owned object,
    after the catalog broadcast triggers. It also carries out the dashboard
    AGENTS.md's own intent for `audio/`. The subscription branch waits for the
    entitlement mirror (prompt 22a; Decisions — 2026-09-25, "Paywall").
  - **No Edge Function.** Prompt 18 had planned one. It would have added no
    protection while `audio_read` let any reader sign any file, and it needed
    a service-role key and hand-verified Clerk tokens.
  - `chapters.audio_path` becomes the second sanctioned direct read of
    `chapters`, on the text read's terms.
  - **`expo-audio` replaces `react-native-track-player`.** Track-player has
    had no release since August 2025 (4.1.2; v5 never left alpha), and this
    app runs React Native 0.86 on the New Architecture. `expo-audio` ships
    with SDK 57. Its 57.0.5 types include background playback, lock-screen
    controls with seek, playback rate, interruption modes and a playlist.
    The trade-offs are no next/previous-chapter buttons on the lock screen and
    no Android Auto browsing.
  - **A development build through EAS, Android first**, with
    `expo-dev-client`. RevenueCat and rewarded ads need it too. `expo-audio`
    itself runs in Expo Go, so only the background, lock-screen and
    Bluetooth checks wait for the build.
  - **Deferred, the same day, to the setup before prompt 22** (§ Deferred
    setup): the development build, the owner's account and device
    preparation, and the audio storage policy, whose proof needs test
    accounts. Prompt 18 runs in Expo Go. Until the policy lands, audio is no
    more protected than text, and no real reader uses the app yet. (It
    landed on 2026-09-28: Decisions — 2026-09-28, "Audio storage policy".)
  - **Moved from prompt 19 into prompt 18:** the live mini player and the
    Android notification permission. Dismissing M6 leaves audio playing, and
    the mini player must not show a placeholder over a real track.
  - **Still to revise at their own reviews:** prompt 24 (it signs downloads
    through an Edge Function). Prompt 19 was revised on 2026-09-25. Prompt
    22's review (2026-09-25) moved the policy's subscription branch to
    prompt 22a (Decisions — 2026-09-25, "Paywall").
- **Audio as built (prompt 18).** `lib/audio/`:
  - `player.ts` holds the one `createAudioPlayer()`, made at the first play
    and released at sign-out. Its one `playbackStatusUpdate` listener records
    the loaded chapter through `lib/parity`, flushes on every pause,
    re-mints an expired URL, autoplays and checks the sleep timer. `rules.ts`
    holds the pure parts, and `resolve.ts` resolves a chapter without a
    screen (autoplay, previous and next).
  - Screens read the player through that listener, with
    `useSyncExternalStore` (`hooks/use-audio.ts`), not `useAudioPlayerStatus`.
    That hook needs a player before anything has played, and the prompt
    creates it at the first play. M6 and the mini player read one snapshot.
  - The signed URL is `chapterAudioSourceOptions()` (`lib/queries/audio.ts`):
    6 hours, fresh for 5, never persisted (`shouldPersistQuery()`). A
    refusal ("Object not found") re-checks the lock rule once, then shows
    Locked or Not available.
  - M6 changes nothing until its own Play. Previous and next on the loaded
    chapter change the track. A neighbour that can't play (locked, no
    narration) pauses the current one: it is not left playing under the
    neighbour's locked screen.
  - A failed re-mint leaves the chapter loaded in a `failed` phase. M6 shows
    Failed with Retry, and the mini player's play button retries.
  - Sign-out: `useSignOut` calls `stopForSignOut()` (pause, record) before its
    flush; `clearUserScopedState()` then calls `releaseAudio()`.
  - The lock screen skips 10 seconds, not 15. `expo-audio` fixes the interval
    natively on both platforms, and no option sets it.
  - On Android a load sends the seek and `play()` together with `replace()`,
    then checks the position once loaded. ExoPlayer holds a seek sent while
    loading. Waiting for the load first (prompt 18 step 5) buffered the
    chapter's opening, then seeked away and buffered again: a second Storage
    round trip before any sound. iOS keeps load, seek, check, play. A
    `__DEV__` log, `[audio] chapter started`, reports each start's timings.
  - WAV narration is about 48 KB for every second of audio (29 MB for 10
    minutes). Playback needs 2.5 s of audio (about 120 KB) buffered before it
    starts, so on a slow network the file size, not the code, sets most of
    the start delay. Settled on 2026-09-25: narration is AAC (Decisions —
    2026-09-25, "Narration format").
  - Expo Go gets no lock screen. Its own manifest has no
    `AudioControlsService` (the config plugin reaches only our own builds), so
    binding it failed with a red error on every load. `player.ts` skips
    `setActiveForLockScreen` when `isRunningInExpoGo()`. Background playback
    in Expo Go may therefore stop after about three minutes on Android.

## Decisions — 2026-09-25

Made while reviewing prompts 19, 20 and 21 against the code, plus the
owner's downloads and narration decisions. The M5 ↔ M6 handoff was built as
decided and passed the owner's Expo Go checks on 2026-09-25 ("Handoff as
built"). M9 was built as decided the same day ("M9 as built"). M7 was
built as decided too, then changed twice at the owner's request after trying
it: live time left on the Listening card, and a labelled My List pill ("M7 as
built"). After comparing Discover with its frame, the owner asked for teal
"Audio Parity" and "See all", and a hero that moves: it became a carousel of
the five newest stories, with Continue above it on the Discover tab ("M3's
hero carousel and Continue"). The web preview's fixes are recorded there and
under § Clerk Rules.

- **The destination maps the place.** M5 already restores an audio position
  into the text (`textRestoreOffset()`). M6 gains the reverse in
  `audioRestoreMs()`, so every way into M6 honours a newer reading position,
  not only the handoff. That needs the chapter's text length, so M6 reads
  `chapterTextOptions()` on its sanctioned-read terms, and only when reading
  wrote last. `lib/audio/resolve.ts` uses the cached text only.
- **The handoff never waits on the network.** It records synchronously,
  starts the flush and navigates; the destination reads the session copy.
  The earlier draft's "flush and let it settle" contradicted parity step 5.
- **Listen starts playing.** M5 replaces itself with M6 and passes a `play`
  flag in the route (not a position). M6 starts the chapter once when it is
  ready, as its own Play would, then clears the flag.
- **Read instead pauses** the loaded chapter, because two surfaces recording
  one chapter fight over `last_mode`. On a chapter that isn't loaded it only
  navigates. Entering the reader any other way never stops playback.
- **The estimate is announced in existing slots**, for 4 seconds: M6's
  "Shared Bookmark" slot and M5's position label. "Near where you were
  reading" or "Near where you were listening", or "From the start of the
  chapter" when there was no duration to map with. No new element, no toast.
- **No round trip to an empty state.** M5's Listen is disabled without
  narration, and M6's Read instead without text. M5's no-text caption "You
  can listen to it instead." shows only when there is narration. `Button`'s
  disabled state is fixed first, because on device it looked enabled.
- **M4's Listen resumes** the chapter M4's Read resumes, when it has
  narration and isn't locked; otherwise the first narrated chapter.
- **Handoff as built (prompt 19).** Tested by the owner on a phone in Expo Go
  on 2026-09-25: both directions, offline, back after several handoffs, a
  force-quit, and two chapters at once.
  - M5's `listen()` (`app/reader/[chapterId].tsx`) and M6's `readInstead()`
    and `openReader()` (`app/player/[chapterId].tsx`) are the two directions.
    Both use `router.replace`, and the route carries only the chapter id plus
    M5's `play: "1"`.
  - Both restore functions return a `RestorePoint` (`lib/parity/convert.ts`):
    `{ value, mapped }`. `mapped` is null when the place is the screen's own
    mode's, and otherwise `"estimate"` or `"chapter-start"`, which picks the
    notice. `audioRestoreMs(position, { durationSeconds, textLength })`
    replaced the audio-only version.
  - Fallbacks when reading wrote last:
    - No duration: the chapter start, with its notice.
    - No text length: the audio side, with no notice. With no audio side
      either, the chapter start, with its notice.
    - A mapped place within 5 seconds of the end: the chapter start, with its
      notice, as a finished chapter replays.
  - M6 waits for the text only for a chapter that isn't loaded. One try,
    latched like the position, so a later refetch never brings back the
    skeleton.
  - The loaded chapter doesn't wait. It reads the parity slice live: a
    reading place written since the pause (`lastWrittenBy === "text"`) shows
    on the scrubber while paused, and Play starts there (`playLoadedFrom()`).
    A seek or skip moves on from it and records.
  - **The player's listener records only while playing, at the pause, or
    when a paused position moves 1 second or more** (a lock-screen skip).
    `seekPlayback()` records the app's own seeks. A paused player still
    reports now and then (buffering, state changes). Recording that same
    place again took `last_mode` back from the reader after Read instead.
    `lib/audio/__tests__/player.test.ts` fails without this rule.
  - M5's `recordNow()` (`hooks/use-reading-position.ts`) records only a place
    still waiting for the scroll to settle. With nothing pending, the place is
    already recorded, or the reader hasn't moved from where it opened.
  - M5's restore records its place: the restore's `scrollTo` fires `onScroll`,
    which runs the settle timer. The exception is a restore to the first
    paragraph, where nothing scrolls, so nothing records until the reader
    scrolls or taps Listen.
  - M6's autoplay runs once, in the ready state and only from paused. It is
    guarded by a ref and cleared with `router.setParams`. A chapter already
    playing or loading carries on.
  - The notices come from `hooks/use-handoff-notice.ts`. Each is taken at the
    first render, shown for 4 seconds, and announced with
    `announceForAccessibility`. Its timer goes with the unmount.
  - M5's notice may wrap to two lines inside the toolbar's fixed 56dp, so the
    label is `text-center`: "Near where you were listening" doesn't fit on one
    line at the default size. M6's slot stays one line, but at 1.3× text its
    time labels get tight.
  - Teardown on unmount: the notice timer, the autoplay state and M6's
    chapter-advance subscription. The player, its listener, the sleep timer,
    the lock screen and the parity writer's queue keep running.
- **M9 (prompt 20 review).** Made while reviewing prompt 20 against
  `material/5.png` (M9's frame) and the code as built by prompts 12–19.
  Built as decided (next entry).
  - **One bounded fetch, not pagination.** The whole list of chapter metadata
    (about 30 KB for 200 chapters) through the existing
    `chapterListByBookOptions()`, with explicit columns. Pages would each
    cost the ~450 ms floor. The sort, the unlocked count and opening at the
    Reading Now row all need every row.
  - **Oldest first by default**, as the frame selects, in reading order.
    AGENTS.md set no default. Newest first reverses the complete list in
    memory, with no re-query.
  - **The header sits above the list**, not in `stickyHeaderIndices`, which
    avoids the sticky-header touch bug (react-native#51763).
  - **Reading Now is `resumeTargetOptions()`'s chapter**, the one M4's Read
    resumes. `chapterStateFor()` gains optional `isCurrentlyReading` and
    `isDownloaded` flags, so the lock rule stays in one place.
  - **Taps.** The row opens the reader, or the player when there is only
    narration. The teal headphone on an unlocked narrated row is a separate
    Listen target, and it opens M6 with no autoplay. A Locked row opens
    nothing (`TODO(paywall)`). All push, so back returns to M9.
  - **Omitted, with nothing behind them yet:** "Download all"
    (`TODO(downloads)`), the bottom bar's "Unlock all chapters" and ember
    "Go Ad-Free" (`TODO(paywall)`), "min read" (no word count), and the
    Reading row's "% complete" (no text length in the list). M9 therefore
    has no ember button until the paywall prompt. Its ember is the Reading
    row's left edge and pill, the resume marker, filed under progress.
    Downloaded stays false until the downloads prompt.
  - **The row's detail reads like M4's**: "4:15 audio", "Audio · duration
    unknown", "Text only", or "No text or narration yet".
  - **M9 opens scrolled to the Reading Now row.** Rows have one height,
    computed from the font scale, so `getItemLayout` and
    `initialScrollIndex` hold.
  - **Adding "% complete" and "min read" later** would take a text-length
    column on `chapters_catalog` (`char_length(script_text)`). That is an
    additive view migration in the dashboard repo, and not planned.
- **M9 as built (prompt 20).** Built on 2026-09-25. Not yet checked on a
  phone: the owner's checklist is at the end of prompt 20.
  - `app/chapters/[bookId].tsx` is the route, with its parts in
    `components/chapters/`: the header and sort bar, the row, and the other
    states. `hooks/use-chapter-list.ts` resolves the state: not available
    as soon as the book comes back empty (as M4's `BookNotFound`; a
    malformed id never queries), then offline → failed → loading through
    `waitFor()`, then empty, then ready.
  - `lib/chapter-list.ts` builds the rows: each row's state, title, detail
    line, spoken label, right-hand item and what a tap opens, plus the
    unlocked count and the sort. Its tests are in
    `lib/__tests__/chapter-list.test.ts`.
  - `chapterListByBookOptions()` selects seven columns
    (`ChapterListItemRow` in `types/catalog.ts`), not `*`. Coming from M4,
    the book, the settings, the unlocks and the resume target are cached
    under the same keys and fresh for 5 minutes, so M9 usually costs one
    request: the list. M4's preview sits under a nested key and never stands
    in for it.
  - The live `free_chapters_at_start` was 3 on 2026-09-25, read through
    `reader_settings()`.
  - The resume target gets one try (`retry: false`) and is latched once
    answered, as M5 and M6 latch the position. Failed or offline, it only
    means no Reading row.
  - A row that opens nothing (Locked, or neither text nor narration) is a
    disabled button whose label says why. A Locked row draws no headphone,
    and the tap handlers return before navigating as a second guard.
  - Rows are 64dp at the default text size. The height comes from
    `useWindowDimensions().fontScale`, capped at 1.3× (the text's
    `maxFontSizeMultiplier`), and every row is given it explicitly, so
    `getItemLayout` is exact. `initialScrollIndex` is read once, at mount.
  - **Opening at Reading Now is clamped** (fixed 2026-09-25, found by the
    owner). A list starts drawing at `initialScrollIndex` even when it can't
    scroll that far, and the rows above stay a blank gap: a 5-chapter book
    reading chapter 3 opened with chapters 1–2 missing. The route now
    measures the list's height before mounting it, and `openingRowIndex()`
    (`lib/chapter-list.ts`, tested) stops at the last row that can reach the
    top. A list that fits on the screen opens at the top.
  - **The header is `surface`**, as the frame measures (`#1F1530`), not
    `raised` as prompt 20 step 6 said.
  - **`SegmentedControl` gained `track`:** `"bg"`, the default, for M5's
    `raised` sheet, or `"surface"` with a `raised` hairline for a `bg`
    screen, where a `bg` track would vanish. M5 is unchanged.
  - The Reading pill is `ember/10`, which matches the frame's `#2E1828`.
    Ember text on it is 4.95:1. The Reading row behind it is `surface/40`,
    and its title is `champagne`, as the frame draws it.
  - A Locked row's title and detail are both `muted`. The frame dims the
    detail further, to about `muted/60`, which is 3.3:1 on `bg` and fails
    AA, so it stays `muted`.
  - The unlocked narrated row and its headphone are sibling buttons, never
    one inside the other (§ Component Creation Rule).
  - Known gap: `SegmentedControl`'s segments still pair a `className` with a
    `style` function, so their pressed dim never renders (§ Style Exception
    Rules). Prompt 26 fixes it with the others.
  - The 200-row scroll check waits for seeded content (§ Before
    production).
- **Mini player: two sibling buttons.** Changed on 2026-09-25 in
  `components/player/MiniPlayer.tsx`. The play button used to sit inside the
  button that opens M6. On the web a button can't contain a button, and on a
  phone a screen reader reads a button as one element, so the play button
  was hidden inside it. Now a plain `View` holds two siblings: the open
  target (the cover, title and author, padding included, "Open Now
  Playing") and the play/pause button. Nothing else changed: same 56dp bar,
  same labels, same `useMiniPlayer()`.
- **M7 (prompt 21 review).** Made while reviewing prompt 21 against
  `material/9.png` (M7's frame) and the code as built by prompts 12–20.
  Built as decided (next entry), except that the round button became a
  labelled pill.
  - **M4 gets a My List button.** No frame draws one, and without it nothing
    can put a book on My List. It was planned as a round outlined button left
    of Share, showing a plus or a check, in `body` colour; it shipped as the
    `+ My List` pill ("M7 as built"). M7 has no remove control,
    because its frame draws none. The alternative, adding a book
    automatically when a reader first opens it, was not chosen: My List
    stays the reader's own choice.
  - **Books is every book on My List; Audiobooks is those with narration**
    (`audio_count > 0`). The frame's Books segment shows headphone badges,
    so Books is not "text only". The counts in the labels are real.
  - **Continue spans every book**, through a new `recentPositionsOptions()`:
    the newest 100 positions, with the chapter embedded. `resumeTargetOptions()`
    is per book, so the old line that Library reuses it was wrong. Books
    shows the newest row under "Continue Reading"; Audiobooks the newest row
    whose `last_mode` is `audio`, under "Continue Listening". The book need
    not be on My List.
  - **The resume button respects `last_mode`.** Audio opens M6 with
    `play: "1"`, because it is a play button; text opens M5. It falls back to
    the other mode when the chapter lacks that side. A Locked chapter opens
    nothing (`TODO(paywall)`). Its icon matches the destination.
  - **The eyebrow reads "Reading" or "Listening"**, from `last_mode`. The
    frame's "Reading & Listening" doesn't say what the button will do.
  - **Progress is "Chapter n of m"**, with the bar at n / `chapter_count`,
    on the card and on the grid alike. No "% complete": a text offset has no
    text length to be measured against. A grid book with no row among the
    newest 100 shows no line.
  - **"Recently added", not "Recently Updated"**: My List is ordered by
    `created_at desc` (§ Phase 2), when the book was saved. Static text, not
    a control.
  - **One request per list, through embeds.** `library_items` embeds
    `books_catalog!inner`, and `reading_positions` embeds
    `chapters_catalog!inner`. PostgREST resolves both, and the generated
    types carry them. `!inner` drops unpublished books.
  - **Freshness.** The parity writer marks the recent-positions key stale
    without fetching, and M7 refetches stale keys on focus. Catalog sync
    invalidates both library keys on every change.
  - **The add is an upsert with `ignoreDuplicates`** on
    `library_items_user_book_key`, so a double tap writes one row. Add and
    remove are optimistic, scoped per book so they run in order, and paused
    while offline. A paused change isn't persisted, so closing the app while
    offline drops it; accepted. A server error rolls back.
  - **`ProgressBar` joins `components/ui/`**, as § Component Creation Rule
    anticipates. Onboarding's demo bar stays as it is.
- **M7 as built (prompt 21).** Built on 2026-09-25. Not yet checked on a
  phone: the owner's checklist is at the end of prompt 21.
  - `app/(tabs)/library.tsx` is one `FlatList`: the header, the segments,
    Continue and the My List heading are its header, the books its items
    (3 columns), and My List's states its empty component. The parts are in
    `components/library/`. `hooks/use-library.ts` resolves the screen, and
    `lib/library.ts` holds the pure parts, tested in
    `lib/__tests__/library.test.ts`.
  - **Two lists, one request each.** `libraryItemsByUserOptions()` embeds
    `books_catalog!inner`. `recentPositionsOptions()` reads the newest 100
    positions under `readingPosition.recent(userId)`, embedding
    `chapters_catalog!inner(number, access, has_text, has_audio,
    audio_duration_seconds)`. Both embeds were checked against the live API
    on 2026-09-25. The Continue card adds its book (`bookDetailOptions()`),
    the settings and the unlocks. Coming from M4 those are usually cached,
    and so is My List, which M4 now reads for its pill. Nothing is queried
    per grid book.
  - **Freshness.** After each row it saves, the parity writer marks
    `recent(userId)` stale with `refetchType: "none"`, so a flush never
    fetches (tested in `lib/parity/__tests__/writer.test.ts`). On focus, M7
    calls the writer's `flush()` first, then refetches its two keys if
    stale. M5 and M6 flush as they unmount, which comes after M7 regains
    focus; without that flush the card could show the place before the one
    just left. Catalog sync matches both library keys for every account
    with `isLibraryQuery()`.
  - **Where the resume button goes** is `resumeTarget()`: M6 with
    `play: "1"` for audio, M5 for text, the other mode when the chapter lacks
    that side, nothing for a Locked chapter (disabled, `TODO(paywall)`). The
    lock is `lockStateFor()`'s, as on M5 and M6. Every tap pushes, so back
    returns to Library.
  - **`hooks/use-my-list.ts` is the only writer of `library_items`.**
    `addToMyList()` sends `on_conflict=user_id,book_id` with
    `resolution=ignore-duplicates` (`ON CONFLICT DO NOTHING` on
    `library_items_user_book_key`), and its body is `book_id` alone, checked
    by capturing the request. The change is optimistic, scoped
    `my-list:<bookId>`, and keyed by the list's own key, so only the last
    change to settle refetches. A server error rolls back and announces
    "Couldn't update My List".
  - **Paused mutations are not persisted.** `components/providers.tsx` sets
    `shouldDehydrateMutation: () => false`. TanStack's default persisted
    them, but a restored mutation has no `mutationFn`, so it failed silently
    on the next start.
  - **Sign-out.** `queryClient.clear()` empties the mutation cache and its
    per-scope queues, and a paused mutation resumes only through them, so a
    paused add is never sent under the next account. Tested, with a control
    run showing the test fails without `clear()`.
  - **`ProgressBar`** (`components/ui/progress-bar.tsx`) takes `value`,
    `height` and `track`. The card's bar and the grid line are both 3dp, as
    measured. The grid line has no track, as the frame draws it. Screen
    readers skip it; the labels say the progress in words.
  - **Live time left, added at the owner's request.** The bar stays progress
    through the book. A Listening card adds the time left in its chapter,
    "Chapter 1 of 13 · 2:00 left", counted as M6 counts its remaining time.
    While that chapter is loaded in the player, `useLoadedSecondsLeft()`
    (`hooks/use-audio.ts`) reads the player: the time counts down each
    second and holds while paused, and only the card re-renders. Otherwise
    it comes from the saved `audio_ms` and the chapter's
    `audio_duration_seconds`. An unknown length shows no time, never
    "0:00". Screen readers hear whole minutes. A Reading card shows no time:
    there is no text length.
  - **Library follows the player.** A listening row, on the card and in the
    grid, gives way to the chapter loaded in the player within the same book
    (`followsLoadedChapter()`), so autoplay moves both on without leaving
    Library. A reading row never does. Turning the card's bar into a chapter
    timeline was rejected: the card and the grid line would disagree about
    one book.
  - **The `+ My List` pill, added at the owner's request.** A bare plus could
    mean follow, download or anything else. M4's button is a labelled 44dp
    pill in Share's outline and `body` colour: "+ My List", then
    "✓ In My List", which is also the confirmation. Its spoken label starts
    with the words on it ("My List. Add {title} to My List"). Not a
    bookmark, which in M5 marks a place in a chapter, and not a heart, which
    reads as "like". Library's empty state says "Tap + My List on a story's
    page to save it here.", under a plus-in-a-circle icon.
  - **M4's cover moved down.** `BOOK_CONTENT_TOP` is 66, not
    `material/6.png`'s 48, so the cover starts 8dp below the floating top
    bar. At 48 the pill covered the cover's top corner.
  - **Type sizes.** The frame's Inter text measures 12px (grid titles, the
    progress label, the caption) and its eyebrow about 9.5px. They are built
    at 14px and 12px, under § Typography. Fraunces follows the frame: "My
    Library" 24px, section headings 18px, the card's title 16px. The search
    button is the frame's 36dp disc, with 4dp of hit slop to reach 44dp. The
    segments keep their 44dp and `muted/25` fill.
  - **States.** Loading shows a skeleton segment bar and grid under the real
    header. Offline or failed with nothing cached, the segments show bare
    labels above a message (failed has Retry). Continue collapses when it
    has nothing to show and never blocks My List.
  - Known gaps: a book last opened beyond the newest 100 positions shows no
    grid line. Library follows the player only within one book, so a book
    newly started in the player shows once Library next gains focus.
- **Downloads (prompt 24 revision).** Asked for by the owner on 2026-09-25:
  downloads are offline copies, as YouTube and Udemy make them, not files the
  reader owns. Prompt 24 carries the detail; review it against the code again
  after prompts 21–23.
  - **App-private storage only.** Downloads live in `downloads/` under
    `Paths.document`, with the chapter id as the file name. No shared
    storage, no media library, and no storage or media permission.
  - **Tied to the account.** Sign-out deletes every download, and an index
    left by another account is deleted on start.
  - **Access is checked again.** Online, a download the reader has lost
    access to is deleted. Offline, a download works for 30 days after its
    last check. The owner settled 30 days on 2026-09-25: Spotify uses the
    same rule, it covers a long trip, and it still ends a lapsed
    subscription within a month. It is kept in one constant.
  - **No backups.** `android.allowBackup: false`.
  - **No encryption in version one.** Android's sandbox, the account tie and
    the 30-day rule give most of the protection. Encrypting would need a
    native player that decrypts as it plays.
  - **Text is a file too.** A chapter's download is its audio file plus its
    text file, and chapter text leaves the persisted TanStack cache, which
    closes the 2 MB risk under § Before production.
  - **Offline without the cache.** The index keeps the metadata M5 and M6
    need to open a download on a cold start with no network.
  - **No resume within a file.** `expo-file-system`'s new API cannot resume,
    so an interrupted chapter starts over. The queue resumes by chapter.
  - **Where readers manage them.** M9's "Download all" (with a size
    confirmation) and a row long-press sheet for one chapter. The owner
    settled long-press on 2026-09-25 for version one: no frame draws a
    per-chapter download button, and "Download all" is how serial readers
    go offline. Get a designed row button if readers ask for single
    chapters. A Downloads
    screen, `app/downloads.tsx`, opened from M11's "Downloads & offline
    storage" row. M3's offline state links to it. M7 has no downloads
    segment.
  - **`expo-file-system` approved** by the owner on 2026-09-25 as a direct
    dependency (§ Tech Stack).
  - **Compressed narration decided** (next entry): a 40-chapter book falls
    from about 1.7 GB as WAV to under 300 MB.
  - **Reviewed again on 2026-09-28** against the code as built through
    prompt 23a: § Decisions — 2026-09-28, "Downloads (prompt 24 review)".
- **Narration format.** Decided by the owner on 2026-09-25, and recorded in
  the dashboard's AGENTS.md, which owns uploads (Upload Rules, "Narration
  format").
  - **The standard:** AAC in `.m4a`, mono, 64 kbps, with the moov atom first
    ("fast start"), so playback starts before the whole file arrives. That is
    about 0.5 MB a minute, against about 2.8 MB for WAV. Use 96 kbps if a
    chapter carries music or effects. `expo-audio` plays it natively on
    Android and iOS.
  - **Live on 2026-09-25:** 8 narrated chapters. 6 were already `.m4a` (at
    about 190 kbps, and short, so they stay). 2 were WAV: Eternal Eclipse ch1
    (28 MB) and Man of Ashes 001 ch1 (30 MB). The owner is converting those
    two with ffmpeg and replacing them in the dashboard, which writes new
    immutable paths. Readers' `audio_ms` positions stay valid, because the
    timing doesn't change. **Still WAV on 2026-09-28** (29,378,490 and
    31,116,090 bytes, 384 kbps); the other six are `.m4a` at about 195
    kbps. Prompt 24 reports them again before it builds.
  - **Converted on 2026-09-28, waiting for the owner's upload.** Both WAVs
    were downloaded under a short-lived admin token and converted with
    `ffmpeg -i in.wav -ac 1 -c:a aac -b:a 64k -movflags +faststart
    out.m4a`, into `C:\Users\PC\Desktop\talebrim-narration\`:
    `eternal-eclipse-ch1.m4a` (5,336,406 bytes) and
    `man-of-ashes-001-ch1.m4a` (5,577,220 bytes). The sources were 24 kHz
    mono PCM; the outputs are AAC, mono, about 69 kbps, `moov` before
    `mdat`, and their durations match the sources to the millisecond
    (612.05 s and 648.25 s), so saved positions stay valid. The owner
    replaces each chapter's narration in the dashboard's chapter editor,
    which writes the new path, size and duration.
  - **The dashboard stops accepting WAV** through its own Settings screen:
    the accepted audio formats become `.m4a` and `.mp3`. The owner makes that
    change, because this app never writes `app_settings`. The live list also
    held `.aac`, which the dashboard's upload code and the `audio` bucket
    both reject, so it goes too.
  - Nothing in this app changes: it plays whatever `audio_path` names.
- **M3's hero badge and teal.** Changed at the owner's request on 2026-09-25,
  after comparing the app with `material/3.png`. The badge now reads "New
  Serial" (next entry).
  - **Teal for "Audio Parity" and "See all"**, as the frame draws them. The
    owner lifted prompt 09's "do not use teal anywhere else on this screen".
    § Colors already allows it: "Audio Parity" is an audio affordance, and
    "See all" a secondary accent. The "Audio Parity" row now shows only for a
    narrated book: teal marks audio, and a text-only book has no audio
    length, as on M4.
  - **The badge reads "★ Newest Serial", not "★ #1 Trending Serial".** There
    is still no metric to rank by (prompts 09 and 10, § Data Contract), so a
    rank would be a false claim about whichever book is newest. The hero is
    the first row of a newest-first query (`created_at desc`), so "Newest" is
    true on every tab. It keeps the frame's star, on one line: the frame's
    second line is its phrase wrapping inside a too-narrow pill. If the hero
    is ever chosen another way, its label changes with it.
- **M3's hero carousel and Continue.** Asked for by the owner on 2026-09-25
  (the "now" step of the retention recommendations below).
  - **The hero is a carousel of the tab's 5 newest stories**
    (`components/discover/hero-carousel.tsx`, rules in `lib/hero.ts`), each
    page the existing `HeroCard`. It moves on every 7 seconds
    (`HERO_ADVANCE_MS`: 5 is too short to read a title and decide, 10 feels
    stuck). No bounce, no parallax.
  - **The slide is Reanimated, not a scroll view** (changed 2026-09-25 at
    the owner's request: the paging scroll was too quick). Pages sit on one
    track that Reanimated slides, so the timing is the same on every
    platform: a scroll view's own paging animation is short and fixed, and a
    browser's smooth scroll can't be timed. The timer glides over 700 ms
    (`HERO_SLIDE_MS`, `Easing.bezier(0.45, 0, 0.15, 1)`: a gentle start and
    a long soft landing). A swipe follows the finger through gesture-handler
    and settles in 350 ms (`HERO_SETTLE_MS`, ease-out); a flick moves a page
    however short, never more than one (`settlePage()`). It loops forward
    without rewinding: the track holds a copy of the last page before the
    first and of the first after the last, and jumps from a copy to the page
    it shows once it lands (`wrapPage()`). The dots grow and brighten with
    the slide. Screen readers reach only the page on show and step through
    the stories with the dots, an adjustable control ("Newest stories, 2 of
    5").
  - **The reader stays in control** (WCAG 2.2.2, § UI Quality Bar): it
    pauses under a finger, stops for good once they swipe, and moves only
    while Discover is on screen and the app in front, never with Reduce
    Motion or a screen reader on (`useHeroAutoAdvance()`, with
    `hooks/use-reduce-motion-enabled.ts`; since 2026-10-02
    `useHeroMayAdvance()`, with "on screen" left to the carousel's
    focus-driven timer: Decisions — 2026-10-02, "Tab switches render less").
    One story: no swiping, no dots.
    Each genre tab has its own five.
  - **The badge reads "★ New Serial"**, replacing "Newest Serial": only the
    first page is the newest, and every page is one of the five newest.
  - **The five change when a story is published, not on a timer.** Catalog
    sync already brings a new story within a second, but the set on screen
    holds while Discover is in view and changes when the tab's own answer
    arrives or Discover regains focus (`nextHeroSet()`), so a page never
    changes under a finger. Edits to the stories on screen show at once. A
    new chapter of an old story is not a new story; a "New chapters" row
    would need its own column.
  - **Continue on Discover.** The Discover tab (not the genre tabs) opens
    with the Continue card, as M7's Books segment builds it, so a returning
    reader resumes without going to Library. It collapses when there is no
    position. `useContinue()` (`hooks/use-continue.ts`) now builds the card
    for both screens, and `openResumeTarget()` is the one place the resume
    button navigates (and the one `TODO(paywall)`). On Discover its resume
    button is `secondary` (a `raised` disc, `body` icon): the hero's "Read
    or Listen" stays the screen's one ember action. Its heading follows the
    mode: "Continue Listening" or "Continue Reading".
  - `useIsForeground()` moved out of catalog sync into
    `hooks/use-is-foreground.ts`, shared with the carousel.
  - **Web preview (fixed 2026-09-25, found by the owner).** The carousel
    moved on Android but not in the browser: react-native-web's
    `isScreenReaderEnabled()` always answers true, because a page cannot
    tell. `useScreenReaderEnabled()` now returns false on the web outright,
    not from state, since a hot reload kept a `true` stored earlier. The same
    wrong answer had held M5's toolbar open in the browser. In development, a
    `[hero] not moving on its own: …` log names the reason it is holding
    still.
  - **Checked by the owner on 2026-09-25:** moving on BlueStacks (Android),
    and in the web preview after the fixes above and a full reload; the
    700 ms glide accepted in place of the scroll view's quicker slide. Teal
    "Audio Parity" and "See all", "★ New Serial", and Continue on Discover
    show in the owner's screenshots. Not yet checked on a phone.
- **Retention and revenue, decided by the owner on 2026-09-25.** Aimed at
  "come back more often and read more chapters", never at keeping readers
  longer than they meant: no invented urgency or rankings, no ads that are
  hard to close. The owner said yes to all of it, on the condition that the
  methods are proven. They are, in serial fiction: Kakao Page built its
  business on "wait or pay", and Webtoon, Tapas, Pocket FM and Webnovel use
  versions of it; every serial platform sends new-chapter alerts. Nothing is
  guaranteed for one app, which is why analytics comes first. The carousel
  and Continue on Discover are built (previous entry). The rest is written
  into the prompts, each still to be reviewed against the code before it is
  built:
  - **The chapter end is the revenue moment.** When the next chapter is
    locked, M5's end-of-chapter Next, M6's next and autoplay open M5a
    naming it, never a dead end. Prompt 22's note.
  - **M5a offers three ways in:** unlock free, watch an ad, go ad-free. Its
    one ember action is "Unlock free" while the reader's free unlock for the
    book is available, otherwise "Watch ad & continue" (§ M5a). Prompt 22
    lays the sheet out; prompt 23 wires the two unlocks.
  - **Wait-for-free:** one free unlock per reader per book every 24 hours,
    by the server's clock, permanent like every unlock, never offered on a
    chapter the reader can already open. Server-written only: recommended as
    two `security definer` functions, `claim_wait_unlock(chapter_id)` and
    `wait_unlock_status(book_id)`, and a `wait` value for `unlocks.source`,
    in an additive migration from the dashboard repo. Prompt 23's note,
    which also flags that its step 7 (the app writing ad unlocks) breaks
    "Unlocks are server-written only".
  - **Analytics: PostHog**, explicit events only, the Clerk user id as the
    identity and reset at sign-out, no text, titles or search terms. Its own
    prompt, 21a, runs in Expo Go; prompts 22, 23 and 23a add their events.
    Open for the owner: the EU or US region, the privacy policy and Play's
    Data safety form, and whether EU readers must opt in first. No IP
    address and no location, decided by the owner the same day: the project
    discards the IP, and every event carries `$geoip_disable`, because
    PostHog's GeoIP reads the IP before the setting drops it.
  - **Analytics as built (prompt 21a), two runtime bugs found and fixed on
    2026-09-25** while checking the first day's events in PostHog:
    - **The web build's server render was sending its own events.**
      `app.json` sets `web.output: "static"`, so every web page renders once
      in Node before the browser gets it, and `lib/analytics.ts`'s
      module-level client was created there too — with no `window`, no
      device, and a fresh anonymous id per render. It sent 217 of the first
      223 Application Opened events, each unattributable to a real session.
      Fixed: the client is `disabled` whenever `typeof window ===
      "undefined"`, on top of the existing no-key disable. Native and the
      browser preview both have `window`; only the Node render doesn't.
    - **A Fast Refresh created a second client, doubling lifecycle events.**
      PostHog's RN client adds an `AppState` listener in its constructor and
      never removes it, so re-running `lib/analytics.ts` (as Fast Refresh
      does on any edit to the module or its imports) left the old listener
      running under a new client. Application Backgrounded/Became Active
      fired twice per transition, and one copy of each event carried no
      `$screen_name` (rebuilt before the screen tracker's Fast-Refreshed
      state re-populated). Fixed: the client is kept on `globalThis` and
      reused, so re-running the module returns the existing instance rather
      than constructing a second one. A change to the client's own options
      (host, `captureAppLifecycleEvents`, etc.) now needs a full reload, not
      just a Fast Refresh, to take effect.
    - Both fixes are covered in `lib/__tests__/analytics.test.ts`: one test
      asserts `disabled` with no `window`, one asserts a second module run
      reuses the same client instance rather than capturing through two.
    - **Old test data already in PostHog was not code the app runs**, so
      nothing in the repo could clean it: PostHog has no per-event delete,
      only per-person (optionally with their events) or per-project. The
      owner's two test accounts (57 and 139 events, both carrying IP and
      Lagos location from before the fixes above) need deleting through
      PostHog's People tab, with their events — Claude Code's auto mode
      refuses irreversible deletes even with `--confirm` on the MCP tool, so
      this is a manual, owner-side step, not yet done as of 2026-09-25. The
      217 anonymous server-render events have no person record, so removing
      them would need resetting the whole PostHog project (a new project
      token, and re-doing every onboarding toggle); left in place, tagged
      `development`, since they never reach a `production` insight.
  - **New-chapter notifications:** its own prompt, 23a, after the deferred
    setup. Asked once, when a reader first adds a book to My List, never at
    launch. Only for books on My List, several chapters bundled into one
    alert. A tap opens M4. It needs a `push_tokens` table and a way to find
    new chapters on the server. The trigger on `chapters` first planned
    here was replaced at review by a scheduled job, which changes no
    dashboard-owned table (below, "New-chapter notifications (prompt 23a
    review)"). The owner's yes still comes before the migration.
  - **More stories** through the dashboard: 3 are published.
- **Development build (the deferred setup, first part).** Started on
  2026-09-25 because the owner found the lock-screen controls, the playback
  notification and the headphone buttons not working. None of them can work
  in Expo Go, so the fix was the development build, not a code change.
  - **Owner's choices:** package `com.talebrim.app`; the EAS project on the
    Expo account `ayoko123` (`@ayoko123/talebrim-app`), which also holds the
    Android keystore; and a patch to `expo-audio` for unplugging, over a local
    module.
  - **Added:** `expo-dev-client`, `eas.json` with a `development` profile (an
    internal APK), `android.package`, `extra.eas.projectId` and `owner` in
    `app.json`, `patch-package` with a `postinstall` script, and
    `patches/expo-audio+57.0.5.patch`. `eas init` also wrote a fixed
    `android.permissions` list and an empty `extra.router` into `app.json`;
    both were removed, so the plugins stay the only source of permissions.
  - **Unplugging and Bluetooth disconnects pause.** `expo-audio` 57.0.5
    builds its ExoPlayer without `setHandleAudioBecomingNoisy`, so on Android
    audio carried on through the speaker. The patch turns it on. ExoPlayer
    then pauses itself, and `player.ts` records that pause like any other
    (a lock-screen pause takes the same path). Only `AudioPlayer.kt` is
    patched: the app never uses `expo-audio`'s playlist.
  - **A source patch needs `buildFromSource`.** `expo-audio` ships a
    precompiled Android library (`local-maven-repo/…/expo.modules.audio-
    57.0.5.aar`), and Gradle uses it instead of compiling the sources, so
    the first build ran no `:expo-audio` compile steps and the owner's phone
    kept playing on unplug (found 2026-09-26). `package.json` now has
    `expo.autolinking.android.buildFromSource: ["expo-audio"]`, which makes
    Gradle compile `expo-audio` from the patched sources. Any future patch
    to an Expo module's native code needs the same entry. Check the build
    log for that module's `compile…Kotlin` task: "Applying patches ✔"
    alone doesn't prove the patch was compiled. The rebuilt build passed the
    owner's check on 2026-09-26: unplugging headphones pauses the story.
  - **No notification permission for playback.** Android's documentation
    exempts media-session notifications from Android 13's
    `POST_NOTIFICATIONS`, and `expo-audio`'s notification is a Media3
    media-session one. Asking would be a prompt with nothing behind it, and
    would be refused anyway: the plugin declares the permission only for
    background recording. The phone check confirms it. (Since prompt 23a,
    2026-09-28, the manifest declares it through `expo-notifications`, for
    new-chapter alerts only; playback still never asks.)
  - **`.easignore`**, which EAS reads instead of `.gitignore`: it repeats
    `.gitignore`, and adds `.claude/`, `.agents/`, `.commandcode/` and
    `material/`. The agent folders hold Windows symlinks that EAS cannot
    recreate when it copies the project (EPERM); `material/` is 26 MB of
    design frames the build never uses.
  - **Build with `EAS_NO_VCS=1`** on this PC. With git, EAS packs the
    repository's history too, and the 42 MB upload kept dropping
    (ECONNRESET) partway. Without it the upload is 8 MB. In Git Bash:
    `EAS_NO_VCS=1 npx eas-cli build --profile development --platform android`;
    in PowerShell: `$env:EAS_NO_VCS=1; npx eas-cli build --profile development --platform android`.
  - **Environment variables.** A development build loads its JavaScript from
    Metro on the PC, which reads `.env.local`, so the `development` profile
    needs no EAS environment variables. A preview or production build embeds
    its JavaScript, and will need the `EXPO_PUBLIC_` values set on EAS
    (prompt 21a step 13).
  - **Passed on the phone on 2026-09-26** (§ Deferred setup, step 9): the
    lock screen, the notification's controls, background playback, and
    pausing on unplug and on Bluetooth disconnect. **Still to check:**
    Bluetooth and car buttons. Their "next track" won't change chapter:
    `expo-audio` has no next/previous-chapter controls, as already accepted
    (§ Audio Rules). Note what they do instead.
  - **EAS builds pin Node 24.15.0** (`"node"` in each `eas.json` profile),
    which brings **npm 11.12.1**. EAS runs `npm ci`, which refuses a lock
    file that lacks anything Linux would install. Two builds failed on it:
    - With EAS's default Node 22 (npm 10), the lock lacked `typescript@5.9.3`,
      a peer of Clerk's Solana packages. The Node pin fixed that.
    - The owner's PC runs an older npm, 11.6.2, which leaves out optional
      packages that Linux installs: `bufferutil`, `utf-8-validate` (under
      `rpc-websockets`) and `@emnapi/core`/`runtime`. The lock was rewritten
      with `npx npm@11.12.1 install --package-lock-only`, which only added
      those entries.
    - **After any `npm install` on the PC, rewrite the lock that way before
      building,** or upgrade the PC's npm (`npm install -g npm@11.12.1`).
  - **The native splash shows `assets/Image/logo.png`** (the owner's ember
    mark, as onboarding shows it) on `bg`. `expo-splash-screen` always points
    Android's splash style at `splashscreen_logo`, but creates that image
    only when `image` is set, so without one the build failed at resource
    linking (the third build, 2026-09-25). Don't remove the `image`.
- **Paywall (prompt 22 review).** Settled on 2026-09-25 while reviewing
  prompt 22 against the code and `material/11.png` (M10) and
  `material/5.png` (M9's bar). The prompt carries the detail; the owner may
  flip any of these before it is built.
  - **"Unlock all chapters" is M9's caption for "Go Ad-Free"**, not a
    purchase. The frame draws it as plain muted text beside the ember pill.
    There is no per-book product: one would need a store product per book,
    which a catalog loaded from the dashboard can't keep up with.
  - **M5a has no plan cards.** Its teal "Go Ad-Free" opens M10, the one
    place plans are chosen and bought, carrying the chapter so a purchase
    returns to it. Until prompt 23, M5a has no ember button: "Unlock free"
    and "Watch ad & continue" are `TODO(unlocks)` positions, never visible
    placeholders.
  - **Entitlement is read from `customerInfo` only**, through a TanStack
    query that TanStack doesn't persist: RevenueCat's SDK keeps its own copy
    on the device, which serves offline, and sign-out leaves none behind. The
    lock rule gains `isSubscribed`, and an entitlement not yet known is
    "can't tell yet", never "locked", as with unlocks.
  - **The App User ID is the Clerk user id**: `logIn` beside
    `identifyReader()`, `logOut` in `clearUserScopedState()`.
  - **The entitlement mirror is prompt 22a**, written after prompt 22 is
    built, in the dashboard repo: RevenueCat's webhook → an Edge Function
    (verified by the webhook's authorization header) → an additive
    `entitlements` table keyed by the Clerk user id, with an expiry. Server
    checks read it; the app never writes it. If RevenueCat's plan lacks
    webhooks, the same function is called by the app after a purchase or
    restore, and fetches the subscriber from RevenueCat's REST API with the
    secret key. Until 22a, a subscriber's locked chapter plays no audio once
    the audio storage policy is live (it is, since 2026-09-28): a known gap,
    never patched in the client. 22a closes it by adding the subscriber
    branch at `-- TODO(paywall)` in `public.can_play_audio()`. (Closed
    2026-10-02, with both the webhook and the app's call: Decisions —
    2026-10-02, "Subscriber access on the server as built".)
  - **Android only**, while iOS scope is open. **Entitlement id `ad_free`**,
    one constant.
  - **Every locked path opens M5a**, M5's end-of-chapter Next and M6's
    next included (owner, 2026-09-25). Autoplay stopping before a locked
    chapter opens it only when M6 is on screen. A locked screen offers a
    button to M5a and never opens it by itself.
  - **M10** follows `material/11.png`. For a non-subscriber it preselects
    the "Best value" plan. It keeps AGENTS.md's muted "Cancel subscription"
    link, which the frame doesn't draw. Terms and Privacy render only once
    their URLs exist (none do: a launch blocker).
  - **Store setup is split around a build.** Play Console allows
    subscriptions only after a build with billing is uploaded, so prompt 22
    adds an EAS `production` profile (an app bundle) and stops while the
    owner uploads it to internal testing and creates the products.
  - **Billing never runs where it can't:** not in the web build's server
    render, not on the web, not in Expo Go if the SDK can't, and not without
    a key (the lesson of prompt 21a's analytics).
- **Paywall as built (prompt 22, code only).** Built on 2026-09-25 at the
  owner's request before its preconditions were met: the deferred setup is
  still open, and there is no Google Play app, RevenueCat project or
  `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` yet. So step 17's store setup and
  step 18's sandbox tests wait, and nothing below has run against a store.
  - **`lib/revenuecat.ts`** holds `ENTITLEMENT_ID = "ad_free"` and the one
    client. `billingAvailable()` is false without a `window` (the server
    render), off Android, in Expo Go and without the key; every call is then
    a no-op and the entitlement reads "not subscribed". In Expo Go the SDK
    would fall back to a browser mode that takes only Test Store keys. The
    SDK is `require`d on first use, configured with the Clerk user id as
    its App User ID, so no anonymous id is made first. Identity changes run
    one at a time; before every call `getAppUserID()` is checked and
    `logIn` runs if it differs. `logOutBilling()` in
    `clearUserScopedState()` skips an anonymous user. The listener forwards
    only while its account is the one logged in.
  - **The entitlement** is `entitlementOptions(userId)`
    (`lib/queries/billing.ts`, `networkMode: "always"`: the SDK answers
    offline from its own copy). The listener writes each update into it
    (`components/providers.tsx`). `shouldPersistQuery()` drops every
    `billing` key. `hooks/use-entitlement.ts` reads it.
  - **The lock rule** takes `isSubscribed` (`types/states.ts`, tested in
    `types/__tests__/states.test.ts`). `lockStateFor()` has a fourth
    argument: an unlock or a subscription opens a chapter as soon as either
    is known to; it is locked only once both are known. M4, M5, M6, M9,
    Continue, M5a and the player's `resolveChapter()` all pass it, and M4's
    and M9's rows wait for the entitlement as they wait for the unlocks.
  - **Every locked path pushes M5a** through `openPaywall()`
    (`lib/paywall.ts`): M4's Read, Listen and preview rows; M9's rows
    (`ChapterRowOpens` gains `paywall`, with the mode the tap was going to);
    Continue on M3 and M7 (`ResumeTarget`'s `locked` carries the chapter and
    mode, and the button is enabled); M5's "Next chapter" and M6's next when
    that chapter is locked; the "Unlock chapter" button on M5's and M6's
    locked states. Autoplay stopping before a locked chapter is reported by
    `onStoppedBeforeLocked()` (`lib/audio/player.ts`, tested), and M6 opens
    M5a only while focused with the app active. `ChapterVerdict`'s `locked`
    now carries its chapter id.
  - **M5a** is `app/paywall/[chapterId].tsx`, a `transparentModal` with a
    fade (the scrim would slide with the screen). Lock icon, Fraunces
    headline, the value line, teal `Go Ad-Free`, then muted Restore
    purchases (hidden where billing can't run) and Manage subscription
    (only with a management URL). The two ember actions are
    `TODO(unlocks)` comments for prompt 23. `hooks/use-paywall-chapter.ts`
    resolves the lock; a chapter that turns out open replaces the sheet,
    once. Go Ad-Free replaces the sheet with M10, carrying the chapter,
    mode and `from`, so back from M10 skips the sheet.
  - **After a purchase or restore from M5a's path** the chapter replaces
    M10 in its mode (`openUnlockedChapter()`), except from a chapter's own
    locked screen, where M10 only goes back: that screen is the chapter,
    and it opens by itself as the entitlement lands.
  - **M10** is `app/subscription.tsx`, with `hooks/use-plans.ts`,
    `hooks/use-purchase.ts` (the one purchase path) and
    `components/subscription/`. `lib/billing.ts` builds the plans (tested
    in `lib/__tests__/billing.test.ts`): ordered by period, savings per
    week against the shortest plan from the store's `pricePerWeek`,
    rounded down, "Best value" for the most. Sublines use only the store's
    strings: the shortest plan "Billed every 7 days", the others
    "{per week}/week", plus " · Save N%" on Best value. The frame's
    "Save $4.97 vs weekly" would need a currency formatted by hand, so it
    isn't built. The status card is `raised`, as the frame measures
    (#2C1E42), not `surface` as prompt 22 step 14 says; plan cards are
    `surface` with a `raised` hairline and a 2dp ember border when
    selected. A switch passes `{ oldProductIdentifier }` with no
    replacement mode: the bridge sends null, and purchases-android then
    uses its default, `WITHOUT_PRORATION` per RevenueCat's docs (the
    default lives in the native AAR; confirm in the sandbox).
  - **The store's product title** drops a trailing parenthesis, the app
    name Google Play appends (`storeTitle()`); confirm on the phone. A plan
    no longer in the offering, or offline, shows "Ad-Free".
  - **M9's bar** (`AdFreeBar` in `app/chapters/[bookId].tsx`) shows when
    `showAdFreeBar`: not subscribed, and a row locked. M9's ember action is
    now its "Go Ad-Free", beside the Reading row's progress marker.
  - **New shared UI:** `TextLink` in `components/ui/`, and `Button`'s
    `accent` variant (teal outlined, the `btn--audio` pill, for secondary
    actions that aren't audio). `formatDate()` in `lib/format.ts`.
  - **`constants/legal.ts`** holds the Terms and Privacy URLs, both null.
    M10 renders a link only for a URL that is set.
  - **`eas.json` gains `production`:** Node 24.15.0, `autoIncrement`, an
    Android app bundle, EAS environment `production`. Its `EXPO_PUBLIC_`
    variables are not created yet (step 17).
  - **Analytics:** `paywall_shown`, `plan_selected`, `purchase_started`,
    `purchase_completed`, `purchase_cancelled`, `purchase_failed` (`kind`:
    `pending`, `already_owned`, `store_unavailable`, `network`, `other`),
    `restore_tapped` and `restore_completed`. Ids and fixed words only.
- **Build order from here.** Decided by the owner on 2026-09-25, after
  prompt 22's code was built: RevenueCat and rewarded ads go last, before
  only the two passes.
  1. The rest of the deferred setup (§ Deferred setup). Prompt 23a needs the
     development build on the phone, and prompt 24 signs downloads under
     the audio storage policy (step 8, live since 2026-09-28).
  2. Prompt 23a, new-chapter notifications. Built 2026-09-28 (Decisions —
     2026-09-28); its device checks are open.
  3. Prompt 24, offline downloads. Reviewed 2026-09-28 (Decisions —
     2026-09-28, "Downloads (prompt 24 review)"). Step 8 and step 5's
     second reader account were done the same day, so it waits only for
     the development build with prompt 23a on the phone.
  4. Prompt 25, M11 Profile. Its billing parts (Restore purchases, Manage
     subscription, "See plans", the plan badge) are built on prompt 22's
     code and behave as M10 does until RevenueCat is set up.
  5. RevenueCat and Google Play: prompt 22's store setup (step 17) and
     sandbox tests (step 18).
  6. Prompt 23, rewarded ads and wait-for-free.
  7. Prompts 26 and 27, the states and accessibility passes. Last, because
     they go over every screen, M5a's two ember actions from prompt 23
     included.
  - **Until step 5, billing stays off:** every reader is "not subscribed",
    and M5a's Go Ad-Free leads to M10's "available in the Android app"
    message. Accepted: there are no real readers yet.
  - **Start the Google Play developer account now anyway.** It has the
    longest lead time left: identity verification takes days, and a
    personal account must run a closed test with at least 12 testers for
    14 days before production access. AdMob, for prompt 23, has its own
    approval. Neither waits on any prompt.
- **New-chapter notifications (prompt 23a review).** Settled on 2026-09-25
  while reviewing prompt 23a against the code, the deferred setup and
  `material/3.png`, `6.png` and `10.png`. The prompt carries the detail; the
  owner may flip any of these before it is built.
  - **No trigger on `chapters`.** An Edge Function, `notify-new-chapters`,
    the project's first, runs every 5 minutes from `pg_cron` through
    `pg_net`, finds readable chapters in published books that it hasn't
    seen, and sends. No dashboard-owned table gains anything, so this is not
    a third sanctioned change. The price is up to about 15 minutes'
    delay, which the bundling needs anyway.
  - **Bundling and the cap are per book:** a book sends once none of its
    new chapters is under 10 minutes old, and at most once in 24 hours.
    Held-back chapters go into the next alert. (Both removed on 2026-09-30
    by the owner: Decisions — 2026-09-30, "Alerts go out right away".)
  - **New tables, in the dashboard repo:** `push_tokens` (readers select
    their own; written only through `set_push_token(token, enabled)`, a
    `security definer` function that moves a token to the caller or
    releases it), and three server-only tables: `chapter_alerts`,
    `book_alerts` and `push_tickets`. A backfill marks every chapter already
    readable as sent.
  - **Sign-out stops alerts** by releasing the phone's token before Clerk's
    sign-out, bounded like the parity flush. Offline, the next sign-in on
    the phone releases or claims it.
  - **One permission request in the whole app**, this prompt's: playback
    never asks (§ Deferred setup, step 9). The "New chapters" channel is
    created at "Notify me", never at launch, and hides its content on a
    secure lock screen, since every live book is `mature_17`.
  - **The ask:** once, after the first My List add the server confirms, as
    a sheet (`app/alerts.tsx`, shaped like M5a's). "Not now" is remembered
    per account in a new persisted `notifications` slice, cleared at
    sign-out. The bell on Discover, a no-op until now, opens the same sheet
    to turn alerts on or off; no inbox. M11's switch comes with prompt 25.
  - **Android only**, and push never loads on the web, in the server render
    or in Expo Go (`lib/push.ts`, shaped like `lib/revenuecat.ts`).
  - **Owner:** a Firebase project, `google-services.json` committed, the FCM
    V1 key uploaded to EAS, Expo's enhanced push security with its access
    token in the function's secrets only, and a notification icon, which
    is not supplied yet (`// MISSING ASSET: notification-icon`).

## Decisions — 2026-09-28

- **New-chapter alerts as built (prompt 23a).** Built on 2026-09-28 as
  reviewed (Decisions — 2026-09-25, "New-chapter notifications"). The
  server side is live. The device checks at the end of prompt 23a wait for
  the development build made that day.
  - **The SDK.** `expo-notifications` 57.0.21. Used: `getPermissionsAsync`
    and `requestPermissionsAsync` (`granted`, `canAskAgain`),
    `setNotificationChannelAsync` (`AndroidImportance.DEFAULT`,
    `AndroidNotificationVisibility.PRIVATE`), `getExpoPushTokenAsync` with
    the EAS project id from `expo-constants`, `addPushTokenListener`,
    `setNotificationHandler` (`shouldShowBanner`, `shouldShowList`, no
    sound, no badge), `addNotificationResponseReceivedListener`, and
    `getLastNotificationResponse` with `clearLastNotificationResponse` for
    a cold start. Importing it logs a warning in Expo Go, and asking Expo
    Go on Android for a push token throws; the server render and the web
    never load it. Android's token needs no permission, so a sign-in with
    alerts off can release a token without prompting. The package's own
    manifest declares `POST_NOTIFICATIONS` (Android 13+'s prompt) and
    `RECEIVE_BOOT_COMPLETED`.
  - **The app.** `lib/push.ts` is the one push client, shaped like
    `lib/revenuecat.ts`: `pushAvailable()` is false without a `window`, off
    Android and in Expo Go, and every call is then a no-op. Its calls to
    `set_push_token()` run one at a time, so a sign-out's release never
    lands after the next account's registration. `lib/alerts.ts` holds the
    pure rules (the ask, the permission, a tap's book), tested in
    `lib/__tests__/alerts.test.ts`. `hooks/use-alerts.ts` holds the sheet's
    state and answers, the first-add ask, the sign-in sync and the taps.
  - **The sheet** is `app/alerts.tsx`, a `transparentModal` like M5a, with
    `from` (`my_list` or `bell`). M5a's scrim and sheet moved into
    `components/ui/sheet.tsx` (`Sheet`), which both use. States: off (the
    ask, with the ember "Notify me" and "Not now"), on ("Turn off"),
    blocked ("Open settings") and unavailable. The permission is read again
    when the reader comes back from Android's settings. "Not now", a
    refusal at the system's prompt, and closing the sheet while it asks
    (the scrim or Android back, through `beforeRemove`) are all "Not now".
  - **The ask** (`useAskForAlerts()`) runs from `use-my-list.ts`'s
    `onSuccess` for an add: once per account, only with the notifications
    slice rehydrated, and only while M4 is focused and the app in front.
  - **The `notifications` slice** (`store/notifications-store.ts`,
    version 1): `answered` and `enabled`, persisted, cleared by
    `clearUserScopedState()`. Not on the hydration gate;
    `useAlertsSync()` waits for it instead, so a cold start never releases
    a reader's token before it knows alerts are on.
  - **The server learns** at each sign-in and each start signed in: on,
    only while Android still allows notifications (turned off in its
    settings since counts as off, and the slice follows), and otherwise
    released. Also on a token change, with alerts on. Offline, the next
    start tries again.
  - **Sign-out releases the token side by side with the parity flush,**
    each bounded at 2 seconds, before Clerk's `signOut()`. A deviation from
    prompt 23a step 6 ("after the parity flush"): one after the other would
    make an offline sign-out wait 4 seconds, and the two don't depend on
    each other.
  - **Taps** (`useAlertTaps()` in the root navigator): each alert once, by
    notification id, the default action only, a `book_id` that passes
    `isUuid()`, and only signed in and past onboarding. A tap on a
    signed-out phone is dropped, not kept for after sign-in.
  - **Analytics:** `notify_prompt_shown`, `notify_prompt_accepted` and
    `notify_prompt_declined` (each with `from`), `alerts_turned_off` and
    `notification_opened` (`book_id`). Never a token.
  - **`app.json`:** the `expo-notifications` plugin with `color` ember and
    no `icon` (`// MISSING ASSET: notification-icon` sits in `lib/push.ts`,
    since JSON takes no comment), and `android.googleServicesFile`.
  - **The server** (dashboard repo, migration `20260928120000`, applied
    2026-09-28): `pg_cron` and `pg_net` enabled; `push_tokens` and
    `set_push_token()`; the server-only `chapter_alerts`, `book_alerts` and
    `push_tickets`; and three `service_role`-only steps:
    `notify_find_new_chapters()`, `notify_due_books()` and
    `notify_mark_sent()`. The backfill marked 25 chapters sent. Types
    regenerated in both repos: additions only, 171 lines each.
    `supabase/verify/new_chapter_alerts_rls.sql` runs 57 checks (readers A,
    B and C, `anon`, an admin, `service_role`), all passing, and
    `reader_tables_rls.sql` still passes (47).
  - **The Edge Function** `notify-new-chapters` (the dashboard's
    `supabase/functions/`) is deployed with `verify_jwt` off, as Supabase's
    docs require for a function not called with a user's token under the
    `sb_` keys. It checks a shared secret (`x-notify-secret`) against
    `NOTIFY_CRON_SECRET` in constant time; the same value is in Vault as
    `notify_new_chapters_secret`, where the schedule reads it. It uses its
    own project's secret key (`SUPABASE_SECRET_KEYS`). Expo's access token
    is `EXPO_ACCESS_TOKEN`, set by the owner. None of the three is in either
    repo or this app.
  - **Expo's side** (owner, 2026-09-28): the token is a robot user's
    (`supabase-push`, Developer role), and enhanced push security is on, so
    Expo refuses any push without it. Prompt 23a had recorded this as done
    on 2026-09-26; at the build the account had no token and the toggle was
    off. Expo doesn't document which role may send, so the first real alert
    proves the role: a refusal shows in the function's log as a refused
    message, and the fix is a new token in the same secret.
  - **Live, 2026-09-28:** a manual run through `pg_net` answered 200 (found
    0, due 0), and the schedule (migration `20260928130000`, `cron.job`
    `notify-new-chapters`, `*/5 * * * *`) is active. Its first scheduled
    run, at 17:50 UTC, succeeded with the same 200. A call without the
    secret, or with a wrong one, gets 403. `NOTIFY_CRON_SECRET` was made
    with .NET's `RandomNumberGenerator` and written to the function's
    secrets and to Vault without ever being printed.
  - **Checking it later:** `select * from cron.job_run_details order by
    start_time desc limit 5` shows the runs; `net._http_response` holds each
    run's answer, a JSON count (`found`, `books_due`, `books_sent`,
    `books_without_readers`, `books_failed`, `messages`, `tokens_removed`,
    `receipts_checked`); the function's own log is in the Supabase
    dashboard → Edge Functions → `notify-new-chapters`.
  - **The dashboard's gates** passed after the change: `typecheck`, `lint`
    (0 errors; its 4 existing React Hook Form warnings) and `build`.
    `supabase/functions/` is Deno, so its `tsconfig.json` excludes it and
    `eslint.config.mjs` ignores it; `supabase/config.toml` sets the
    function's `verify_jwt = false`.
  - **The install.** `npx expo install expo-notifications`, then the lock
    rewritten with `npx npm@11.12.1 install --package-lock-only` (§ Decisions
    — 2026-09-25, "Development build"): it added the same four Linux-only
    entries and removed nothing. `.easignore` doesn't exclude
    `google-services.json`.
  - **The development build with it** (EAS build `596d2398`, 2026-09-28)
    finished, and is not yet installed on the owner's phone. The build
    installed before it has no `expo-notifications`, so on it, as in the web
    preview and Expo Go, the bell opens the "work in the Talebrim app for
    Android" message. The owner saw exactly that in the web preview on
    2026-09-28: expected, not a fault. Its manifest (`aapt dump
    permissions`) gained, through `expo-notifications`,
    `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, FCM's
    `c2dm.permission.RECEIVE` and a set of launcher-badge permissions
    (Samsung, Huawei, Oppo, Sony, HTC and others, from its badge library).
    None asks the reader anything; list them in Play's Data safety review.
  - **"10 minutes" is compared at 9**, so the quiet period is two runs of the
    5-minute schedule and a run's few seconds of lateness never pushes an
    alert to a third: a chapter reaches a phone within about 15 minutes.
    (Superseded 2026-09-30: every minute, no quiet period, no cap.)
  - **Copy, flagged for the owner.** Sheet: "Get notified when new chapters
    come out?", "Alerts are only for the stories on your My List.", "Notify
    me", "Not now"; "New chapter alerts are on", "We'll let you know when a
    story on your My List has new chapters." (a line the prompt doesn't
    ask for), "Turn off"; "Notifications for Talebrim are turned off in
    Android's settings.", "Open settings"; "New chapter alerts work in the
    Talebrim app for Android." with a "Close" button (also not asked for:
    the sheet's one way on). Channel: "New chapters", "New chapters of the
    stories on your My List." Alerts: "New chapter of {book}" / "Chapter
    {n}: {title}" or "Chapter {n}"; "{count} new chapters of {book}" /
    "Chapters {first}–{last}"; "a story on My List" if a book has no
    title. The bell's spoken label is "New chapter alerts".
- **Downloads (prompt 24 review).** Settled on 2026-09-28 while reviewing
  prompt 24 against the code as built through prompt 23a, `material/5.png`,
  `10.png` and `3.png`, the live database and build `596d2398`'s APK. The
  model of § Decisions — 2026-09-25, "Downloads" stands. The prompt carries
  the detail. The owner accepted all of it the same day, the
  `chapters_catalog` view change included; prompt 24 writes and applies it.
  - **Preconditions:** deferred setup step 8 (the audio storage policy,
    which is what makes audio downloads safe) and step 5's second reader
    account, plus the development build with prompt 23a. Steps 3 and 7
    (Google sign-in) and the Bluetooth checks don't block it. Step 8 and
    the account were done the same day (next entry); only the build on
    the phone remains.
  - **Storage permissions are blocked in `app.json`.** `expo-file-system`
    declares `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE`, and
    `expo-image`'s Glide `READ_EXTERNAL_STORAGE`, all up to Android 12. Both
    modules are linked already, through `expo`: build `596d2398` carries
    both permissions, and `allowBackup` true. Prompt 24 adds
    `android.blockedPermissions` for the two and `allowBackup: false`, and
    proves both on the next APK.
  - **Exact sizes from `chapters_catalog`.** The dashboard already records
    `chapters.audio_size_bytes`, equal to the stored object for all 8
    narrated chapters on 2026-09-28. The view gains `audio_size_bytes` and
    `text_bytes` (`octet_length(script_text)`), appended, `security_invoker`
    restated: an additive change to this app's own view, with the owner's
    yes. "Download all" confirms a real size, and the disk check is exact.
    A duration times a byte rate would be off by up to six times: narration
    runs 64 to 384 kbps today.
  - **Only a definite answer deletes a download:** every input fetched
    fresh and the lock rule says locked, or the chapter gone from
    `chapters_catalog`. A failed fetch or an entitlement not yet known
    changes nothing.
  - **Changes are found by `updated_at`**, at every online check, not only
    by catalog broadcasts, which a closed app misses. Text is fetched again;
    narration only if its `audio_path` changed.
  - **M3 gains an offline state.** Offline with nothing cached, Discover
    shows its skeleton forever today (the paused query counts as pending).
    "See your downloads" lives there.
  - **M9's row sheet offers Listen**, because in the frame the Downloaded
    disc takes the teal headphone's place. The disc is a sibling button that
    opens the sheet.
  - **Offline autoplay** moves to the book's next downloaded chapter, or
    stops; `resolve.ts` never waits on a paused query for a download.
  - **Sign-out** stops the queue and releases the player before deleting
    `downloads/`, and never touches anything else in `Paths.document`
    (PostHog's files). `allowBackup: false` doesn't stop Android 12+'s
    device-to-device transfer; the account tie in the index covers it.
  - **Chapter text leaves the persisted cache** by a prefix match on
    `queryKeys.chapters.textAll()`: it is nested under `chapters`, which
    `NEVER_PERSISTED`'s roots can't express.
  - **Analytics:** `download_requested`, `download_failed`,
    `download_removed` and `offline_chapter_opened`, ids and fixed words
    only.
  - **Known gap:** until the entitlement mirror (prompt 22a), the storage
    policy doesn't know subscribers, so a subscriber's locked chapter can't
    be downloaded. It fails as refused and deletes nothing. (Closed
    2026-10-02: Decisions — 2026-10-02, "Subscriber access on the server as
    built".)
- **Audio storage policy (deferred setup step 8).** Applied 2026-09-28 with
  the owner's yes: dashboard migration `20260928140000`, the second
  sanctioned change to a dashboard-owned object. The dashboard's AGENTS.md
  (Data Model Notes) holds the full record.
  - **The rule:** `audio_read` became `bucket_id = 'audio' and (is_admin()
    or can_play_audio(name))`, rewritten in place with `alter policy`.
    `public.can_play_audio(object_name)` (`security definer`, `stable`,
    `set search_path = ''`) is true only for a chapter's current
    `audio_path`, in a published book, free by `access`, free by position
    or unlocked by the caller: `resolveChapterState()`'s rule without the
    subscription (`-- TODO(paywall)`, prompt 22a). A malformed path is
    false, never an error. `authenticated` may execute it; `anon` may not.
    (Changed 2026-09-30: never free by position. See Decisions —
    2026-09-30, "A chapter's own access decides". Changed 2026-10-02: the
    subscription too, through `has_active_plan()`. See Decisions —
    2026-10-02, "Subscriber access on the server as built".)
  - **Nothing in the app changed.** `chapterAudioSourceOptions()` already
    treats a refusal ("Object not found") as a reason to re-check the lock
    rule once and show Locked or Not available. Regenerated
    `types/database.ts` gained one line, `can_play_audio`, in both repos.
  - **Replacing narration:** readers can sign only the chapter's current
    file, so an old object left behind by a re-upload plays for no one but
    an admin.
  - **Proven** by `supabase/verify/audio_read_policy.sql` in the dashboard
    repo (20 checks; its dry run, rolled back, caught `anon` still holding
    `EXECUTE` through the project's default privileges, now revoked), and
    by real Storage requests under freshly minted Clerk tokens. Reader B
    signed the free chapters, and each URL served bytes. Locked chapters
    answered 400 `NoSuchKey`, until an `unlocks` row (inserted as the
    server would, then deleted) opened exactly that one. `anon` signed
    nothing; the admin signed all 8. `reader_tables_rls.sql` (47) and
    `new_chapter_alerts_rls.sql` (57) still pass, as do the dashboard's
    three gates.
  - **Reader B** (deferred setup step 5) is
    `talebrim.reader.b+clerk_test@example.com` on the development instance,
    Clerk id `user_3Jy9gRTu1hhpVmKVSzXmJMW0aVa`, with no `metadata.role`.
    It was made through Clerk's Backend API. Clerk sends no email to a
    `+clerk_test` address on a development instance: sign in with the code
    `424242`. It hasn't been through onboarding, so the app shows M2 first.
    It has no unlocks.
- **Downloads as built (prompt 24).** Built on 2026-09-28 as reviewed
  (previous entries). The code, the view change and the tests are done; the
  device checks at the end of prompt 24 wait for a development build made
  after it (below).
  - **Preconditions, checked first:** `audio_read_policy.sql` passed 20 of 20
    against the live database; reader B exists. The build with prompt 23a
    (`596d2398`) was still not on the phone.
  - **Narration (step 2), 2026-09-28:** 8 narrated chapters. 6 `.m4a` at
    about 195 kbps (0.56 to 1.19 MB). **2 WAV at 384 kbps are still live:**
    Eternal Eclipse 1 (29.4 MB) and Man of Ashes 001 1 (31.1 MB). Their `.m4a`
    conversions (5.3 and 5.6 MB) wait for the owner to upload them in the
    dashboard; until then those two download at WAV size, which "Download
    all" states truthfully. `audio_size_bytes` equals the stored object for
    all 8.
  - **The view change:** dashboard migration `20260928150000`
    (`chapters_catalog` appends `audio_size_bytes` and `text_bytes`), shown to
    the owner and pushed with their yes. `security_invoker=on` held
    (`pg_class.reloptions`) and the view's grants didn't change. Regenerated
    types: two added lines in each repo, nothing else. The dashboard's gates
    passed (`typecheck`; `lint` 0 errors, its 4 warnings; `build`), and so did
    `reader_tables_rls.sql` (47), `new_chapter_alerts_rls.sql` (57) and
    `audio_read_policy.sql` (20).
  - **Dependency:** `expo-file-system` 57.0.7, now direct. The lock rewrite
    (`npx npm@11.12.1 install --package-lock-only`) added that one line.
  - **Storage:** `downloads/` under `Paths.document`. Narration is
    `<chapterId>.<ext>` (the stored file's extension), text `<chapterId>.txt`;
    each is written as `<name>.part` and renamed into place once every part
    of the chapter is on disk, then entered in the index. `lib/downloads/
    files.ts` is the only code that touches the file system, and nothing it
    writes, renames or deletes is outside `downloads/`. **Android only**
    (`downloadsAvailable()`): iOS waits for its scope and an iCloud-backup
    exclusion; the web shows no download controls.
  - **`app.json`:** `android.allowBackup: false` and
    `android.blockedPermissions` for `READ_EXTERNAL_STORAGE` and
    `WRITE_EXTERNAL_STORAGE`. `expo config --type introspect` shows both
    permissions as `tools:node="remove"` and `android:allowBackup="false"`.
    **Proven on the built APK** (EAS build `fd1773bc`, finished 2026-09-28):
    `aapt dump permissions` lists no `READ_EXTERNAL_STORAGE`,
    `WRITE_EXTERNAL_STORAGE` or media permission (build `596d2398` had both
    storage permissions, `maxSdkVersion` 32), and `aapt dump xmltree`
    shows `android:allowBackup` 0x0 (false; it was true). The one match for
    "MEDIA" is `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, playback's service, not a
    media-library permission.
  - **The index** (`store/downloads-store.ts`, version 1). Two deviations
    from step 5's list: the account is held once for the whole index
    (`userId`), not per chapter, since an index only ever holds one account's
    downloads; and the book's cover is kept as its resolved public URL, not
    its path, because offline with nothing cached there is no CDN domain to
    resolve a path with, and `expo-image`'s disk cache is keyed by URL. Never
    a signed URL. Not on the hydration gate: M5, M6, M9, M3 and the Downloads
    screen wait for `useDownloadsHydrated()`. `useDownloadsSync()` (root
    navigator) reconciles it with the folder once per account per session,
    then checks it online.
  - **The queue** (`lib/downloads/queue.ts`): module state, one chapter at a
    time, foreground and online only (AppState and `onlineManager`). Leaving
    the app or the network aborts the chapter in flight, deletes its partial
    file and puts it back at the head; it starts over when the app returns.
    (Changed 2026-09-30: it pauses, keeps the bytes and carries on from
    them. See Decisions — 2026-09-30, "A paused download carries on".)
    Before each chapter: the lock rule against settings, unlocks and the
    entitlement no older than a minute, then the free space against its exact
    size plus 50 MB (`DISK_MARGIN_BYTES`). A full disk fails that chapter and
    cancels the rest; a refusal from the storage policy fails it for good; any
    other failed narration download is signed again and tried once more.
    Text is fetched fresh, on the sanctioned terms. A failed chapter keeps its
    reason until the reader tries again. The queue isn't persisted: closing
    the app mid-run drops what was waiting, and Download all picks it up
    again. `expo-file-system` 57.0.7 also has `File.createDownloadTask()`,
    which can pause and resume within one app session; not used, as step 7
    planned without it. Revisit if restarting a long chapter bothers readers.
  - **The access check** (`verifyDownloads()` in `lib/downloads/manage.ts`):
    the downloaded chapters' rows by id (100 ids a request), settings, unlocks
    and the entitlement, all fetched fresh and never retried; any failure
    changes nothing. Locked or gone: files and entry deleted. Open:
    `verifiedAt` moves on, and a moved `updated_at` queues a refresh (text
    again; narration only for a new `audio_path`, the old file deleted if its
    extension changed). It runs at start, on returning to the foreground at
    most once a day, on reconnecting while a download is past its 30 days,
    when M5 or M6 opens a download online, and on a catalog broadcast. **One
    addition to step 8:** a broadcast that names a downloaded chapter, sends
    `chapter_ids: null` for its book, **or names its book with no chapters**
    (a change to the book itself, published → draft included, which the
    triggers send that way) checks it at once.
  - **Opening a download:** the player loads the file (`localAudioUri()`:
    always online, within 30 days offline) and never signs, re-mints or
    prefetches a URL for it; M6 doesn't wait for one, and takes the text's
    length from the index. Offline, `resolve.ts` resolves a download from the
    index. **Offline autoplay, refined:** when the cached neighbours name the
    next chapter, only that one plays, so a locked or missing chapter is never
    skipped; without them, the book's next downloaded chapter by number.
    Either way it never waits. M5 reads a download's text from its file
    (`downloadedTextOptions()`, `networkMode: "always"`, never persisted),
    online too, falling back to the network if the file can't be read.
    Offline, M5 and M6 open from the index entry, taken the moment the phone
    is seen offline (NetInfo reports a moment after launch) and then held.
    Past 30 days they show a new `expired` state: "Connect to the internet to
    keep this chapter offline." M5's Listen is off offline for a download
    without narration.
  - **Sign-out** (`clearUserScopedState()`): `stopDownloads()`, then
    `releaseAudio()`, then the index cleared in memory, then `downloads/`
    deleted once the chapter in flight has stopped (at most 2 seconds), then
    the index's stored copy. Tested, with PostHog's files left in place.
  - **M9:** "Download all" at the right of the sort bar, teal with its icon;
    a spinner while it fetches fresh answers; the confirmation `Alert`; "12
    of 41" and Cancel while it runs; "All downloaded", disabled and `muted`,
    with nothing left; disabled offline; absent where nothing can be
    downloaded. The Downloaded disc is a sibling button that opens the row's
    sheet (`components/chapters/chapter-actions-sheet.tsx`, the options
    sheet's `Modal` pattern): Listen, then Download chapter, Cancel download
    or Remove download, with a status line; long-press opens it too, and
    screen readers get the same items as the row's actions. A queued chapter
    shows "Queued", its percentage or "Failed" in the slot, over the Reading
    pill while it is in the queue (the Reading row keeps its ember edge). Why
    chapters failed shows as a line under the sort bar.
  - **The Downloads screen** (`app/downloads.tsx`,
    `components/downloads/downloaded-book.tsx`): books as `surface` cards,
    most recently checked first, each with its cover, size, a `muted`
    "Remove" and its chapters (M5 when the text is downloaded, else M6; "Connect
    to keep offline" past 30 days offline); the total and the phone's free
    space; "Remove all downloads" with its one confirmation. The Profile
    placeholder's "Downloads" button reaches it in every build until M11.
  - **M3's offline state** (`DiscoverOffline`): the tab's query paused with
    nothing cached, instead of the skeleton forever, with an outlined "See
    your downloads" when anything is downloaded.
  - **No frame** for the Downloads screen, the row sheet, M3's offline state
    or M9's failure line: for design review.
  - **Copy, flagged for the owner:** "Download all", "All downloaded",
    "Cancel"; the confirmation "Download 12 chapters?" / "12 chapters, 48 MB.
    You're on mobile data. Keep Talebrim open while they download." ("about
    48 MB" when estimated); the row slot's "Queued", "34%", "Failed"; the
    sheet's "Listen", "Download chapter", "Cancel download", "Remove
    download", "Connect to the internet to download.", and its status lines
    ("Downloaded. It reads and plays with no connection.", "Queued for
    download.", "Downloading, 34%.", "Couldn't download: not enough free
    space on this phone.", "Couldn't download on this account.", "Couldn't
    download. Check your connection and try again.", "Couldn't download. Try
    again."); M9's failure lines ("Not enough free space on this phone. Free
    some space, then try again.", "{N} chapters couldn't be downloaded on
    this account.", "{N} chapters didn't download. Check your connection and
    try again.", "We couldn't get this story ready to download. Check your
    connection and try again."); M5/M6's "Connect to the internet to keep
    this chapter offline." / "Downloads open offline for 30 days after they
    were last checked."; M3's "Discover loads when you reconnect. Your
    downloaded chapters read and play right now." and "See your downloads";
    the Downloads screen's "{size} on this phone · {size} free", "Remove",
    "Audio and text · 5.3 MB", "Connect to keep offline", "Remove all
    downloads" / "Remove all downloads?" / "Every downloaded chapter is
    removed from this phone. You can download them again.", and "No
    downloads yet" / "Download chapters from a story's chapter list to read
    and listen with no connection."
  - **Analytics:** `download_requested` (`book_id`, `chapters`, `from`),
    `download_failed` (`kind`), `download_removed` (`scope`) and
    `offline_chapter_opened` (`mode`). Ids, counts and fixed words.
  - **Replaced:** both `TODO(downloads)` (M9's `isDownloaded` in
    `buildChapterRows()`, and the sort bar's "Download all").
  - **Tests** (232 in all, every one passing): `lib/downloads/__tests__/
    rules.test.ts` (23: the window, sizes and the 64 kbps fallback,
    reconciling, the access verdicts, refresh parts, autoplay, grouping),
    `downloads.test.ts` (18, with `expo-file-system` faked in memory: the
    queue, a full disk before and during the write leaving no partial file,
    a refusal, pausing offline, cancelling, the access check allowed, lost,
    unpublished and failed, an edited text and a replaced narration,
    reconciling, another account's index, sign-out's order and that nothing
    outside `downloads/` is touched), `lib/__tests__/query-client.test.ts`
    (4: chapter text never persisted, the rest of `chapters` still is) and
    13 more in `chapter-list.test.ts` (Downloaded, the queue's states,
    "Download all", the row sheet). `player.test.ts` mocks the downloads
    lookup: nothing downloaded there.

## Decisions — 2026-09-29

- **iOS in scope.** Decided by the owner on 2026-09-29, closing the open
  item in § Important Constraints. Talebrim ships on iOS as well as
  Android, from this one codebase and the same Clerk application (rule 5).
  - **After Android v1, not beside it.** Android finishes first, in the
    order already agreed (Decisions — 2026-09-25, "Build order from here"),
    and is tagged `android-v1.0`. Then prompt 28
    (`prompts/28 — iOS audit and plan.md`) audits the code and writes the
    iOS series (28a, 28b, …) without writing code; each of those is
    reviewed, then built on an `ios` branch, with Android unchanged.
  - **Until then nothing Android-only changes:** billing
    (`billingAvailable()`), new-chapter alerts (`pushAvailable()`),
    downloads (`downloadsAvailable()`, which on iOS also needs `downloads/`
    kept out of iCloud backup) and the `expo-audio` patch. Earlier entries
    that say "while iOS scope is open" or "iOS waits for its scope" now mean
    "until the iOS series".
  - **Apple requires two things the app doesn't have yet:** Sign in with
    Apple (it offers Google sign-in; M1's frame already draws the Apple
    button) and account deletion inside the app. Account deletion is also
    worth adding during the Android work, since Google Play expects a way
    to delete an account too.
  - **Owner, now:** start the Apple Developer Program enrollment ($99 a
    year; a company needs a D-U-N-S number first, which can take weeks). It
    waits on nothing in the code.

## Decisions — 2026-09-30

- **M4's download button.** Asked for by the owner on 2026-09-30, after
  looking for a way to download on the story page (the iPhone preview) and
  finding none: downloads lived only on M9, one tap further in, and only in
  the Android app. No frame draws it, like the `+ My List` pill beside it.
  - **Where:** M4's floating top bar, a round 44dp button between the My
    List pill and Share, outlined as they are (`bg` fill, `raised`
    hairline), with a teal icon: download controls are teal or `muted`,
    never ember, and Read stays M4's one ember action (prompt 24 step 14).
    Built in `components/book/book-header.tsx` (`BookDownloadButton`), with
    its whole style from a `style` function and no `className` (§ Style
    Exception Rules).
  - **What it does:** the whole book, exactly as M9's "Download all": the
    chapters, their sizes and the lock inputs fetched fresh, then the one
    size confirmation, then the queue (`useBookDownloads()`, the same hook
    M9 uses). Its state comes from `downloadButton()` (`lib/downloads/
    rules.ts`, tested) over M9's own `downloadAllState()`:
    - ready: the download arrow; a tap downloads the book
    - preparing: a spinner, disabled
    - failed (the fresh fetch failed): a `muted` alert mark; a tap tries again
    - running: a spinner; a tap opens M9, where the run's "12 of 41",
      Cancel and any failure line are
    - done: M9's teal Downloaded disc; a tap opens Downloads
    - loading (the list isn't known yet) and offline: the arrow, dimmed and
      disabled
    - hidden: nothing in the book can be downloaded by this reader
  - **Off Android (iOS, the web preview) it still shows,** so the feature
    can be found there: a tap opens the Downloads screen, which says
    "Downloads work in the Talebrim app for Android." It changes when the
    iOS series brings downloads to iOS (Decisions — 2026-09-29, "iOS in
    scope").
  - **Every screen reader label says the state and where a tap goes:**
    "Download all 12 chapters", "Getting the chapters ready to download",
    "Downloading, 3 of 12 chapters. Opens the chapter list", "All chapters
    downloaded. Opens Downloads", "Couldn't get the chapters ready to
    download. Try again", "Download. Not available offline", "Download.
    Downloads work in the Talebrim app for Android. Opens Downloads".
  - **M4 now reads M9's full chapter list** through `useChapterList()`, under
    the same query keys, so the button knows what is left to download and
    M9 opens from here with its list already cached. One more request on
    M4's first open (about 30 KB for 200 chapters), never blocking the
    page.
  - **M4's preview rows show the Downloaded disc** (M9's teal disc, as part
    of the row, not a button) for a downloaded chapter, and say
    "Downloaded" to screen readers. Locked beats it. `useBookDetail()` passes
    `isDownloaded` from the index to `chapterStateFor()`; everything that
    decides what a tap opens still checks only for Locked.
  - **Unchanged:** there is still no per-chapter download button on M9's
    rows: one chapter is long-press, as the owner settled on 2026-09-25.
    The new button is for the whole book.
  - **Checked:** `typecheck`, `lint` and 237 tests pass (5 new, for
    `downloadButton()`), and the running Metro bundled M4's route for
    Android and the web. Not yet seen on a phone.
- **A paused download carries on from its last byte.** Found by the owner
  on the phone on 2026-09-30 (prompt 24's check "leaving the app
  mid-download"): Eternal Eclipse chapter 1 (29 MB) was at about 30% when
  they pressed Home. Coming back, it started again from 0%, and Profile →
  Downloads showed nothing, because that screen listed only finished
  chapters. The chapter looked lost.
  - **Why it restarted:** prompt 24 assumed the new `expo-file-system` API
    couldn't resume a file, so a pause deleted the partial file. 57.0.7 can
    resume: `File.createDownloadTask()` and `DownloadTask.fromSavable()`,
    which resume with an HTTP Range request from the partial file's length
    on disk and fall back to the whole file if the server ignores Range. Same
    API, no new library, and the native class is in build `fd1773bc`. This
    replaces "No resume within a file" in Decisions — 2026-09-25,
    "Downloads", and step 7's "that chapter starts over".
  - **Now:** leaving the app or the network *pauses* the chapter in flight
    (`downloadToPartial()` in `lib/downloads/files.ts`). Its narration's
    `.part` file and its percentage stay, and the job holds the partial file
    and the `audio_path` it is of (`queue.ts`, `KeptPartial`). Coming back,
    the same recording carries on from its last byte (`downloadAudio()`).
    Anything else starts from the first byte: a replaced recording, or a
    resume that fails (signed again, once). A cancel, a failure or a full
    disk deletes the partial file; only a pause keeps it, in memory, for
    this session. Reconciling on start already skips while the queue is
    busy, so it never deletes a kept file.
  - **The native task is paused, never cancelled.** In 57.0.7,
    `FileSystemDownloadTask.cancel()` can return from its read loop without
    settling the promise (the `isCancelling` check just returns), so an
    await on it would hang. `pause()` always settles, with `null`. So every
    stop is a pause, and the queue decides in JS whether to keep or delete
    the bytes.
  - **Still foreground only**, as prompt 24 decided: nothing downloads while
    Talebrim is in the background. The confirmation's "Keep Talebrim open
    while they download." stays true.
  - **M9** keeps a paused chapter's percentage in its slot, instead of
    "Queued" (`rowDownload()`).
  - **The Downloads screen lists books still downloading** above the
    downloaded ones (`components/downloads/downloading-book.tsx`,
    `downloadingBooks()` in `rules.ts`): cover, title, "Downloading · 3 of 12
    · 34%" or "Waiting for a connection · 3 of 12", a muted "Cancel", and a
    tap opens M9. `QueueItem` now carries its `book`. No frame: for design
    review. Copy, flagged: "Downloading", "Waiting for a connection",
    "Cancel".
  - **Development logs** in the queue: `[downloads] chapter started`,
    `chapter paused` (with whether bytes were kept), `chapter cancelled`,
    `chapter done`, and `pausing` (with online and foreground), beside the
    existing failure lines. Read them with `adb -d logcat -s ReactNativeJS`.
  - **Tests:** 244 pass. The fake `expo-file-system` in `downloads.test.ts`
    now models the task (a pause settles with `null` and keeps the bytes; a
    resume sends a Range and appends). New: pausing offline and carrying on
    from byte 500, the same for leaving the foreground, cancelling a paused
    chapter deletes its bytes, a refused resume starts from byte 0, plus
    `downloadingBooks()` and M9's paused percentage. The test file clears
    its query cache after the last test, or TanStack's 5-minute GC timers
    keep Jest from exiting.
  - **Not yet seen on the phone.** Metro bundles it for Android.
- **A chapter's own access decides, never its number.** Decided by the
  owner on 2026-09-30, after locking Whispers In the Mist chapters 2 and 3
  in the dashboard's chapter editor and finding they still opened in the
  app (prompt 24's check "losing access": chapter 4 locked as expected).
  - **Why they stayed open:** the lock rule freed every chapter numbered up
    to `app_settings.free_chapters_at_start` (3) whatever its own `access`
    said, and so did the audio storage policy. That matched the dashboard's
    Settings hint ("Chapters below this number are always free.") but not
    its code: `createChapter` and bulk import use the setting only to give a
    new chapter its access (the dashboard's AGENTS.md, Data Model Notes).
    After that the chapter editor sets `access`, and the owner expects it to
    hold.
  - **The rule now:** free by the chapter's own `access`, unlocked by the
    reader, or subscribed. `resolveChapterState()` (`types/states.ts`) lost
    `chapterNumber` and `freeChaptersAtStart`; `ChapterLockInputs`,
    `ResumeLockInputs` and `lockStateFor()` lost the setting. The lock no
    longer waits for `reader_settings()`: M5 no longer reads the settings at
    all, and M4, M6, M9, M5a, Continue, the player's resolver and the
    download checks read them only for cover URLs, if at all. M6's
    "Storage refused" recheck now refetches the chapter row (its access)
    and the unlocks, not the settings.
  - **The server:** dashboard migration `20260930120000`, shown to the owner
    and pushed with their yes the same day, drops the position branch from
    `public.can_play_audio()`. Only the function body changed (same
    signature, `security definer`, grants `authenticated` only); the
    `audio_read` policy is untouched. Regenerated types: no change in either
    repo. `supabase/verify/audio_read_policy.sql` now expects a chapter
    locked inside the free run to be refused, and runs that check live
    (Whispers 2): 20 of 20 pass. `reader_tables_rls.sql`: 47 of 47. Over
    HTTP, under a freshly minted token for reader B: Whispers 1 signed (200),
    Whispers 2 refused (400 `NoSuchKey`).
  - **What it changed for readers today:** Whispers In the Mist 2 and 3,
    and Man of Ashes 001 2 and 3, were `locked` in the database and are now
    Locked in the app. A download of one is deleted at its next online check.
  - **The dashboard's Settings hint** now reads "New chapters up to this
    number are created free. You can lock any chapter afterwards in its
    editor." (`src/components/settings/settings-form.tsx`), since "always
    free" is no longer true.
  - **Unchanged, and now approximate:** onboarding's "Start with N free
    chapters." still reads `free_chapters_at_start`. It holds for stories as
    created, not for a chapter the owner has since locked.
  - **Tests:** 246 pass. The fixtures in `chapter-list.test.ts`,
    `rules.test.ts`, `library.test.ts` and `downloads.test.ts` now free
    chapters 1–3 by access, as the dashboard creates them. New: a chapter
    locked inside the free run stays Locked (`states.test.ts`, M9), and a
    downloaded chapter 1 the owner locks is deleted by the access check.
- **M2 is remembered by the account.** Found by the owner on the phone on
  2026-09-30: signing out of their account, into reader B, out again and
  back in showed the genre picker straight away.
  - **Why:** M2's answer lived only in the phone's `onboarding` slice, which
    sign-out clears so the next account on the phone doesn't inherit it. The
    returning account had nothing to say it was done. This section's claim
    that a reinstall-then-sign-in never shows M2 was never true.
  - **Now:** the answer is also written to the reader's own Clerk
    `unsafeMetadata`, as `{ onboarding: { genres } }` (present means done;
    Skip saves an empty list). `useOnboardingSync()`, in the root navigator,
    copies it onto the phone after a sign-in, and writes the phone's answer
    to the account when the account lacks it or holds other genres,
    `user.updateMetadata()` (deep-merged, so nothing else in
    `unsafeMetadata` changes). That also records readers who finished M2
    before this change. The gate reads `useOnboardingComplete()`, phone or
    account, so M2 never shows even for the frame before the copy lands.
  - **Why Clerk, not a table:** no migration and no new library; the value
    is per account, survives reinstalls and new phones, and a phone can't
    tell accounts apart without it. `unsafeMetadata` is the reader's own to
    write and is not in the session token (only `public_metadata` is), so it
    never reaches RLS or `is_admin()` (rule 4). It is read as untrusted:
    only known genre slugs are kept (`onboardingFromAccount()`, tested in
    `lib/__tests__/onboarding.test.ts`). A profile table can replace it
    later if genres need to be queried on the server.
  - **Sign-out** still clears the phone's copy, and only after Clerk's
    `signOut()` has finished, so the sync never copies one account's genres
    to another. The health probe's development-only clear-storage button no
    longer brings M2 back for an account that finished it.
  - **Checked:** `typecheck`, `lint`, 250 tests. Not yet seen on the phone:
    no account on the development instance holds the record yet; the
    owner's will get it the first time the app runs this code signed in.
  - **Downloads going at sign-out is by design**, not part of this fix: the
    owner decided on 2026-09-25 that downloads are tied to the account and
    sign-out deletes them (Decisions — 2026-09-25, "Downloads"), as Netflix
    and Spotify do, so one person's offline copies never open for the next
    person on a shared phone. Keeping each account's downloads and bringing
    them back when it signs in again (YouTube's way) is possible, at the
    cost of storage held for signed-out accounts; not built. When M11's real
    sign-out lands (prompt 25), it should say how many downloaded chapters
    it will remove before it does.
- **Another app's audio pauses the narration.** Found by the owner on the
  phone on 2026-09-30 (deferred setup step 9): with a chapter playing,
  they started a YouTube video and both played at once.
  - **Why:** in `expo-audio` 57.0.5 the ExoPlayer is built with
    `setAudioAttributes(AudioAttributes.DEFAULT, false)`, so it never
    touches audio focus. Focus came only from `AudioModule`'s own request:
    transient (`AUDIOFOCUS_GAIN_TRANSIENT`, even for `doNotMix`), made only
    from JS `play()` and only while it believed it held none. Play from the
    lock screen, the notification or Bluetooth goes straight to ExoPlayer and
    never asked. After any earlier loss, the narration could be playing with
    no focus at all, so Android never told it YouTube had started.
  - **The fix,** in `patches/expo-audio+57.0.5.patch` beside the unplug
    fix: ExoPlayer is built with usage `USAGE_MEDIA`, content
    `AUDIO_CONTENT_TYPE_SPEECH` and `handleAudioFocus = true`. Media3 then
    requests full focus whenever playback starts, by any route, pauses for
    good on a permanent loss (YouTube, music), pauses and resumes around a
    transient one (a call), pauses rather than ducks for speech (a
    navigation prompt), and gives focus up on pause. `AudioModule`'s own
    request is switched off (`focusHandledByPlayer`), since two requests
    from one app take focus from each other: the module's listener would
    pause the player the moment ExoPlayer took focus. The JS keeps
    `interruptionMode: "doNotMix"`, which now matters only on iOS.
  - **The player's listener already records these pauses**, as it records a
    lock-screen pause: nothing changed in `lib/audio`.
  - **Native, so it needs a development build made after it:** EAS build
    `9235ee79` (2026-09-30, finished). Its log shows "Applying patches" with
    `expo-audio@57.0.5 ✔`, `:expo-audio:compileDebugKotlin` executed (so
    the patched sources were compiled, through `buildFromSource`) and
    `BUILD SUCCESSFUL`.
  - **Passed on the phone on 2026-10-01:** build `9235ee79` installed over
    USB (`adb -d install -r`, which keeps the app's data), and the owner
    confirmed a YouTube video now pauses the narration.
- **New-chapter alerts: the first real one didn't show.** Reported by the
  owner on 2026-09-30 (prompt 23a's check "a new chapter arrives"): nothing
  after 15 minutes.
  - **What the server did:** the phone registered its token at 13:49 UTC.
    The job found the new Whispers In the Mist chapters at 13:55 and 14:00,
    and at 14:10 sent one message, which Expo accepted (an `ok` ticket: the
    robot token may send). The receipt, checked at 14:25, was not
    `DeviceNotRegistered` (the token is still registered). So the server did
    its part and the message was lost between Expo, Firebase and the phone.
  - **Why it can't be told for sure:** the function kept only
    `DeviceNotRegistered` from a receipt and dropped every other error
    without a trace. The FCM V1 key on EAS was checked: present, for the
    same Firebase project as `google-services.json` (`talebrim-4ba77`).
  - **The likely cause, fixed:** the function sent no `priority`, and
    Expo's default on Android is FCM normal priority, which a phone holds
    while it is idle (Doze). An aggressive battery manager like itel's can
    hold it indefinitely. The phone was idle and locked then. Every message
    is now sent with `priority: "high"`, as Expo and Firebase recommend for
    an alert the reader sees as a notification.
  - **Fixed too:** each run's report counts ticket and receipt errors by
    code (`ticket_errors`, `receipt_errors` in `net._http_response`), and the
    function logs each with its ticket id (never a token), so the next
    failure says what it was. Redeployed 2026-09-30. Nothing in the app
    changed.
  - **The proof script** (`new_chapter_alerts_rls.sql`) failed 2 checks
    that day, from live data: the real alert's 24-hour cap on its test book,
    and real readers' phones named beside its test phone. It now sets the
    cap aside inside its rolled-back transaction and checks the test phone
    is among those named: 57 of 57.
  - **Re-testing:** any book on My List, Whispers included, since the
    24-hour cap is gone (next entry). On the owner's itel, Talebrim should
    be allowed to run in the background (battery: no restrictions;
    auto-start on); note whether it was needed.
  - **Not yet seen on the phone.**
- **Alerts go out right away.** Decided by the owner on 2026-09-30, after
  seeing the delay: a reader should hear about a new chapter as soon as it
  is added, and the admin, not a hidden rule, decides how often chapters
  come. The app itself already showed a new chapter within about a second
  while open (live catalog sync); only the phone alert waited.
  - **Before:** the job ran every 5 minutes, a book waited until its new
    chapters had been quiet for 10 minutes, and each book alerted at most
    once in 24 hours: 10 to 15 minutes' delay, and a second chapter the
    same day went unannounced until the next day.
  - **Now:** dashboard migration `20260930130000`, shown to the owner and
    pushed with their yes the same day. The cron job runs every minute
    (`cron.alter_job`, `* * * * *`), and `notify_due_books()` makes a book
    due as soon as it has a readable chapter not yet announced. Every
    chapter the admin adds is announced within about a minute. Chapters
    found in the same run (a bulk import) still share one alert.
    `book_alerts` still records each book's last alert; nothing uses it as
    a cap.
  - **Why not every few seconds:** truly instant would need a trigger on
    `chapters`, which this app may not add (rule 2). And the schedule only
    fires an HTTP call, so runs can overlap if one is slow: two overlapping
    runs could announce the same chapter twice. A run takes about a second,
    so a minute leaves room.
  - **Checked:** `new_chapter_alerts_rls.sql` now tests the new rule (due
    at once; still due a minute after an alert): 53 of 53, after 4 checks
    of the old wait and cap were replaced by 2. `reader_tables_rls.sql` 47,
    `audio_read_policy.sql` 20. Types unchanged in both repos. The function
    was redeployed with its comments matching.
  - **Worth watching:** an admin publishing chapters one by one sends one
    alert per chapter. If readers complain, a short wait (2 minutes) can
    bundle a quick burst, at the cost of a slower first alert.
- **Alerts arrived but didn't pop up.** The owner added Whispers In the
  Mist chapter 8 ("chrus") at 19:54:22 UTC on 2026-09-30 and saw no alert.
  - **What the phone showed:** the server sent it 39 seconds later, and the
    phone's log shows Android posting "New chapter of (PART 1) Whispers In
    the Mist / Chapter 8: chrus" at once, then `No heads up: unimportant
    notification`. It sat in the notification shade, with no banner. So
    the earlier "not delivered" was very likely the same: delivered,
    unseen.
  - **Why:** the channel was made at `AndroidImportance.DEFAULT`, which on
    Android plays a sound but never pops up. Alerts a reader should notice
    need `HIGH`. An app can't raise a channel's importance once made.
  - **The fix:** `lib/push.ts` makes a new channel, `chapter-alerts`
    ("New chapters", `HIGH`, content still hidden on a secure lock screen),
    and deletes the old `new-chapters`. `syncAlerts()` makes it at every
    start signed in with alerts on, so existing phones switch on their next
    start; "Notify me" makes it too. The Edge Function sends on
    `chapter-alerts` (redeployed 2026-09-30). A phone that hasn't made it
    yet gets Firebase's fallback channel, never nothing. JavaScript only: no
    new build. Deleting the old channel resets a reader's own choices for
    it; there are no real readers yet.
  - **Phone checks, for next time** (`adb -d`): `dumpsys notification
    --noredact` lists the app's channels with their importance and the
    alerts in the shade; `logcat` shows `c2dm.intent.RECEIVE` when Firebase
    delivers, then `onEnqueueNotificationInternal` and the heads-up
    decision; `am get-standby-bucket com.talebrim.app` (10 is active).
  - **Not yet seen on the phone:** it was offline when the fix landed, so
    it still had the old channel. (Seen by the owner the same evening:
    alerts pop up now.)
- **Updates inbox.** Asked for by the owner on 2026-09-30: alerts popped up,
  but nothing in the app showed them, and the bell only held the alerts
  switch. A bell reads as "what's new for me" in every app readers know, so
  it now opens Updates. No frame: for design review.
  - **The screen** (`app/updates.tsx`, `components/updates/update-row.tsx`):
    Downloads' header, then an alerts row ("New chapter alerts" and On, Off,
    "Off in Android settings" or "In the Talebrim app for Android", opening
    the alerts sheet with `from: "updates"`), then the new chapters of the
    books on My List, newest first: cover, book title in `muted`, "Chapter
    8: chrus" in `body`, "5 min ago", a teal "New" pill, and a lock for a
    chapter the reader can't open. A tap opens M5 (M6 for narration only),
    or M5a for a locked chapter (`from: "updates"`). States: loading
    (skeleton rows), "Nothing to follow yet" (empty My List), "No new
    chapters yet", offline, failed with Try again. Teal or `muted`, never
    ember: the screen has no primary action.
  - **What shows** (`buildUpdates()`, `lib/updates.ts`): chapters with text
    or narration, from the last 30 days, of books still on My List, added
    after the book was put on it. One request, `chapters_catalog` filtered by
    the My List book ids (`updatesOptions()`, `lib/queries/updates.ts`,
    under `updates.byBooks(userId, bookIds)`); at most 100 rows. No new
    table or view: `chapters_catalog.created_at` already existed. Checked
    over HTTP under a reader's token: 200, Whispers' 9 chapters newest
    first.
  - **New and seen:** new means added after the reader last looked. "Seen"
    is the newest chapter's `created_at`, the server's clock, never the
    phone's: the owner's phone ran about a minute behind. Kept in the
    `updates` slice (per account, cleared at sign-out) and in the account's
    Clerk `unsafeMetadata.updates.seenAt`, as M2's answer is (deep-merged
    `updateMetadata()`), so it follows the reader to a new phone or back
    after a sign-out; the later of the two counts. Opening Updates moves
    it at once, so the bell's dot clears, while the screen keeps this
    visit's "New" pills (measured against "seen" as it was on opening).
    Both wait for the slice to rehydrate, so a cold start never counts
    everything as new.
  - **The dot** (`DiscoverHeader`, `useUnreadUpdates()`): 10dp, teal, with a
    `bg` ring, on the bell while any chapter is new. Its label says the
    count ("Updates, 2 new chapters"), since a dot is colour alone. Catalog
    sync marks every account's `updates` keys stale on any catalog change
    (`isUpdatesQuery()`), so the dot appears within about a second of the
    admin adding a chapter while the app is open, a minute before the alert.
  - **No banner over a story:** M5 and M6 call `useQuietAlertBanners()`,
    which counts them in (`quietAlertBanners()`, `lib/push.ts`, a count
    because a handoff can focus the new screen before the old one leaves);
    the foreground handler then shows no banner, only the shade and the
    dot. Elsewhere in the app the banner still shows. With the app closed,
    alerts pop up as before.
  - **Also changed:** `useAlertsStatus()` (`hooks/use-alerts.ts`) is the
    alerts sheet's on/off/blocked logic, now shared with Updates' row.
    `ALERTS_FROM` and `PAYWALL_FROM` gain `updates`. Analytics:
    `updates_opened` (`new_chapters`, a count).
  - **Proven on the phone the same day** (the owner's itel, over USB and
    Metro): the bell's hook counted 4 new chapters (Whispers 6–9, added
    after the book went on My List), Hermes parsing Postgres' microsecond
    timestamps as Node does; the owner opened Updates, and "seen" moved to
    chapter 9's `created_at` on the phone and on the account
    (`unsafeMetadata`: `{"updates":{"seenAt":"2026-09-30T20:36:58.747Z"},
    "onboarding":{"genres":[]}}`, so the merge kept M2's answer); the screen
    showed the alerts row ("On") and the 4 chapters newest first, with
    covers, times, and locks on 8 and 9; the dot drew teal with its `bg`
    ring (forced on for one screenshot, then reverted). The query answered
    200 over HTTP under a reader's token. Not yet seen: a "New" pill and
    the dot arriving live (they need a chapter added while looking), and
    the banner staying quiet over M5 or M6 (an alert while reading).
  - **Tests:** 260 pass; 10 new in `lib/__tests__/updates.test.ts` (what
    shows and in what order, new against seen, the account copy read as
    untrusted, the slice never moving back, the words, and catalog sync
    marking Updates stale).
- **A lock set in the dashboard holds.** Reported again by the owner on
  2026-09-30, after the rule change above ("A chapter's own access
  decides"): locking Whispers In the Mist chapter 1 or 3 still didn't
  reach the app.
  - **The server was right.** At 19:50–19:52 UTC the owner set Whispers 2
    free, locked 3 and 1, and set `free_chapters_at_start` to 1 (the
    activity log). `chapters`, `chapters_catalog` and `can_play_audio()` all
    agreed; the reader had no `unlocks` rows.
  - **The app decided from old copies.** The phone's persisted cache (read
    off it with `run-as`) held M9's list and M4's preview from 19:59, with
    1 and 3 locked, but the reader's own row for chapter 1
    (`chapters.detail`) was from 14:20 and still said `free`, and so did
    the neighbour rows. M5, M6 and M5a took whatever row the cache held:
    a stale "free" started the text fetch and opened the chapter, and only
    a refetch that arrived and said `locked` would close it. On this phone
    the connection dropped again and again (the log shows Realtime
    `transport failure` and Clerk's host not resolving), so the refetch
    often never came. A chapter playing when it was locked also played on:
    the player never checked its loaded chapter again.
  - **Now, the screens.** M5, M6 and M5a open or lock a chapter only with a
    current row (`rowCheck()` in `lib/query-status.ts`, through
    `hooks/use-row-check.ts`). A row within its stale time and not marked
    changed is current. A stale one is fetched again first, with the
    skeleton showing, and a failed fetch shows Failed with Retry. Offline,
    the cached row stands, since nothing newer can be had; a download's
    30-day rule is unchanged. Once current, it stays current for the open,
    so an open chapter never goes back to loading, and a refetch that says
    `locked` still turns it Locked at once. M5's next-chapter prefetch waits
    for a current neighbours row too. M6 doesn't wait for the player's
    loaded chapter, so the mini player opens it at once; the player checks
    that chapter itself (next point).
  - **Now, the player.** Every catalog change that names the loaded chapter
    or its book, and every catch-up after a reconnect or a return to the
    app, runs `recheckLoaded()` (`lib/audio/player.ts`, from
    `hooks/use-catalog-sync.ts`, after the invalidation). It asks
    `checkChapter()` (`lib/audio/resolve.ts`), and a chapter now locked,
    unpublished or without narration is paused, its place recorded and
    sent, and unloaded: the mini player, the lock screen and the
    notification let it go. Only a definite answer stops it; offline, or
    after a failed check, it plays on.
  - **`checkChapter()`** is `resolveChapter()`'s first half: published, the
    lock rule, then audio. Online it always reads the chapter's row fresh
    (`staleTime: 0`), so autoplay, next and previous never move into a
    chapter the owner has just locked.
  - **The lists** (M4's preview, M9, Updates, Continue) still show the
    cached copy while they fetch again, then correct themselves, as before.
    A tap on a row that is out of date lands on M5, M6 or M5a, and each of
    those now decides on a current row.
  - **One rule for "does this change concern this chapter":**
    `changeTouchesChapter()` in `lib/catalog-sync.ts`, shared by the
    downloads check and the player.
  - **Proven on the phone the same night** (the owner's itel, over USB and
    Metro, with a temporary development log of each screen's state, since
    removed). The phone still held chapter 1's row from 14:20 saying `free`
    (read off it with `run-as`) while the server said `locked`; opening it
    in the reader went loading ("checking") → Locked, never ready, and the
    screen showed "Chapter 1 is locked." The owner then changed locks live
    in the dashboard (22:06–22:10 UTC). The app got each change about 3
    seconds after the save, and M4's rows matched the database every time
    (1 free, 2 locked, 3 free, 4 and 5 locked, at 22:07). A reader opened on
    a stale `locked` copy of a chapter just freed checked, then opened it.
    Then chapter 1 played (handed off from the reader, no wait), and the
    owner locked it at 22:10:42: about 3 seconds later M6 showed Locked,
    and 1.5 seconds after that the player logged "loaded chapter stopped".
    Android then showed no Talebrim audio player, an empty audio focus
    stack and no active media session. The owner tested it again
    themselves the same night and confirmed it works.
  - **Tests:** 276 pass, 16 new: `lib/__tests__/query-status.test.ts`
    (current, cached, checking, failed, held for the open),
    `lib/__tests__/catalog-sync.test.ts` (the change rule),
    `lib/audio/__tests__/resolve.test.ts` (a fresh read online even over a
    fresh cache, both ways; the cache offline), and three in
    `player.test.ts` (a chapter locked while loaded stops, records and
    unloads; a catch-up checks it; a change elsewhere, a playable answer, a
    failed check and offline leave it playing).

## Decisions — 2026-10-01

- **M11 (prompt 25 review).** Settled on 2026-10-01 while reviewing prompt 25
  against the code, `material/10.png`, the live database and the Clerk
  development instance. The prompt carries the detail; the owner may flip any
  of these before it is built.
  - **The frame is `material/10.png`.** The prompt cited
    `prompt_material/13-profile.png`, which never existed. The frame stops
    below "Restore purchase"; the rest follows § M11.
  - **Measured:** the account card is `surface`, with a 48dp `raised`
    initials circle (a 1dp `teal/20` ring) and a `blush/15` plan pill; the
    upsell card is `raised`, with the ember "See plans"; rows are 56dp in
    `surface` cards; section headings are small Fraunces capitals; "Profile"
    is about 26px.
  - **The reading rows** ("Reading preferences", "Font: …", "Theme: …") all
    open M5's `ReaderSettingsSheet`, reused as it is on the `reader` slice.
    The Atkinson switch has worked since prompt 14, so the prompt's
    `TODO(28)` is gone.
  - **Dropped:** a default playback speed (the `playback` slice isn't
    persisted, and M6 owns speed) and a "clear cache" row (chapter text left
    the cache in prompt 24, and downloads have their own screen).
  - **Added:** "New chapter alerts", a row that opens the alerts sheet as
    Updates' row does (`from: "profile"`), and "Usage analytics", the switch
    prompt 21a promised, on PostHog's opt-out, which belongs to the device.
  - **Initials only**, even where Clerk has a Google photo (5 of the 6
    development accounts do). Email-code readers have no name either, so
    their email is the card's title.
  - **Sign-out** is `useSignOut()`, whose order is already right; its
    confirmation says how many downloaded chapters it removes.
  - **Account deletion is an Edge Function, `delete-account`,** in the
    dashboard repo. It verifies the reader's Clerk session token itself
    (JWKS, issuer, expiry), refuses an admin (403), deletes the reader's
    `push_tickets`, `push_tokens`, `reading_positions`, `library_items` and
    `unlocks` rows with the project's secret key, then deletes the Clerk user
    through the Backend API (a 404 counts as done, so a retry finishes the
    job). It needs two new function secrets, `CLERK_SECRET_KEY` (the
    development instance's) and `CLERK_ISSUER`; both change at the production
    Clerk cutover. No migration.
    - Chosen over Clerk's client `user.delete()`: every development account
      has `delete_self_enabled`, but Clerk can demand a reverification first,
      and a native app has to build that screen itself. Chosen over a Clerk
      webhook: a missed delivery leaves the rows behind. The function can
      also be proven over HTTP without the phone.
    - The owner's yes comes before it is deployed or its secrets are set.
    - PostHog holds only the Clerk id, so once the Clerk user is gone it
      names nobody. Deleting the PostHog person too is the owner's call.
      Once RevenueCat exists, the function also deletes its customer.
  - **Analytics:** `restore_tapped` gains `from: "profile"`, `ALERTS_FROM`
    gains `profile`, and two events are new: `signed_out` and
    `account_deleted`.
  - **Missing, for the owner:** the Terms and Privacy URLs, a support email,
    a help page, and Google Play's web page for deletion requests (§ Before
    production).
  - **Also corrected in this file:** the live `free_chapters_at_start` (1),
    the alerts job's schedule (every minute) and its 53 checks, and the
    status line.
  - **Prompts 26 and 27** still name `danger`, `tailwind.config.js` and a
    `TODO(28)` for the Atkinson switch, and 26 cites "prompt 25" for
    downloads (24). Fix them at their reviews.
- **M11 as built (prompt 25).** Built on 2026-10-01 as reviewed (previous
  entry). The app side is done and was seen on the owner's phone the same
  night. The `delete-account` function was deployed the same night with the
  owner's yes, its two secrets set without being printed, and proven over
  HTTP (below).
  - `app/(tabs)/profile.tsx` is one `ScrollView`: the title, the account
    card, the upsell, then Reading, Account and Support (only once a target
    exists), then the footer. Its parts are in `components/profile/`
    (`AccountCard`, `UpsellCard`, and `SettingsRow` with `SettingsGroup` and
    `SettingsHeading`). Its pure parts are in `lib/profile.ts`, tested in
    `lib/__tests__/profile.test.ts`. The placeholder's Downloads button is
    gone.
  - **The account card** reads `useUser()`'s names and email only.
    - The title is the first and last names, trimmed. With no name, the email
      is the title, with no second line.
    - The initials are the first letters of the first and last names, or
      else the email's first letter.
    - The plan pill comes from `planState()`: "Ad-Free", "Free plan", a
      `raised` skeleton while loading, or nothing once the entitlement
      failed.
    - Screen readers hear one element. The card is a `surface` skeleton
      until Clerk has loaded.
  - **The upsell** shows only once the entitlement is known not to be active.
    "See plans" pushes M10. It is the screen's one ember action, so a
    subscriber's screen has none.
  - **`SettingsRow`** is a `Pressable` whose whole style comes from a `style`
    function.
    - Size: at least 56dp, with 8dp of vertical padding so it grows with the
      text.
    - Contents: an 18dp teal icon, a 15px `body` label, an optional `muted`
      13px second line, then a 16dp `muted` chevron, a spinner or a switch.
    - A switch row is one control (role `switch`): the whole row toggles. The
      `Switch` inside only shows the state. It takes no touches, and screen
      readers skip it.
  - **Reading.** Three rows open M5's `ReaderSettingsSheet`, bound to the
    `reader` slice as M5 binds it. Downloads opens `/downloads`.
  - **Account.**
    - Manage subscription pushes M10.
    - Restore runs `usePurchase("profile").restore()`. A spinner takes the
      chevron's place while it runs. Its result is one line under the card:
      M10's messages, or "Your Ad-Free subscription is restored." Without
      billing it shows M10's "Subscriptions are available in the Talebrim app
      for Android."
    - New chapter alerts opens `/alerts` with `from: "profile"`. The alerts
      state is the row's second line, from `alertsStatusWords()`
      (`lib/alerts.ts`), which Updates' row now uses too.
    - Usage analytics is a switch over PostHog's opt-out, read once at
      mount.
  - **Support** reads `constants/support.ts`. `HELP_URL` and `SUPPORT_EMAIL`
    are both null, so neither the rows nor the heading show.
  - **The footer**, in order:
    - Sign out and Delete account, as `destructive` `TextLink`s.
    - Terms and Privacy, once `LEGAL_URLS` has them. Neither does.
    - The version from `expo-application`. Build `9235ee79` shows "Version
      1.0.0 (1)"; the web shows "Web preview".
    - In a development build and for the owner's account only, a `muted`
      "Development: health probe" link (Decisions — 2026-10-02,
      "Development tools belong to the owner's account").
  - **Sign-out** is `useSignOut()`. First a confirmation that counts the
    downloaded chapters it removes, then `signed_out`. The link reads
    "Signing out…" while it runs, so a second tap can't start a second one.
  - **Deletion** is `hooks/use-delete-account.ts`.
    - Offline, nothing starts, and "Connect to the internet to delete your
      account." shows until the phone reconnects.
    - Online, a confirmation first. A subscriber whose plan renews also reads
      the Google Play line.
    - Then `stopForSignOut()`, `flushWithin(2_000)`, `clearParityQueue()`
      and `releaseAudio()`, and `supabase.functions.invoke("delete-account")`.
      That call carries the Clerk token as the bearer, through the client's
      `accessToken`.
    - A 2xx answer: `account_deleted`, Clerk's `signOut()` (a failure is
      ignored), then `clearUserScopedState()` in a `finally`.
    - A 403: "This account is managed from the Talebrim dashboard." Anything
      else: "Couldn't delete your account. Check your connection and try
      again."
  - **The two confirmations go through `confirmDestructive()`**
    (`lib/confirm.ts`). It uses `Alert.alert` on a phone and the browser's
    `confirm` on the web preview, where react-native-web's `Alert.alert`
    does nothing and both links would otherwise be dead.
  - **`TextLink` gained `tone`**: `muted`, the default, or `destructive`.
  - **The function** is `supabase/functions/delete-account/index.ts` in the
    dashboard repo, with `verify_jwt = false` in its `config.toml`.
    - `jose` 6 verifies the token against
      `{CLERK_ISSUER}/.well-known/jwks.json`: RS256, the issuer, with `exp`
      and `sub` required. It allows 5 seconds of clock skew, as Clerk's own
      SDK does.
    - `sub` must look like a Clerk user id. `metadata.role === "admin"` gets
      403.
    - The rows are deleted with the project's secret key, in the prompt's
      order. Any failure answers 500 and leaves the Clerk user alone.
    - Then Clerk's `DELETE /v1/users/{id}`: a 404 counts as done, anything
      else answers 502. Success answers 200 with the counts.
    - CORS uses supabase-js's own `corsHeaders`. The log holds counts and
      error codes only.
    - `deno check` passes. So do the dashboard's three gates (`lint`: its 4
      existing warnings).
  - **Proven over HTTP on 2026-10-01**, against the deployed function:
    - A CORS preflight answered 200 with the headers, and a `GET` 405. No
      token, a garbage token, and a forged token naming reader B each got
      401.
    - Two throwaway readers were made through Clerk's Backend API
      (`talebrim.delete.t1+clerk_test@example.com` and `…t2…`). Each was
      seeded as the server would: a reading position, a My List book, an
      unlock, a push token and a push ticket.
    - T1, with a freshly minted token: 200 with one row from each table and
      `clerk_user: "deleted"`. Clerk then answered 404, and its rows were
      gone from all five tables.
    - T2, with a token left to expire (75 seconds): 401, and nothing
      deleted. Then T2 was deleted in Clerk first, and a fresh token got 200
      with `clerk_user: "already_gone"`, so a retry after a half-way failure
      finishes the job.
    - An admin, with the owner's yes (`skywavehost.teams@gmail.com`): the
      token was decoded first and carried `role: authenticated` and
      `metadata.role: admin`. The function answered 403 `admin_account`, the
      session was revoked, and nothing changed.
    - Every other reader's rows were fingerprinted (count and md5 of their
      ids) before and after: unchanged. That covers 19 positions, 4 My List
      rows, 1 push token, no unlocks and no tickets.
  - **Deviations from the prompt:**
    - The plan pill is `blush/10`, not `blush/15`. The frame measures
      #33243F on `surface`, which is blush at 10%. The review's "#3D2B46
      measured" was blush/15 computed, not measured.
    - Row labels are 15px, not 16. The frame's labels fit Inter Regular at
      15.1px by width. Updates' row and M5's sheet rows are 15px too.
    - The frame's text below 14px is built as M7's was (§ Typography). The
      email and the upsell line (13px in the frame) are 14px, and the pill
      (11px) is 12px.
    - The Font row's icon is Ionicons `text-outline` ("Aa", M5's own way
      into this sheet). The frame's three left-aligned lines have no Ionicons
      match, and the nearest, `reorder-three-outline`, reads as a menu.
    - The alerts state is the row's second line, as Android's own settings
      show a state, not a value at the row's end. "Off in Android settings"
      doesn't fit beside the label at 393dp.
    - "See plans" is `Button`'s 44dp, where the frame draws about 34dp. The
      footer links take no hit slop: `TextLink` is already 44dp. (On the
      phone both were 38.5dp until "NativeWind's rem is 14 on native", below,
      was fixed.)
    - The web confirmation above.
    - For one chapter, sign-out's confirmation says "You can download it
      again", not "them".
  - **Copy, flagged for the owner:**
    - Upsell and pill: "Go Ad-Free", "Unlimited chapters, no
      interruptions", "See plans", "Ad-Free", "Free plan".
    - Rows: "Reading preferences", "Font: Literata" or "Font: Atkinson
      Hyperlegible", "Theme: Light", "Downloads & offline storage", "Manage
      subscription", "Restore purchase", "New chapter alerts", "Usage
      analytics" over "Helps us improve Talebrim.", "Help" and "Contact us".
    - Restore: "Your Ad-Free subscription is restored."
    - Sign-out: "Sign out?", with "You can sign back in at any time." or
      "The {N} downloaded chapters on this phone will be removed. You can
      download them again after you sign in." While it runs, "Signing out…".
    - Deletion: "Delete your account?", with "Your account, reading places,
      My List and unlocked chapters are deleted, and downloads are removed
      from this phone. This can't be undone." A subscriber also reads "Your
      Ad-Free subscription isn't cancelled by this: cancel it in Google Play
      first." While it runs, "Deleting…". Its three lines are above.
    - The footer: "Version {version} ({build})", "Web preview" and
      "Development: health probe".
    - Screen readers: "Opens reading settings", "Opens Downloads", "Opens
      your plan", "Opens the alert settings", "Signs you out of Talebrim on
      this phone. Asks first." and "Deletes your Talebrim account and
      everything saved to it. Asks first."
    - Not in any frame, so for design review: the rows below "Restore
      purchase", the footer, the confirmations and the deletion lines.
  - **Seen on the phone** (the owner's itel, over USB and Metro, signed in
    as the owner): the screen beside `material/10.png`. The Theme row
    followed the sheet live (Sepia, then back to the owner's Light), and
    Android back closed the sheet. Restore showed the no-billing line. The
    alerts row opened the sheet's "on" state. Manage subscription and
    Downloads opened, and both came back to Profile. The version read
    "Version 1.0.0 (1)".
  - **Not yet seen:** sign-out and deletion on the phone, which need a
    throwaway account signed in there and the phone online (it was
    offline), and analytics off and on reaching PostHog.
  - **Tests:** 300 pass, 24 of them new in `profile.test.ts`.
- **NativeWind's rem is 14 on native, not 16.** Found while measuring M11 on
  the phone on 2026-10-01. It applied to every screen, not M11 alone. Fixed
  the same day at the owner's request (below, "Fixed").
  - **The cause:** react-native-css (NativeWind v5's engine) turns `rem`
    into dp at build time. Its README ("Inline REM units") says it uses 14
    on native unless `inlineRem` is passed to it. It also reads a CSS
    `:root { font-size: Npx }` (`compiler.js`, `effectiveRem`).
  - **What it does:** every rem-based class renders at 87.5% on Android.
    - `p-4` is 14dp and `h-14` (the tab bar) 49dp.
    - `min-h-11`, the `btn` minimum, is 38.5dp, so buttons fall below
      § UI Quality Bar's 44dp.
    - `text-sm` is 12.25px and `text-base` 14px.
    - Arbitrary px (`text-[15px]`) and `StyleSheet` numbers are exact, so a
      screen that mixes both is out of proportion.
    - The web preview uses the browser's 16, so it differs from the phone.
  - **Measured** with `adb` screenshots at density 288: the tab bar 48.9dp,
    M11's "See plans" 38.3dp, M11's account card 71dp, where nominal is 82.
    M11's rows, sized in `StyleSheet`, measured exactly 56dp.
  - **global.css's own comment** said `p-4` "is already 16dp". That was
    true on the web only.
  - **Fixed:** `metro.config.js` passes `inlineRem: 16` to `withNativewind`,
    the option the README documents, rather than a `:root` rule the compiler
    finds by pattern. Keep it through every NativeWind upgrade. A change to
    it needs Metro restarted with its cache cleared (`npx expo start -c`).
    `global.css`'s comment now says so.
    - **Proven in the compiled Android stylesheet** that Metro serves:
      `min-h-11` is 44, `h-14` 56, `h-12` 48, `p-4` 16, `text-sm` 14 and
      `leading-5` 20. They were 38.5, 49, 42, 14, 12.25 and 17.5.
    - **The code was written for 16,** so the fix makes it exact rather than
      moving it, checked screen by screen:
      - M9's rows (`chapterListRowHeight()`, 12 + 20 + 2 + 18 + 12 = 64)
        assume `leading-5` is 20. So do M7's reserved grid titles
        (`GRID_TITLE_LINE_HEIGHT`), and M5's text clearing the `h-14`
        toolbar (`TOOLBAR_HEIGHT` 56).
      - M4's `BOOK_CONTENT_TOP` is 14 (`top-3.5`) + 44 + 8. Back and Share
        (`icon-btn`, `h-11`) were 38.5dp beside the 44dp My List pill sized
        in `StyleSheet`; all three are 44 now.
      - M3's tab underline (`pb-2`) now meets its divider (`bottom-[7px]`)
        as its comment says. The hero's no-cover placeholder (`h-80`) now
        matches the 320dp image.
      - M4's preview rows and M8's results already held their measured
        heights.
      - M6's cover measures the space left (`onLayout`), and the tab shell
        measures its bar (`useBottomTabBarHeight()`).
    - **Two screens would not fit.** The welcome screen (`(auth)/
      onboarding.tsx`) and M2 (`(auth)/genres.tsx`) were fixed layouts with
      no scroll.
      - At 16 the welcome screen needs about 892 of the owner's 895dp, and
        M2 about 890dp on a 360 × 740 phone. M2 already overflowed that phone
        by about 40dp at 14.
      - Both now sit in a `ScrollView` whose content grows to the screen
        (`flexGrow: 1`). Their spacers lay out a tall screen as before, and
        a short one scrolls instead of losing Start Reading, Sign in or the
        18+ line.
    - **Not yet seen on the phone,** which was locked: every screen needs a
      look at the new size, the touch targets included (prompt 27 checks
      them again).
- **The alerts sync looped while offline.** Found on the owner's phone on
  2026-10-01, which was offline. Fixed the same day at the owner's request
  (below, "Fixed").
  - **The log:** `[alerts] token change failed` 33,794 times in 12 minutes,
    about 45 a second, from 01:09:57. That was before this session touched
    the phone.
  - **The cause:** `expo-notifications` 57.0.21's native
    `getDevicePushTokenAsync` emits the token to `addPushTokenListener`
    each time it is called (`onNewToken(token)` after resolving), and
    `getExpoPushTokenAsync` calls it. So `onPushTokenChange()`'s listener in
    `lib/push.ts` clears `phoneToken` and calls `syncAlerts(true)`. That
    asks `getExpoPushTokenAsync` again, which emits again.
  - **Online it stops** after one more round, because the first call caches
    the token. **Offline** every call fails, so it never stops. It runs as
    long as the app is open offline with alerts on, which is exactly how
    downloads are read: wasted CPU and battery, and a flooded log.
  - **Fixed** in `lib/push.ts`, in two parts:
    - `onPushTokenChange()` remembers the device token (`deviceToken`) and
      ignores a report of the one it already knows. A token Firebase really
      rotates still registers again.
    - `getPhoneToken()` fetches the device token itself, records it, and
      hands it to `getExpoPushTokenAsync({ devicePushToken })`. The Expo
      token is then made from exactly that token, and the report the fetch
      sets off is known as no change before it arrives.
  - **Tests:** `lib/__tests__/push.test.ts`, four tests, with a fake
    `expo-notifications` that reports the token after every fetch, as
    57.0.21 does.
    - Offline: one attempt, then it stops. When the report lands before the
      fetch answers, at most two.
    - Online: one `set_push_token`, with the Expo token made from the
      fetched device token.
    - A rotated token: one more registration.
    - **Control:** against the old `lib/push.ts`, the first test saw 51
      attempts in 50 ticks, where the fix makes 1. With the report landing
      first, the old code looped in microtasks until Jest ran out of memory
      (a 4 GB heap) after 3 minutes.
  - **Not yet seen on the phone,** which was locked: the log should show one
    `[alerts] token change failed` offline, not a stream.
- **Legal pages, support and analytics deletion.** Decided by the owner on
  2026-10-01, after M11 was built:
  - The pages are public on talebrim.com, served by the dashboard repo.
  - The support address is `support@talebrim.com`.
  - Account deletion also deletes the reader's PostHog person and events.
  - **The pages:** `/terms`, `/privacy`, `/help` and `/delete-account`, in
    the dashboard's `(public)` route group, which needs no sign-in. Their
    text is typed data in the dashboard's `src/data/public-pages.ts`, and the
    dashboard's AGENTS.md (Screen Inventory, "Public pages") holds the
    detail.
    - Drafted from what the app does: Clerk, Supabase (reading places, My
      List, unlocks, the push token), PostHog (the events, and the device
      details PostHog really stores), Expo and Firebase push, and Google Play
      and RevenueCat for purchases.
    - The deletion page meets Google Play's rules for one: the app's name,
      the steps in the app and by email, and what is deleted and kept.
  - **The owner reviews the pages before they are published.** They are on
    the dashboard's dev server, and talebrim.com shows them only after the
    dashboard is deployed. They name no operator and no governing law: those
    wait for the owner's details, never placeholders. The owner also confirms
    two promises: an emailed deletion request is handled within 30 days, and
    copies "can remain in our providers' backups for a limited time".
  - **The app links to them now.**
    - `constants/legal.ts` holds the Terms and Privacy URLs, and
      `constants/support.ts` holds `support@talebrim.com`.
    - M11 shows Terms and Privacy, and so does M10. M11's Help opened the web
      help page until the same day: it now opens the in-app form ("Help is a
      message to support", below).
    - M1's "By continuing you agree to our Terms and Privacy Policy." links
      both words, in teal like the screen's other link (`LegalLink` in
      `(auth)/sign-in.tsx`), as plain words while a URL is unset.
    - Until the dashboard is deployed, every one of them opens its 404.
  - **PostHog deletion:** `delete-account` gains a step between the rows and
    Clerk. It calls PostHog's `persons/bulk_delete` with the Clerk id,
    deleting events and recordings, and a failure answers 502 while the
    reader can still retry.
    - In the app, `useDeleteAccount()` flushes PostHog's queue
      (`flushAnalyticsWithin()`) beside the parity flush before the call.
    - After a 2xx it calls `resetAnalytics()` before sending
      `account_deleted`. An event under the deleted id would make the
      person again.
    - **Not deployed:** it needs a PostHog personal API key with person write
      access (owner). The key reaches the function's secrets from the
      dashboard's `.env`, unprinted, as the Clerk key did. Then the deploy,
      and a proof over HTTP with a throwaway reader who has a PostHog person.
      (Deployed and proven later the same day: "Account deletion removes
      the reader's analytics".)
  - **Not in the pages yet, by design:** rewarded ads. Prompt 23 adds AdMob,
    and the privacy policy must change in the same change.
- **Help is a message to support.** Asked for by the owner on 2026-10-01,
  after M11's Help opened `talebrim.com/help` on the phone and got the
  dashboard's 404, since the pages aren't deployed. Help now opens a form in
  the app whose messages reach `support@talebrim.com` by email. It needs no
  website, and the reader never leaves the app.
  - **The app:**
    - `app/support.tsx` ("Contact support", registered in the signed-in
      stack) holds the topic chips (Account, Reading & listening,
      Downloads, Subscription, Something else; none chosen is "Something
      else"), the message (up to 4000 characters, with a counter from
      3500) and the line saying where it goes, then the ember "Send
      message".
    - **The screen names Talebrim's address, never the reader's own** (the
      owner, the same day). The line reads "Your message goes to
      support@talebrim.com, with the app's version and your phone's model.
      We'll reply to the email on your account." (`destinationLine()`).
      Sent: "Message sent", "It's on its way to support@talebrim.com. We'll
      reply to the email on your account." (`sentLine()`), and "Done".
    - The first build showed the signed-in account's own address ("We'll
      reply to {email}"), and offered "Or email support@talebrim.com" under
      Send. The owner, signed in with a personal account, saw their personal
      address there. Both were removed: the reply still goes to the account's
      email, and the screen says so without showing it.
    - Offline, Send is off and the draft stays. A failure or a refusal
      keeps the draft, with a line saying why.
    - `hooks/use-contact-support.ts` sends it with
      `supabase.functions.invoke("contact-support")`. The pure parts are in
      `lib/support.ts`, tested in `lib/__tests__/support.test.ts`.
    - M11's Help row has the second line "Send us a message". "Contact us"
      (`mailto:`) is gone, since the form names the address.
      `constants/support.ts` holds only `SUPPORT_EMAIL`, and `HELP_URL` was
      removed: nothing in the app links to the web help page any more.
    - Analytics: `support_message_sent` (`topic`), never the message.
  - **The function:** `contact-support` in the dashboard repo, deployed
    2026-10-01, with `verify_jwt = false` in its `config.toml`. It verifies
    the Clerk token as `delete-account` does.
    - It accepts a known topic, a message of 1 to 4000 characters and short
      context strings: the app's version, the platform and its version, and
      the phone's model.
    - It reads the account's primary email (the Reply-To) and name from
      Clerk's Backend API, never from the request.
    - It allows 5 messages an hour per account, remembered in the account's
      Clerk private metadata (`support.sent`), so no table is needed.
      Beyond that it answers 429 with Retry-After.
    - It sends plain text through Resend's API: the message, then who sent
      it and from what. It stores nothing in the database. The log holds
      outcomes and codes only.
  - **Settings:** `SUPPORT_EMAIL_TO` (`support@talebrim.com`, then
    `support@nouvrix.com` from later the same day: "Support is
    support@nouvrix.com") and `SUPPORT_EMAIL_FROM` (`Talebrim app
    <onboarding@resend.dev>`) are set.
    Until talebrim.com is verified in Resend, Resend's own sender delivers
    only to the address the Resend account signed up with, which must be
    `support@talebrim.com`. **`RESEND_API_KEY` waits for the owner.** Until
    then the function answers 500 `not_configured` at the send, and the app
    shows "Couldn't send your message…" above Send, with the address named in
    the line under the message.
  - **Proven over HTTP so far:** a CORS preflight answered 200 and a `GET`
    405, and no token or a garbage token 401. A throwaway reader's real
    token got 400 for an unknown topic, an empty message, a 4001-character
    message and no body, and 500 `not_configured` for a valid message. The
    reader was then deleted.
  - **Still to prove** once the key is set: a message arrives at
    `support@talebrim.com`, with Reply-To the reader's address, and the
    sixth in an hour gets 429. Then the form on the phone. (Set and proven
    later the same day, to `support@nouvrix.com`: "Support is
    support@nouvrix.com".)
  - **The pages say so:** the privacy policy names Resend and what a
    message carries, Help points to Profile → Help, and the deletion page
    keeps conversations "from the app or by email".
  - **No frame:** for design review, as is the copy. That covers the
    intro, "What's it about?", "Your message", the placeholder "What
    happened, and on which story or chapter?", the line saying where it
    goes, "Send message", the three problem lines, and "Message sent" with
    its line.
- **M11's avatar is the account's photo.** Asked for by the owner on
  2026-10-01: a reader who signs in with Google sees their Google photo on
  the account card, not their initials. It flips "Initials only" in "M11
  (prompt 25 review)", which had named this flip.
  - **The photo is Clerk's `imageUrl`, only when `hasImage` is true.**
    `accountIdentity()` (`lib/profile.ts`) gives it as `photoUrl`. Without a
    photo, Clerk still gives an `imageUrl`, for a picture it generates; that
    is never shown (§ Image Generation Rules), and the initials stay.
    - Checked on the development instance: every Google sign-in has
      `has_image` true, and reader B (an email code) has it false.
    - The images come from `img.clerk.com`, Clerk's CDN for the account's
      own image. That is the auth provider's, not the third-party hotlink
      § Image Rule forbids for covers.
  - **The card** (`Avatar` in `components/profile/account-card.tsx`): the
    photo fills the 48dp circle inside its `teal/20` ring (`expo-image`,
    `contentFit="cover"`, decorative).
    - The initials show until the photo has loaded, and again if it can't
      (offline on a cold start, a failed fetch). They are hidden once it has:
      the owner's Google photo is a cut-out with a transparent background,
      and on the phone the initials showed through it.
    - `cachePolicy="memory"`: a reader's photo never stays on the phone's
      disk, so it can't outlive their sign-out. It is small to fetch again
      on the next start.
  - **The privacy policy says so:** "The app shows that photo on your
    Profile, or your initials if your account has none" replaces "only your
    initials, never your photo".
  - **Seen on the owner's phone** the same day (signed in with Google): the
    photo in the ring, with nothing showing through after the fix.
  - **Tests:** four new in `profile.test.ts`: the photo, a photo with no
    name, Clerk's generated picture never shown, and a missing or blank URL.
- **Prompt 22 (second review).** Settled on 2026-10-01 while reviewing prompt
  22 again, at the owner's request, against the code as built through
  prompt 25, today's fixes, `material/11.png`, `material/5.png` and the
  owner's phone. The prompt carries the detail; the owner may flip any of
  these before it is built.
  - **Only Part C (the store setup and the sandbox tests) and a new Part D
    are left.** Parts A and B were built on 2026-09-25 ("Paywall as built")
    and become a reference section with a step 0 that checks they still
    hold.
  - **No new development build:** `9235ee79` already holds
    `react-native-purchases` 10.10.2. Its manifest has
    `com.android.vending.BILLING`, granted (read with `dumpsys package`).
    `eas.json`'s `production` profile already exists. All 14
    `TODO(paywall)` markers in `src` are gone, and two `TODO(unlocks)` wait
    for prompt 23.
  - **Corrected in the prompt:**
    - The lock rule has no "free by position" (Decisions — 2026-09-30).
    - Terms and Privacy have URLs.
    - `restore_tapped`'s `from` includes `profile`.
    - "While iOS scope is open" becomes "until the iOS series".
    - The stale frame name `prompt_material/12-paywall.png` is gone. The
      frames are `material/11.png` (M10) and `material/5.png` (M9's bar).
  - **The production build needs six public variables:**
    - The five from before, plus `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
    - Never `EXPO_PUBLIC_POSTHOG_DEBUG`, nor `EXPO_PUBLIC_DEVELOPER_EMAIL`
      (since 2026-10-02: the owner's address, for development builds only).
    - The Clerk key stays the development instance's (rule 5).
  - **Never install the Play build over the development build:** Play
    re-signs it, so Android refuses it as an update. The sandbox tests run
    on the development build.
  - **Recommended Play shape:** one subscription, "Ad-Free", with weekly,
    monthly and yearly base plans. M10 names its cards by period and the
    status card by the subscription's name. Three subscriptions remain the
    flip.
  - **The sandbox tests now cover:**
    - M11: the pill, the upsell, Manage subscription and Restore.
    - Delete account's warning to a renewing subscriber.
    - A lapse.
    - M5a, M10 and M9's bar at full size, since all three were built while
      the rem was 14.
    - Reporting the gaps that wait for 22a.
  - **Part D:** a lapse runs `recheckLoaded(null)`, so a locked chapter that
    is playing stops, as a dashboard lock already makes it. The turn is
    detected by a tested `entitlementLapsed()` in `lib/billing.ts`.
  - **Prompt 22a comes straight after.** It holds:
    - the entitlement mirror (RevenueCat's webhook, an Edge Function, an
      `entitlements` table);
    - the audio policy's subscriber branch;
    - server-side protection of locked text (§ Before production);
    - deleting the reader's RevenueCat customer, and their `entitlements`
      row, in `delete-account`, whose `TODO(paywall)` waits for it.

    All of it needs RevenueCat's secret key on the server. Until 22a, a
    subscriber's locked chapter can't play its narration or be downloaded:
    a launch blocker. (Built 2026-10-02: Decisions — 2026-10-02,
    "Subscriber access on the server as built".)
  - **Owner reminders** gained "For prompt 22, next", the Google Play and
    RevenueCat setup, as item 1. The Google Play account moved there from
    "older owner steps".
- **RevenueCat's Test Store until Google Play.** Decided by the owner on
  2026-10-01: the Google Play account waits about a week for its fee, and
  the paywall should work meanwhile. RevenueCat's Test Store needs no store
  account, and its purchases are simulated.
  - **The project** is `talebrim`. Its Test Store holds three auto-renewing
    subscriptions: `ad_free_weekly_v2` (1 week), `ad_free_monthly_v2` (1
    month) and `ad_free_yearly` (1 year). Readers see each named "Ad-Free";
    the owner set the prices, in USD.
  - All three are attached to the entitlement `ad_free`. The `default`
    offering, which is the default, holds them as `$rc_weekly`, `$rc_monthly`
    and `$rc_annual`.
  - **Left in the project, unused:** the setup wizard's entitlement
    `talebrim_pro` (made inactive) and its products `monthly`, `yearly` and
    `lifetime`. The wizard's Lifetime package was removed from `default`.
    The owner's first `ad_free_weekly` and `ad_free_monthly` are inactive: a
    Test Store product's price can't be edited, so `_v2` products replaced
    them.
  - **`.env.local` holds the Test Store key** (`test_…`) as
    `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. RevenueCat accepts it only in a
    debug build. A release build with it shows an alert and crashes on
    purpose. So it works in the development build only, and it must never
    reach EAS's `production` environment: prompt 22 step 17 copies
    `.env.local`, so the `goog_…` key replaces it first.
  - **No code changed.** `react-native-purchases` 10.10.2, in build
    `9235ee79`, supports the Test Store, which needs 9.5.4 or later.
  - **Seen on the owner's phone the same day,** after Metro was restarted
    with its cache cleared: M10 listed Weekly, Monthly ("Save 42%") and
    Yearly ("Best value", "Save 71%", preselected), with the Test Store's
    prices.
  - **What test mode can't show:**
    - M10's Google Play wording ("until you cancel in Google Play", "Manage
      in Google Play") is the real store's, and Google Play knows nothing of
      a test purchase.
    - Test subscriptions renew every 5 minutes (weekly, monthly) or every
      hour (yearly), 5 times, then end.
    - A plan switch is a new subscription beside the old one, which renews
      until the Test Store ends it (next entry).
    - A subscriber's locked narration still waits for prompt 22a. (Plays
      since 2026-10-02, when 22a was built.)
  - **When the Play account exists:**
    - Add the Play Store app to this project.
    - Attach the Play products to `ad_free` and to the same three packages.
    - Swap the key.

    No code changes (Owner reminders item 1).
  - **Proposed here, built later the same day** (Decisions — 2026-10-01,
    "The paywall, safe for the store app"):
    - "Ad-Free is coming soon." wherever an Android build has no billing,
      worded "Talebrim Unlimited is coming soon." after the rename.
    - A guard that never configures a `test_` key outside `__DEV__`.
- **A switch in the Test Store showed the old plan.** Found by the owner on
  the phone on 2026-10-01: after buying Yearly, a switch to Weekly or Monthly
  went through, but M10 went straight back to Yearly as their plan.
  - **Why:** the app names the replaced plan to Google Play only, so in the
    Test Store each switch bought a new subscription beside the old one. The
    owner held Yearly, Weekly and Monthly at once (read from the SDK's cache
    on the phone with `run-as`). With several active, RevenueCat's
    entitlement names the one that lasts longest, and a test Yearly renews
    hourly against five minutes for the others, so M10 showed Yearly.
  - **A first fix failed on the phone.** Naming the replaced plan to the Test
    Store too (`productToReplace()`) made it refuse the purchase:
    `PurchaseNotAllowedError`, "No active purchase found for product:
    ad_free_yearly". That was reverted: only Google Play is told.
  - **The fix:** `entitlementFrom()` (`lib/billing.ts`) also takes the
    reader's subscriptions, `customerInfo.subscriptionsByProductIdentifier`,
    passed by `lib/revenuecat.ts`.
    - With more than one active, the plan, its expiry and its renewal come
      from the one started last (`originalPurchaseDate`, which a renewal
      doesn't move). A Google Play id that carries its base plan loses it.
    - With one, the entitlement's own fields, as before. Google Play replaces
      the old plan, so it never has two.
  - **In test mode** the old plan keeps renewing beside the new one until
    the Test Store ends it. Access doesn't change: any active subscription
    grants `ad_free`.
  - **Proven on the phone the same day:** Monthly → Weekly → Yearly →
    Monthly, each a "Test valid purchase", with no error. After each, M10's
    status card named the plan just bought ("$3.99/week", "$59.99/year",
    "$9.99/month"), while RevenueCat's entitlement still named Yearly. It held
    after a cold restart.
  - **Tests:** 323 pass. Five new in `billing.test.ts` use the owner's own
    purchase times; against the old code, three of them fail.
- **The paywall for a first visit.** Audited on 2026-10-01 at the owner's
  request, against a research spec of 2026 subscription patterns (RevenueCat's
  and Adapty's benchmarks). Only what fits Talebrim and needs no test was
  kept. The owner said go the same day, and chose three things: 3 free
  chapters, the name "Talebrim Unlimited", and new welcome wording.
  - **What a first visit met:**
    - The catalog decided it. Whispers In the Mist's chapter 1 was locked, so
      the paywall came before a word. Man of Ashes 001 gave one free chapter.
      Eternal Eclipse is free throughout, so it never sells.
    - The welcome screen claimed "Thousands of chapters" and "hundreds of
      chapters" (33 exist), and read "Start with 1 free chapters."
    - M5a had no filled button and no visible way out, didn't name the story,
      and sold "Ad-Free" in an app with no ads.
    - M10 said nothing of what a plan gives, and gave a reader who doesn't
      subscribe two large outlined buttons beside Subscribe.
  - **The free chapters are the owner's to set:** 1–3 free in every story,
    in the dashboard. **Done 2026-10-02**, checked in the database:
    - Every published story has 1–3 free and the rest locked: Whispers In
      the Mist 4–11, Eternal Eclipse 4–9 (no longer a free taster) and Man
      of Ashes 001 4–13.
    - `free_chapters_at_start` is 3, saved at 12:40 UTC.
  - **The name** is `PLAN_NAME` (`constants/plan.ts`), for the words the app
    writes. The store's titles carry it too (Owner reminders item 1). M11's
    pill reads "Unlimited". The entitlement id stays `ad_free`.
  - **M5a** (`app/paywall/[chapterId].tsx`), from the top:
    - the story's cover (72dp)
    - "Keep reading {story}", or "Keep listening to {story}" from the player
      (`paywallLines()` in `lib/paywall.ts`, tested)
    - a lock beside "Chapter 4: {title}"
    - three benefits: "Every chapter of every story, to read or listen",
      "New chapters as soon as they're out", "Download any chapter for
      offline"
    - the ember "See plans"
    - "Not now", "Restore purchases" and "Manage subscription"

    Free features (speed, the sleep timer, downloads of open chapters) are
    never sold. The listening and download promises hold for locked chapters
    only once prompt 22a tells the server who subscribes, which is already a
    launch blocker (they hold since 2026-10-02). The story comes from `bookDetailOptions()` and is never
    waited on: without it, the chapter is the headline, as before. Prompt
    23's two unlocks join the sheet, and the owner then picks the ember.
  - **M10** (`app/subscription.tsx`), for a reader who doesn't subscribe:
    - "Choose a plan" as the title.
    - In place of the heading: "Talebrim Unlimited opens every locked
      chapter of every story. Cancel anytime in Google Play."
    - Restore purchase, Terms and Privacy as links.
    - "Manage in Google Play" only for a reader who has had a subscription,
      such as a lapsed one or one whose payment failed.

    A subscriber's screen is the frame's, unchanged. For everyone, the line
    under the button now starts with the amount billed: "$59.99 every year.
    Renews automatically until you cancel in Google Play." (`plansFrom()`).
  - **M9's bar and M11's upsell** read "See plans" (on M9, the frame's "Go
    Ad-Free"). M11's card reads "Talebrim Unlimited" over "Every chapter of
    every story". Both open M10 through `openPlans()`.
  - **The end of a chapter shows the lock.** When the next chapter is locked,
    M5's "Next chapter" reads "Unlock chapter 4" with a lock (`ReaderPill`'s
    new `icon`), and still opens M5a. The spec's sheet opening by itself when
    the text ends was not built: a reader scrolling to check a chapter's
    length would get a paywall.
  - **The welcome screen** says:
    - "Romance, werewolf, vampire and fantasy serials. Switch between
      reading and listening without losing your place."
    - "Read or listen", "Pick up in audio where you stopped reading."
    - "New chapter alerts", "Know when a story on your list has a new
      chapter.", with a bell in place of the clock.
    - "Start with 1 free chapter.", singular for 1.

    At 393 × 852 in the web preview it scrolls by 40dp: the 18+ line sits
    below the fold, while Start Reading and Sign in stay on screen. Not seen
    on the phone, which is signed in. Alerts are Android-only until the iOS
    series.
  - **Analytics** (ids and fixed words, never a price):
    - `paywall_dismissed` (`book_id`, `chapter_id`, `from`, `seconds`) when
      M5a goes without its plans or chapter, caught by `beforeRemove` as the
      alerts sheet does.
    - `subscription_viewed`, once per open: `from` (`paywall`,
      `chapter_list`, `profile_upsell` or `profile_manage`), `subscribed`,
      and from M5a its chapter and book.
    - `book_id` and `chapter_id` on every `purchase_*` event when M5a sent
      the reader. M5a now passes `bookId` to M10.
  - **Not taken from the spec**, each with its reason given to the owner:
    - a free trial, its timeline and reminder: the spec's own first
      experiment. If one is ever added in Play Console, RevenueCat applies it
      to eligible buyers automatically, and Google requires its terms stated
      in the app first.
    - an onboarding paywall and a welcome discount
    - the sheet opening by itself where the text ends
    - a single-book unlock (Decisions — 2026-09-25, "Paywall")
    - $4.99 weekly, two plans, and "Most popular", which needs real sales
    - remote config and experiments: no traffic yet
    - "Continue" in place of "Subscribe"
    - coins and iOS offers
    - a "You're in" screen: the buyer already lands in their chapter
  - **Proven on the owner's phone.** Their test Yearly was still active, so
    a temporary development-only change read the entitlement as inactive,
    and a temporary log printed each event. Both were reverted.
    - Whispers 3's end read "Unlock chapter 4".
    - M5a showed the cover, "Keep reading (PART 1) Whispers In the Mist",
      the locked chapter, the benefits, "See plans" and "Not now".
    - M10 fit on one screen, with Yearly preselected and the price line.
    - M9's bar and M11's card read as above.
    - "Not now" sent `paywall_shown`, then `paywall_dismissed` (4 seconds).
      "See plans" sent `paywall_shown`, then `subscription_viewed` from
      `paywall` with both ids, and no dismissal.
    - `subscription_viewed` came from `chapter_list`, `profile_upsell` and
      `profile_manage`.
    - Back on the real entitlement, M11's pill read "Unlimited" and the
      upsell was gone.
    - No errors in the log. Usage analytics is off on the owner's phone, so
      its events don't reach PostHog.
  - **Tests:** 329 pass. Six are new, in `lib/__tests__/paywall.test.ts`;
    `billing.test.ts` and `profile.test.ts` follow the new words.
- **Dashboard locks, seen by a subscriber.** Reported by the owner on
  2026-10-01: chapters locked in the dashboard showed open in the app
  ("11 chapters · 11 unlocked" on Whispers In the Mist).
  - **Not a broken lock.** The database held the owner's locks as set on
    2026-09-30 (Whispers 1, 2, 4–6, 8, 9 and 11 locked). The owner's account
    had an active Talebrim Unlimited test subscription: a Yearly renewed at
    13:14 UTC, and a Monthly bought at 13:36 (read from the phone's RevenueCat
    cache). A subscription opens every locked chapter (the lock rule,
    `types/states.ts`): that is what the plan sells. A reader without one gets
    the dashboard's locks exactly, as seen on the phone the same day.
  - **What was wrong:** a subscriber couldn't tell which chapters the
    dashboard locked. Every row looked the same, so the admin, testing as a
    subscriber, saw their locks vanish.
  - **The fix:** `openedByPlan()` (`types/states.ts`, tested) marks a chapter
    that is locked by its own `access`, not unlocked on its own, and open
    only through the subscription. On M9's rows (`lib/chapter-list.ts`,
    `components/chapters/chapter-row.tsx`) and M4's preview rows
    (`hooks/use-book-detail.ts`, `components/book/chapter-preview-row.tsx`),
    the second line then starts with a teal open lock
    (`lock-open-outline`, 13dp) and "Unlimited", and screen readers hear
    "With Talebrim Unlimited". Free chapters carry nothing. Without the plan,
    nothing reads "Unlimited", and the same chapters are Locked.
  - **Confirmed by the owner the same day,** after reporting it again as a
    bug: subscribers open the chapters the dashboard locks, as the plan
    promises. The open lock was added at their request, so the lock stays
    visible. They also asked for a way to see the locked view while testing:
    next entry.
  - **RevenueCat's Test Store can't end a subscription early.** No cancel, no
    management URL, and deleting the customer doesn't remove it (RevenueCat
    community, February 2026). It ends after its last renewal: up to five,
    hourly for a Yearly and every 5 minutes for a Weekly or Monthly. Every
    test purchase therefore leaves the account a subscriber for that long. To
    see a free reader's view sooner, sign in as reader B (§ Deferred setup,
    step 5).
  - **Proven on the owner's phone**, with their real subscription:
    - Whispers' M9 read "Unlimited" on 1, 2, 4, 5, 6, 8, 9 and 11, and not on
      3, 7 or 10, matching the dashboard one-to-one. M4's preview did the
      same for 1 to 5.
    - With the entitlement briefly read as inactive (a temporary
      development-only change, reverted), chapter 1 showed "Chapter 1 is
      locked." Earlier the same day, M9 showed the same eight chapters
      Locked.
  - **Tests:** 332 pass. Three are new: two for `openedByPlan()`, and one
    for M9's rows with and without the plan.
  - **Still a gap until prompt 22a:** a subscriber's locked narration
    doesn't play. The storage policy doesn't know subscribers yet, so M6
    shows the chapter as not available. (Closed 2026-10-02: Decisions —
    2026-10-02, "Subscriber access on the server as built".)
- **View as a free reader.** Chosen by the owner on 2026-10-01. Their test
  purchases can't be cancelled and keep their account subscribed for hours,
  so they never saw their own locks while testing. It is a switch in a
  "Development" group on M11, drawn only in development builds (`__DEV__`),
  never in the store app. Since 2026-10-02 only for the owner's account
  (Decisions — 2026-10-02, "Development tools belong to the owner's
  account").
  - **What it does:** `lib/dev-preview.ts` holds the flag, session only (off
    again after the app restarts). While it is on, `useEntitlement()` reads
    the entitlement as no plan at all (`entitlementFrom(null)`, through
    TanStack's `select`), so every screen shows what a reader without the
    plan sees:
    - the lock icons
    - Locked in M5 and M6, with no text or audio
    - M5a on a locked tap
    - M10's free layout
    - "Free plan" and the upsell on M11

    The cache keeps the real answer.
  - **What it leaves alone:** the downloads checks and the player read the
    real entitlement (`fetchQuery`), so turning it on never deletes a
    download.
  - **What turns it off:** a purchase or a restore that ends active
    (`usePurchase()`'s `finish()`), or the chapter just bought would still
    show Locked; and, since 2026-10-02, signing out.
  - **Tested:** `lib/__tests__/dev-preview.test.ts` (2 tests). It is off
    until turned on, tells its listeners once per change, and refuses to turn
    on when `__DEV__` is false.
  - **Proven on the owner's phone the same day.** Whispers' M9 showed lock
    icons on 1, 2, 4, 5, 6, 8, 9 and 11 and "3 unlocked". Chapter 1 read
    "Chapter 1 is locked." with "Unlock chapter" in both M5 and M6. Off, it
    went back to the open locks and "Unlimited". It was left on for the
    owner. All 334 tests pass.
- **The development tools stay in testing builds.** The owner asked on
  2026-10-01 to remove every development explanation before real users
  arrive. Checked first, no real user can see any of them:
  - M11's "Development" group (`{__DEV__ ? <DevelopmentSection /> : null}`)
    and its "Development: health probe" link render only when `__DEV__`.
  - `app/health.tsx` renders nothing without `__DEV__`.
  - `setFreeReaderPreview()` refuses to turn on without `__DEV__`.
  - The dev client's floating gear, LogBox's red notices and RevenueCat's
    Test Store purchase dialog ("Test valid purchase") exist only in the
    development build. The last goes when the `goog_…` key replaces the
    `test_…` one (Owner reminders item 1).

  Told this, the owner chose to keep them, for testing only. Delete them
  before launch if the owner asks. (Narrowed on 2026-10-02 to the owner's
  own account. The list above was not quite right: `app/health.tsx` itself
  was reachable by link in every build, and only its clear-storage button
  checked `__DEV__`. Decisions — 2026-10-02, "Development tools belong to
  the owner's account".)
- **The paywall, safe for the store app.** Approved by the owner on
  2026-10-01; proposed earlier the same day ("RevenueCat's Test Store until
  Google Play").
  - **A store build never configures a Test Store key.** RevenueCat makes a
    release build carrying a `test_…` key show an alert and crash on purpose.
    `billingKeyUsable(key, __DEV__)` (`lib/billing.ts`, tested) makes
    `billingAvailable()` false instead, so billing stays off and nothing
    crashes. A `goog_…` key works in every build; a test key only in a
    development build.
  - **"Talebrim Unlimited is coming soon."** M10's screen where billing
    can't run, and M11's Restore line, now come from
    `billingUnavailableMessage()` (`lib/billing.ts`, tested), through
    `billingUnavailableLine()` (`lib/revenuecat.ts`):
    - Inside the Android app (no key, or a refused test key): "Talebrim
      Unlimited is coming soon.", under a clock.
    - On the web preview and in Expo Go, as before: "Subscriptions are
      available in the Talebrim app for Android."

    `BILLING_UNAVAILABLE` left `lib/profile.ts`.
  - **Tests:** 336 pass, two new in `billing.test.ts`.
  - **Not seen on the phone.** It lost its network (Wi-Fi on but connected
    to nothing, mobile data off) and lost Metro's USB link. Restarted, the
    development build waits for a connection to sign in and stays on its grey
    screen. The temporary change that would have shown M10 without billing
    was reverted. In a development build with the test key, billing runs as
    before.
- **A plan that ends stops a locked chapter that is playing** (prompt 22,
  Part D, step 19). Built on 2026-10-01 at the owner's request, ahead of Part
  C, which waits for the Google Play account.
  - **The rule:** `entitlementLapsed(previous, next)` (`lib/billing.ts`,
    tested). It is true only when an entitlement known to be active turns
    inactive. A first answer that is inactive is no lapse.
  - **The watch:** `watchEntitlementLapses()` (`lib/queries/billing.ts`,
    tested) subscribes to the query cache for the reader's entitlement key
    and compares each new answer with the last. On a lapse,
    `components/providers.tsx` runs `recheckLoaded(null)` (`lib/audio/
    player.ts`): the loaded chapter is checked again, and if it is now
    locked, it pauses, records its place and unloads, as after a dashboard
    lock. Offline, or after a failed check, it plays on. Development builds
    log `[billing] plan ended: checking the loaded chapter`.
  - **A deviation from step 19:** it watches the entitlement query, not only
    the SDK's listener. A refetch (a screen opening, or the player's own
    check) can bring the inactive answer first, and the listener would then
    see no change. The listener itself is unchanged.
  - **Tests:** 343 pass, 7 of them new:
    - two for `entitlementLapsed()`
    - four in `lib/__tests__/entitlement-lapse.test.ts`: the listener's
      write, a refetch that brings the end first, no call for a first
      inactive answer or a running plan, another reader's key, and the
      unsubscribe
    - one in `resolve.test.ts`: a locked chapter plays while the plan runs,
      and is Locked once the plan has ended

    In a control run, with the rule always false, 3 of them fail.
  - **Not seen on the phone.** It had no network (Wi-Fi connected to
    nothing), so the development build couldn't start. Metro bundles the
    change for Android. Until prompt 22a a subscriber can't play a locked
    chapter's narration at all (the storage policy refuses it), so on the
    phone this can only show its log line when a plan ends. It takes effect
    in full with 22a (built 2026-10-02).
- **Support is support@nouvrix.com.** Decided by the owner on 2026-10-01: the
  parent company Nouvrix's inbox, already active, replaces the planned
  `support@talebrim.com`. That closes the owner reminder to create a
  mailbox.
  - **The app:** `constants/support.ts` (`SUPPORT_EMAIL`), which M11's Help
    form names ("Your message goes to support@nouvrix.com…", "It's on its way
    to support@nouvrix.com…"). Comments and `support.test.ts` follow.
  - **The dashboard repo:**
    - `src/data/public-pages.ts` (`SUPPORT_EMAIL`), which the Terms, Privacy,
      Help and deletion pages and their footer give.
    - `contact-support`'s comments. Only comments changed in the function,
      so it was not redeployed.
  - **The function's delivery address:** `SUPPORT_EMAIL_TO` was set to
    `support@nouvrix.com` with `supabase secrets set`, at the owner's
    request. It was confirmed without printing it: the stored SHA-256
    fingerprint matches the new address. `SUPPORT_EMAIL_FROM` is unchanged
    (`Talebrim app <onboarding@resend.dev>`).
  - **Resend, set up the same day.** The owner made the account (team
    "nouvrix") and a Sending-access API key. The key was first put in the
    app's `.env.local`; the agent moved it, unprinted, to the dashboard's
    `.env`, where server keys live (both files are ignored by git, and the
    app's six `EXPO_PUBLIC_` values were left as they were). It was then set
    as the functions' `RESEND_API_KEY` through a temporary env file, deleted
    afterwards, and its stored fingerprint matches the `.env`.
  - **Proven over HTTP with the deployed function**, using a throwaway
    reader (`talebrim.support.p1+clerk_test@example.com`) and a freshly
    minted token:
    - A message labelled as a test answered 200 `{"sent":true}`, so Resend
      accepted it. That also shows the Resend account is
      `support@nouvrix.com`: its test sender refuses any other recipient.
    - With five sends recorded in the last minutes (the account's private
      metadata, as the function writes it), the next answered 429
      `rate_limited` with `retry_after` 3297 seconds.
    - The reader was then deleted.

    The owner confirms the email's arrival in the inbox, with Reply-To the
    test address. Then the form on the phone, once it is online.
  - **Checked:** the app's typecheck, lint and 343 tests; the dashboard's
    typecheck and lint (0 errors, its 4 known warnings).
  - The history entries above still name `support@talebrim.com` as it was
    then.
- **The support email, cleaned up.** Asked for by the owner on 2026-10-01,
  after the first real message ("Talebrim help: Something else - helo", plain
  text, ending with `--` and an ISO time): they wanted it, and the Help
  screen's words, clean and professional.
  - **The email:** `supabase/functions/contact-support/email.ts` in the
    dashboard repo (`buildEmail()`, pure, so a sample renders locally).
    `index.ts` now only handles the request.
    - The subject is the topic, then the start of the message: "Downloads —
      Chapter 3 stops at 30%…".
    - The sender is "Talebrim Support" (`SUPPORT_EMAIL_FROM` changed from
      "Talebrim app"; the address stays `onboarding@resend.dev` until a
      domain is verified).
    - The HTML uses Talebrim's colours, inline styles and tables. It has a
      dark "Talebrim Support" bar, the topic, "New message from {name}" with
      their email, the message in a card with an ember edge (line breaks
      kept), and an ember "Reply to {name}" button (a `mailto:`). Then App,
      Device and Account, and a line saying a reply answers them directly.
    - A hidden preheader gives the inbox preview the message's start.
    - A plain-text twin goes with it. The ISO "Sent" time was dropped: the
      email has its own.
    - Everything from the reader or the app is escaped: a sample with
      `<b>…</b> &` showed as text.
  - **Checked:**
    - `deno check` on both files.
    - The sample rendered at 680 and 393 wide (headless Edge).
    - Deployed with the owner's yes (`--no-verify-jwt --use-api`), and the
      new sender confirmed by its fingerprint.
    - A test from a throwaway "Ada Reader" answered 200 `{"sent":true}`, and
      the account was deleted. The owner checks it in the inbox.
  - **The Help screen's words** (`lib/support.ts`, tested). No address
    shows on the screen any more, neither the inbox's nor the reader's:
    - `SUPPORT_INTRO`: "We're here to help. Tell us what's going on."
    - `SUPPORT_NOTE`, under the message: "Our support team will get back to
      you by email as soon as possible." This is the owner's wording,
      replacing the first version's "We'll include your app version and
      phone model to help us look into it." The intro was reworded with it,
      so the screen doesn't say "get back to you by email" twice. The privacy
      policy still says what a message carries.
    - `SUPPORT_SENT`: "Thanks for reaching out. We'll reply to the email on
      your account."

    `destinationLine()` and `sentLine()` were removed, and so was
    `constants/support.ts`, which nothing else used. The address now lives
    only in the dashboard's `public-pages.ts` and `SUPPORT_EMAIL_TO`.
  - **Tests:** 342 pass. The two tests of the old lines became one that
    checks the new words name no address.
  - **Seen on the owner's phone** once it was back online: "Contact support",
    the intro, the chips, the message box and the note under it, and "Send
    message" dimmed until a message is typed.
  - The `onboarding@resend.dev` address goes once a domain is verified in
    Resend (done 2026-10-02). Gmail's yellow "External" tag stays if
    that domain is talebrim.com. Gmail puts the tag on threads with anyone
    outside the inbox's own Google Workspace (nouvrix.com), and a reply to
    these emails goes to a reader outside it. (Corrected 2026-10-02: this
    line first said the tag would go too.)
- **talebrim.com's pages are live.** On 2026-10-01 the owner tapped Terms
  and Privacy in the app, got the dashboard's "Page not found", and approved
  publishing. The pages had been built that day but never deployed.
  - **What went live:** `main` had one commit to catch up on, `37b14a9`, which
    added the public pages and the two functions' source and changed nothing
    already live. Today's dashboard changes were committed on `dev` as
    `fd615ad`: the pages' new name and support address, and the email's
    source. `dev` was pushed, then `main` fast-forwarded to it
    (`git push origin dev:main`, `dc039c2..fd615ad`), and Vercel deployed.
  - **Checked first:** the dashboard's `typecheck`, `lint` (0 errors, its 4
    warnings) and `build`, which prerenders `/terms`, `/privacy`, `/help` and
    `/delete-account`.
  - **Checked live,** about 50 seconds after the push:
    - all four pages answered 200
    - each gives `support@nouvrix.com` and names "Talebrim Unlimited", with
      no "Ad-Free" left
    - `/` still redirects to `/sign-in` (307)
    - the privacy page renders cleanly at 393 wide

    The app's Terms and Privacy links (M1, M10, M11) now open real pages.
  - **Published as approved,** with the two promises in them: an emailed
    deletion request is handled within 30 days, and copies can remain in
    providers' backups for a limited time.
  - **Missing at first:** the pages named no operator and no governing law,
    and held no placeholders for them. Both were added on 2026-10-02
    (Decisions — 2026-10-02, "The pages name Nouvrix LLC").
- **Account deletion removes the reader's analytics.** Finished on
  2026-10-01, which closes the owner reminder for a PostHog personal API
  key. The step was written earlier the same day ("Legal pages, support and
  analytics deletion") and waited only for the key.
  - **The key:** the owner first pointed to `EXPO_PUBLIC_POSTHOG_KEY`. That
    is the project key (`phc_…`), public, which only sends events. They then
    made a personal key, `talebrim-delete-account`, with scope
    `person:write`, on the `Talebrim_app` project only.
  - **It landed in the app's `.env.local`,** under a name without
    `EXPO_PUBLIC_`, so it was never bundled. The agent moved it, unprinted,
    to the dashboard's `.env`.
  - **Two fixes to the env files,** found while checking them by name:
    - The app's `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` had gone from
      `.env.local`, most likely overwritten while pasting. It was restored,
      unprinted, from that day's Metro bundle, which held exactly one Test
      Store key. The app is back to its six settings.
    - The dashboard's `.env` held `RESEND_API_KEY` twice, with the same
      value; one copy was removed.
  - **The project:** `628093` (from the owner's PostHog address bar), at
    `https://us.posthog.com`. The key reads persons there (200), and is
    refused everything else (403 on the project, the environment and the
    user), as scoped.
  - **Settings:** `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_HOST` and
    `POSTHOG_PROJECT_ID` were set through a temporary env file, deleted
    afterwards, and each stored fingerprint matches.
  - **Deployed:** `delete-account` was redeployed (`deno check` passed). It
    answers `not_configured` without all three settings, so it was deployed
    only after they were set.
  - **Proven end to end** with a throwaway reader:
    - Clerk made it.
    - An event under its Clerk id, sent with the project key, made a
      PostHog person.
    - `delete-account` with a fresh token answered 200 `{"push_tickets":0,
      "push_tokens":0,"reading_positions":0,"library_items":0,"unlocks":0,
      "posthog_person":"deleted","clerk_user":"deleted"}`.
    - PostHog then had no person for that id, and Clerk answered 404.

    PostHog deletes the person's events in the background.

## Decisions — 2026-10-02

- **Support emails come from talebrim.com.** The owner verified talebrim.com
  in Resend on 2026-10-02, closing an owner reminder. They chose it over
  nouvrix.com on the agent's recommendation: it is the app's own name, it had
  no mail records, and nouvrix.com's Google Workspace mail stays untouched.
  - **The DNS** went in through Resend's "Auto configure" (Cloudflare's
    Domain Connect). Cloudflare holds both domains.
    - CNAME `send` → `send.forge.rmta.net`, Resend's own mail servers (MX
      and SPF).
    - CNAME `rsend` → `rsend.forge.rmta.net`, Amazon SES (MX `feedback-smtp.
      us-east-1.amazonses.com`, SPF `include:amazonses.com`).
    - TXT `resend._domainkey`, the DKIM key.

    All three are "DNS only". Nothing at the root changed: the website's
    records and Clerk's `clerk` and `clkmail` CNAMEs are as they were, and
    `/privacy` still answered 200. There is no DMARC record yet; add `_dmarc`
    (`v=DMARC1; p=none;`) if a receiver ever asks for one.
  - **The first Auto configure was refused:** "You are not authorized to make
    changes to talebrim.com". The browser was signed into a Cloudflare login
    without access to the zone. The owner then signed in with the one that
    holds it.
  - **Resend's settings:** North Virginia (us-east-1), Receiving off, no
    tracking subdomain. Resend's free plan allows three domains since August
    2026.
  - **`SUPPORT_EMAIL_FROM` is `Talebrim Support <support@talebrim.com>`.**
    It was set once the owner showed the domain Verified, as proposed to
    them, and its stored digest matches. No code change and no redeploy.
    `support@talebrim.com` has no mailbox and needs none, since the Reply-To
    is the reader's address.
  - **Proven:** a throwaway reader's labelled test answered 200
    `{"sent":true}`, and the reader was deleted.
  - **Seen by the owner the same day, end to end:**
    - They sent "testing" from the Help form on the phone. It arrived in the
      support inbox from `Talebrim Support <support@talebrim.com>`, with
      the subject "Reading & listening — testing" and every row right: the
      name and email, the message, the Reply button, the app version, the
      phone and the account id.
    - Their reply reached the reader's own Gmail, threaded as "Re: …", so
      the Reply-To works.
  - **The reply went out from the founder's own nouvrix.com address, not
    `support@nouvrix.com`.** The support address seems to deliver into
    that mailbox, and Gmail replied from the mailbox's own address. Advised:
    - add `support@nouvrix.com` under Gmail's "Send mail as", and choose
      "Reply from the same address the message was sent to";
    - give that address a support signature, without the founder's title
      and phone.

    That is a Gmail setting; nothing in the app or the function changes.
  - Gmail's yellow "External" tag stays (Decisions — 2026-10-01, "The
    support email, cleaned up").
- **The pages name Nouvrix LLC.** On 2026-10-02 the owner confirmed the
  operator: Nouvrix LLC, registered in North Carolina, United States. That
  closes the owner reminder for the operator's legal name, country and
  governing law.
  - **What changed**, in the dashboard's `src/data/public-pages.ts`
    (`OPERATOR`) and `(public)/layout.tsx`:
    - Privacy opens with "Who we are", which names Nouvrix LLC as
      responsible for the data. Its Contact section names it too.
    - The Terms are "an agreement between you and" Nouvrix LLC. A new
      "Governing law" section names North Carolina's law, without its
      conflict-of-law rules, and keeps the non-waivable consumer
      protections of a reader's own country.
    - The stories belong to Nouvrix LLC "or to their authors and
      licensors"; they had said Talebrim, which isn't a legal entity.
    - The deletion page names it.
    - Every page's footer reads "Talebrim is provided by Nouvrix LLC, North
      Carolina, United States."
    - The pages' date is 2 October 2026.
  - **An assumption:** the owner named the state, not the law. North
    Carolina's law was taken as the governing law, being where the LLC is
    registered.
  - **Not added:** a court, venue or arbitration clause. That is a lawyer's
    call.
  - **Checked:** the dashboard's typecheck, lint (0 errors, its 4 warnings)
    and build, which prerendered all four pages with the new lines.
  - **Published** with the owner's go-ahead: commit `f63d269` on `dev`,
    fast-forwarded to `main` (`fd615ad..f63d269`). That commit also holds
    the dashboard AGENTS.md's notes on the new sender and the PostHog
    deletion step.
- **Autoplay with the screen off stalled; fixed.** Found on the owner's
  phone on 2026-10-02, running deferred setup step 9's check "with the
  screen off: autoplay into the next chapter".
  - **What happened:** Whispers In the Mist chapter 1 moved on to chapter 2
    with the screen locked. When chapter 2 ended about a minute later,
    chapter 3 waited, silently, until the owner woke the phone: `[audio]
    chapter started … loadedAfterMs: 198216`. A second run stalled the same
    way.
  - **Two causes together:**
    - **Timers.** React Native on Android runs no timer while the app is in
      the background (`JavaTimerManager` pauses them with the activity;
      only a zero-length timer fires at once). So TanStack's delayed retry
      of a failed request, Clerk's token refresh and the parity writer's
      10-second interval all waited for the app to come back.
    - **The token.** The phone's clock ran 59 seconds slow. Clerk judges its
      cached token's expiry by that clock, so a token the server had
      refused for 50 seconds still had "7 seconds left" (a temporary
      diagnostic log). The request checking the next chapter went out with
      it, failed, and its retry waited on a timer.
  - **The fix:**
    - **`lib/supabase.ts` checks the token on every request,** by the
      server's clock: its `iat`, plus this phone's offset from the server,
      learned from tokens just issued (`lib/token-age.ts`). Past 40 seconds
      it asks Clerk for a new token (`skipCache`). Concurrent requests share
      one, and `refreshRealtimeAuth()` uses the same path. No timer is
      involved.
    - **`lib/query-client.ts` retries at once** while the app isn't active
      (`retryDelayFor()`), and with TanStack's usual backoff on screen.
    - **The parity writer** also sends from `recordPosition()` once
      MAX_WAIT_MS has passed since the oldest unsent record. The player
      records several times a second while it plays, so a chapter heard
      with the screen off reaches the server every 10 seconds, not only at
      a pause.
  - **Proven on the phone the same day,** with the fix and the phone's
    clock still slow. Chapters 1, 2 and 3 played on their own with the
    screen locked throughout (chapter 3 loaded in 5.5 seconds). Playback
    stopped after chapter 3, before the locked chapter 4.
  - **Tests:** 352 pass, 10 new:
    - `lib/__tests__/token-age.test.ts`: the owner's 59-second-slow clock,
      a fast clock, the 40-second line, and unreadable tokens;
    - `retryDelayFor()` in `query-client.test.ts`;
    - a writer test in which the clock moves on and no timer runs.
- **iOS waits for an iPhone.** On 2026-10-02 the owner put the Apple
  Developer Program off until they have an iPhone to test on, and will say
  when. It leaves the owner reminders until then.
  - Nothing else changes: iOS still comes after Android v1, through prompt
    28 (Decisions — 2026-09-29, "iOS in scope").
  - Nouvrix LLC's D-U-N-S number is still worth getting now, for a Google
    Play organization account. Apple's enrolment uses the same number later.
- **Subscribers download locked chapters; free readers never do.** Decided
  by the owner on 2026-10-02, when asked while planning prompt 22a.
  - A chapter locked in the dashboard can't be played or downloaded by a
    reader without the plan. Unchanged, and enforced by the server.
  - A Talebrim Unlimited subscriber can play it and download it, as M5a's
    "Download any chapter for offline" promises.
  - Their downloads of locked chapters are deleted once the plan ends: the
    online access check, or 30 days offline at the latest (Decisions —
    2026-09-25, "Downloads").
  - Prompt 22a builds the server side. Until then the storage policy
    refuses a subscriber's locked narration (Decisions — 2026-10-01,
    "Prompt 22 (second review)"). Built the same day (next entry but one).
- **Prompt 22a written.** `prompts/22a — Subscriber access on the
  server.md`, written on 2026-10-02 at the owner's request, from the code,
  the live database and RevenueCat's documentation. Built the same day
  ("Subscriber access on the server as built", below).
  - **Part A, the mirror:**
    - an `entitlements` table with no reader grants, and
      `has_active_plan()`;
    - the subscriber branch in `can_play_audio()`;
    - two Edge Functions sharing one module: `revenuecat-webhook`, checked
      by an Authorization value, and `sync-entitlement`, checked by the
      reader's Clerk token. Both read the truth from RevenueCat's REST API.
  - **Part B, the app:** it asks the server to check after a purchase or
    restore, once per session, and once when a plan-opened chapter is
    refused.
  - **Part C, locked text:** readers without access get no row from
    `chapters` for a locked chapter. It is a third sanctioned change to a
    dashboard-owned object, and the owner's yes comes first. The two
    catalog views stop using the caller's RLS so they still list locked
    chapters, and lose their `anon` and write grants.
  - **Part D:** account deletion also removes the `entitlements` row and
    the RevenueCat customer, and the public pages say so.
  - **Found while writing it:**
    - RevenueCat's Test Store sends webhooks (`store: TEST_STORE`), so 22a
      needs no Google Play account.
    - Webhooks come with every RevenueCat plan.
    - Around a Test Store renewal, active entitlements read empty for about
      a minute; production purchases don't do this.
    - `books_catalog` and `chapters_catalog` hold `ALL` privileges for
      `anon` and `authenticated` today (Supabase's defaults), harmless only
      while they run with the caller's RLS.
- **M3's tabs follow the genres of the published stories.** Asked for by the
  owner on 2026-10-02, in two steps. First, a genre tab opened onto an empty
  screen: the live catalogue that day (read-only, through the Supabase CLI)
  held Eternal Eclipse as `romance`, (PART 1) Whispers In the Mist as
  `dark_romance` and Man of Ashes 001 with no genre, so of the four fixed
  genre tabs only Romance had a story. Then, the same day: the strip should
  hold exactly the genres the dashboard's stories carry, and a genre the app
  has never heard of should get its tab as soon as a story carries it. That
  replaced the fixed four (the first version only hid the empty ones).
  - **The rule** (`lib/discover-tabs.ts`, tested in
    `lib/__tests__/discover-tabs.test.ts`): the strip lists "Discover" and
    "New", which list every story and stay, then one tab for every distinct
    genre slug across the published books, and no other. A tab is `{ id,
    label, genre }`; a genre tab's id is `genre:<slug>`, so a genre named
    "new" can't clash with the fixed tabs. `catalogByTabOptions()` filters it
    by exact containment (`genres @> {slug}`), so every listed tab has a
    story, and a story shows under each genre it carries. A story with no
    genre shows only under Discover and New.
  - **Labels** come from `genreLabel()`: `data/genres.ts`'s spelling for a
    slug it knows ("Sci-fi", "HFY"), and the slug spelled out for one it
    doesn't (`mafia_boss` → "Mafia Boss"). A new genre needs no app update.
    Add it to `data/genres.ts` only for an exact label (an acronym) and for
    M2's picker, which still offers only that list.
  - **Order** is fixed, never a count, so a tab doesn't move under the
    reader's finger: the frame's four (Werewolf, Romance, Vampire, Fantasy),
    then the rest of the dashboard's list in its order, then unknown genres
    A to Z. An assumption: the owner chose no order.
  - **The data:** `genresInUseOptions()` (`lib/queries/catalog.ts`) reads the
    `genres` column of `books_catalog`, one request for every published
    book, since no tab's own 20-book list can speak for the others. It sits
    under `queryKeys.catalog`, so every catalog change refreshes it: a story
    just published adds its genre's tab, and the last story of a genre
    unpublished or re-tagged takes it away, within about a second while
    Discover is open. PostgREST caps a response at 1,000 rows (Supabase's
    default); past that, replace it with a distinct-genres view in the
    dashboard repo. `catalogByTabOptions()`'s `genre` and the `byTab` key
    take any slug now, not only `data/genres.ts`'s.
  - **Until the genres are known** (loading, or offline with nothing cached)
    only "Discover" and "New" show. The genre tabs join them to the right,
    so no tab the reader can already tap moves. The answer persists with the
    rest of `catalog`, so a warm start shows the right strip at once.
  - **A tab that leaves while the reader is on it** falls back to Discover
    (`resolveTab()`, `hooks/use-discover-tabs.ts`) and is forgotten, so it
    doesn't snap back if that genre gets a story again.
  - **"More in {genre}"** (added at the same time, no frame draws it: for
    design review). The hero shows a tab's five newest, so a genre with more
    stories would have left the rest unreachable under it. A genre tab now
    has a row of that name under the hero, with the tab's stories the hero
    doesn't show (`booksBeyondHero()`, `lib/hero.ts`, taken against the hero
    on screen, so a story published while the reader looks on shows there at
    once and none shows twice). It appears only when there are any, never on
    Discover or New. The tab's list is capped at 20, so a genre with more
    than 20 stories would need a "See all", which nothing builds yet.
  - **Unchanged:** the three carousels under the hero ("Picked for You",
    "Trending Now", "New Audio Releases") are the same on every tab and
    aren't filtered by genre.
  - **Moved:** the tab list and `TAB_GENRE`, from
    `components/discover/genre-tab-strip.tsx` and `app/(tabs)/index.tsx`, to
    `lib/discover-tabs.ts` (`DISCOVER_TABS` and `TAB_GENRE` are gone). The
    strip draws the tabs it is given.
  - **Tests:** 402 pass, 23 of them new (the rule, the order, a genre the app
    has never heard of, the queries, catalog sync marking it stale, and the
    "More" row). With both rules disabled, 8 of them fail. **Not yet seen on
    the phone**, which was offline in airplane mode.
  - **Seen on the phone later the same day**, in a screenshot taken during
    prompt 22a's checks (17:26 UTC): the strip read Discover, New, Romance,
    Dark Romance, the live catalogue's genres. Nothing else about it (the
    "More in {genre}" row, a tab appearing or leaving live) was checked.
- **Subscriber access on the server as built (prompt 22a).** Built on
  2026-10-02 at the owner's request. The owner said yes to Part C's design
  first, then to every server change at once (both migrations, the three
  functions, the four settings), and to publishing the pages after the
  proofs. The server's record is the dashboard's AGENTS.md (Data Model
  Notes); here, § Data Contract ("The entitlement mirror") and § Connecting
  ("Edge Functions").
  - **RevenueCat's API (step 1)**, checked with the `talebrim-server` key:
    - active entitlements come by internal id, with the expiry in
      milliseconds or null: `ad_free` is `entlb97eb9391d`;
    - an unknown customer answers 404 to a read and to a deletion, and a
      read never creates one;
    - a plan's product, store and environment come from the customer's
      subscriptions, whose entitlements list the lookup key only while the
      subscription gives access, so an ended plan couldn't name `ad_free`'s
      id: the owner's new test plan did;
    - in a billing grace period a subscription reads `in_grace_period`,
      still giving access;
    - 480 requests a minute for customer information.
  - **The app (Part B):**
    - `lib/server-plan.ts`: `syncServerPlan()` calls `sync-entitlement`,
      shares one request among callers made together, never throws, and
      logs in development only (`[server-plan]`). `syncServerPlanWithin(ms)`
      stops waiting, not the request.
    - After a purchase or restore that ends active, `usePurchase()`'s
      `finish()` waits for it, at most 5 seconds, before the outcome
      returns, so before `openUnlockedChapter()`. The button keeps its
      spinner meanwhile.
    - `watchEntitlementStarts()` (`lib/queries/billing.ts`, beside the lapse
      watcher, both on one `watchEntitlement()`), from
      `components/providers.tsx`: the session's first active answer, and any
      turn to active (`entitlementStarted()`, `lib/billing.ts`).
    - Once per open, for a chapter only the plan opens
      (`askServerAboutPlan()`, `types/states.ts`):
      - M6 (`hooks/use-now-playing.ts`): a `refused` or `unavailable` source
        syncs the plan, then signs again, loading meanwhile; then the
        existing recheck decides as before.
      - M5 (`hooks/use-chapter-reader.ts`): a text read that comes back
        empty although the row has text (`textWithheld()`) is read once
        more, the plan synced first for a chapter the plan opens. Still
        empty: Failed, whose Retry checks again. Never "no text".
      - Downloads (`lib/downloads/queue.ts`): `sign()` and the new
        `readText()` sync once and try once more; still refused, the chapter
        fails as refused.
    - Nothing waits on a JS timer to make progress. The purchase's 5-second
      bound is a wait in the foreground, with M10 on screen.
  - **Deviations from the prompt:**
    - A fourth setting, `REVENUECAT_ENTITLEMENT_ID`, holds `ad_free`'s id,
      as step 1 asked ("keep it as a setting").
    - `sync-entitlement` also throttles a reader without a row, per function
      instance, in memory: with no plan there's no `synced_at` to time from.
    - A download's refresh (an edited chapter) now runs the lock check too,
      so for a chapter the plan opens a withheld text fails it rather than
      marking the old text current.
    - The catalog views also got `security_barrier = on`, so a caller's
      filter never runs before the views' own `published` filter.
    - `entitlements.user_id` must look like a Clerk user id (a check).
    - The webhook answers a `TEST` event before it reads the RevenueCat
      settings, so the owner could set it up before the id was known.
    - M6's check covers `unavailable` as well as `refused` (Part C withholds
      the row). Unlocks still loading count as none in these checks: the
      server never withholds a chapter the reader unlocked.
    - The plan's details come from a second call, the customer's
      subscriptions.
  - **Proven over HTTP** (throwaway readers made through Clerk's Backend
    API, all deleted afterwards; the dashboard's AGENTS.md has each check):
    the webhook's credential (401 twice, 405, 400, and 200 for a test
    event); `sync-entitlement`'s (401 twice, 200 to CORS, 405); with no
    access, a locked chapter's text and narration refused while it stays
    listed; with an unlock, a plan row, or a promotional `ad_free` granted in
    RevenueCat and synced, both served; revoked and synced, or past the row's
    expiry, refused again; signed out, both catalog views 401;
    `delete-account` deleting the plan row and the RevenueCat customer
    (`deleted`, or `already_gone` for a reader RevenueCat never saw).
  - **Proven on the owner's phone** (build `9235ee79` over USB and Metro):
    - The owner set up the webhook in RevenueCat (Integrations → Webhooks,
      "Talebrim server", both environments, all events); its test event
      answered 200.
    - They bought a Test Store Weekly plan from Profile at 16:40 UTC. The
      phone is signed in as `user_3JivpJ82m3qLux5aKJ57DKwH03b` (a Google
      reader made 2026-09-23), not `user_3K3ACK…`, whose RevenueCat customer
      the earlier checks used. The purchase's own check answered 500
      (`not_configured`), as expected: the id wasn't set yet. The phone
      account's plan, read from RevenueCat's API, gave `entlb97eb9391d` (a
      first look found nothing because it read the other account). Once it
      was set, the webhook wrote the row within seconds (`test_store`,
      `sandbox`).
    - Test Store renewals reached RevenueCat up to 6 minutes late (due
      16:45:15, recorded 16:51:04, two periods at once), and meanwhile the
      server treated the plan as ended, as it should. For steady checks the
      account got a one-hour promotional `ad_free` through RevenueCat's API
      (the webhook synced it in half a second), revoked at the end.
    - A restart's once-a-session check answered "active".
    - Whispers In the Mist 4 and 5, both locked, played in M6 for the
      subscriber (loaded in 3.7 and 2.5 seconds) and from the mini player;
      Read instead showed chapter 4's text.
    - Chapter 4 downloaded (1,095,020 bytes of narration and its text, in 8
      seconds) and played in airplane mode from its file (1.3 seconds).
    - Reader B, with no plan, over HTTP: Storage refused chapter 4 (400), its
      text returned no row, it stayed listed as locked, and
      `sync-entitlement` answered `active: false`.
    - The plan ended (the promotional grant revoked at 17:21 UTC, the Test
      Store plan past its last period): RevenueCat showed nothing active at
      once, and the webhook deleted the row within 10 seconds. As the phone
      account, the server had no plan and no row for chapter 4. The app
      noticed on returning to the front ("plan ended", then the server's
      check: "none"), Discover's Continue card showed chapter 4 locked, and
      the next start's access check deleted its download.
    - **Not seen:** a *playing* locked chapter stopping when the plan ends.
      Chapter 4 was paused, and when the app came back nothing was loaded,
      so there was nothing to stop. The same path (`recheckLoaded()`)
      stopped a playing chapter on a dashboard lock on 2026-09-30, and it is
      tested.
    - **Bought from a locked chapter's paywall, with the server set up**
      (the same evening, at the owner's "continue"). By then the phone had
      been signed in to the owner's main account, `user_3K3ACK…`, which had
      no plan. Whispers 4 → its paywall → See plans → Weekly → Test valid
      purchase at 19:25:15 UTC. The webhook wrote the row 1.3 seconds later,
      and the app's own check after the purchase answered "active" within
      about 4 seconds. Chapter 4 opened with its text, and Listen played its
      narration (loaded in 4.1 seconds), then chapter 5's.
  - **RevenueCat quirk found:** a promotional grant made again after a
    revoke answers 201 but never shows active (proofs use a fresh reader for
    each grant). A new purchase shows in RevenueCat's API at once: an
    earlier note of a two-minute delay came from reading the wrong account.
  - **Other sessions** worked in the same working tree during the build:
    `talebrim-app-21` (tab-switch speed: the tab files, the root layout and
    the mini player) and the M3 tabs entry above. The first one's edits
    briefly broke Discover twice through Fast Refresh; a full reload cleared
    both. None of their files are part of 22a.
  - **Checked:** `typecheck`, `lint` and the test suite (22 of its tests
    new for 22a: the download queue's checks, the start watcher,
    `syncServerPlan()`, and the three rules). The dashboard: `deno check`,
    its three gates and five verify scripts.
  - **Copy:** none changed. M5's withheld text uses its existing Failed
    state.
  - **Published:** the dashboard's 22a changes are commit `527930f` on
    `dev`, and `main` was fast-forwarded to it with the owner's yes
    (`f63d269..527930f`). About a minute later talebrim.com's Privacy page
    said the subscription's status is kept on our servers, and the deletion
    page listed it with the record at RevenueCat; all four pages answered
    200. This repo's changes were committed and pushed to `dev` and `main`
    the same day.
- **Development tools belong to the owner's account.** Asked for by the
  owner on 2026-10-02: on the development build every account saw M11's
  "Development" group, so a reader account looked like the owner's. Only
  the owner's own account keeps the development tools; every other account
  sees the app as a reader will.
  - **The rule** (`lib/developer.ts`, tested in
    `lib/__tests__/developer.test.ts`): `isDeveloperAccount(email, verified)`
    is true only in a development build (`__DEV__`), for an account whose
    primary email Clerk has verified and which is exactly the owner's
    address, ignoring case and surrounding spaces. A "+tag", a moved dot or
    `googlemail.com` is another Clerk account, so it fails.
    `useIsDeveloper()` (`hooks/use-is-developer.ts`) reads it from Clerk's
    `useUser()`: false while Clerk loads, signed out, and in a store build.
  - **The owner's address is a setting, never in the repo.** Changed the
    same day, before this work was first pushed, at the owner's choice,
    because the GitHub repo is public ("The GitHub repos are public",
    below). It is `EXPO_PUBLIC_DEVELOPER_EMAIL` in `.env.local`, read once
    when `lib/developer.ts` loads, its case and spaces ignored. Unset or
    blank, nobody is a developer. After a change, restart Metro with
    `npx expo start -c`. Never copy it to EAS: prompt 22's step 17 leaves it
    out, as it leaves out `EXPO_PUBLIC_POSTHOG_DEBUG`.
  - **What it gates:**
    - M11's "Development" group ("View as a free reader") and the footer's
      "Development: health probe" link.
    - The health screen (`app/health.tsx`). It sits outside every gate in
      `app/_layout.tsx`, and only its clear-storage button ever checked
      `__DEV__`, so a link such as `talebrimapp://health` opened the probe
      (the reader's own session claims and a database check) in every build.
      "The development tools stay in testing builds" (2026-10-01) had
      recorded it as hidden, wrongly. Anyone but the owner is now sent to
      `/`.
    - The preview itself: `useFreeReaderPreview()` is false for any other
      account, so a switch left on can't change what they see.
    - Signing out turns the preview off (`clearUserScopedState()`), so it
      never carries into the next account on the phone.
  - **A UI gate, never security.** The owner's account is a reader in
    Clerk, with no `metadata.role` (checked 2026-10-02 against the
    development instance). The dashboard's admins are two other accounts, and
    this app never grants that claim (rule 4). The check runs on the phone
    and changes only what it draws; RLS stays the boundary.
  - **Store builds show none of it, the owner's account included**, because
    `__DEV__` is part of the rule. Whether the owner's account should keep
    the preview switch in the store app is a separate decision, not made.
  - **Not account-gated, because they belong to the build and not to the
    app:** the development client's own overlay, LogBox's notices, the
    `[…]` development logs, and RevenueCat's Test Store purchase dialog (a
    `test_…` key works only in a development build). They go with the store
    build.
  - **Tests:** 407 pass, 5 of them new. Four are in `developer.test.ts`: the
    owner's address in any case and with spaces; stand-ins for other readers
    and the dashboard's two admins (`example.com` addresses, since the repo
    is public and no other real account's address belongs in it) and seven
    near-miss addresses; no email, or one Clerk hasn't verified; and a
    release build. One is in `downloads.test.ts`
    (sign-out turns the preview off). In a control run without the reset,
    that one fails. Once the address became a setting, `developer.test.ts`
    used an `example.com` stand-in for the owner too, and gained two tests:
    the setting read with its case and spaces ignored, and nobody a
    developer when it is missing or blank. 409 pass in all.
  - **Seen on the owner's phone on 2026-10-02** (over USB and Metro), signed
    in as the owner's account: Profile shows the
    "Development" group and the "Development: health probe" link, so the
    verified-email check holds at runtime. The switch still flips the account
    card to "Free plan" with the upsell, and back to "Unlimited" when turned
    off. The probe opens, and its user id is that account's. The log held
    only Clerk's and RevenueCat's usual development warnings. That was with
    the address still written in `lib/developer.ts`. The setting itself is
    not seen on the phone yet: Metro has to be restarted with
    `npx expo start -c` first, and until then no account sees the group, the
    owner's included. The setting's value was checked on 2026-10-02 (present,
    not blank, equal to the owner's account) without printing it.
  - **Not seen:** another account. That needs a second account signed in on
    the phone, and signing the owner out deletes their downloads, so the
    rule's other accounts are proven by the tests only. To check: sign in as
    any account but the owner's, and Profile shows no "Development" group and
    no "Development: health probe" link.
- **Tab switches render less.** Worked on by another session
  (`talebrim-app-21`) on 2026-10-02, because switching tabs felt slow. That
  session ended before recording it, so this entry describes the code as it
  was left. Built, but not timed on the phone (last point).
  - **What changed:**
    - **The tab bar** (`components/nav/tab-bar.tsx`): each tab is a
      memoized `TabItem`, so a switch renders only the two tabs whose state
      changed.
    - **The mini player** (`components/player/MiniPlayer.tsx`) is memoized.
      It takes no props and reads the player itself, so a tab switch no
      longer renders it.
    - **The root layout** (`app/_layout.tsx`): screen tracking moved into
      its own `ScreenTracker` component, because its route hooks rendered
      the whole root stack on every navigation. Everything under the root
      layout is one memoized `App`, because Expo Router renders the root
      layout again on every navigation, a tab switch included. The
      navigators still update: they read their state from context.
    - **The tabs** (`app/(tabs)/_layout.tsx`): `TabPreloader` builds the
      tabs that weren't on screen when the shell mounted (Library and
      Profile, on a start at Discover) in the background, one at a time,
      each once the JS thread is idle (`requestIdleCallback`, 1.5 seconds
      apart). It sends to the tab navigator itself: `router.prefetch()`
      would aim at the root stack whenever another screen covers the tabs
      and build a second, hidden tab shell. Built on the tap instead,
      Profile took most of a second, nearly two in a development build.
    - **Discover's hero** (`hooks/use-hero-carousel.ts`,
      `components/discover/hero-carousel.tsx`): the auto-advance timer
      follows focus and blur events instead of `useIsFocused()` state, so
      leaving or returning to Discover renders nothing (`useHeroAutoAdvance()`
      became `useHeroMayAdvance()`, without the focus check). Regaining focus
      renders Discover again only when it brings a different hero set
      (`refocusChangesHeroSet()`, `lib/hero.ts`, tested in
      `lib/__tests__/hero.test.ts`).
  - **Fast Refresh can't swap a plain component for a memoized one.** When
    the mini player became memoized, the phone showed "Render Error: Object
    is not a function" in `TabsLayout` (17:22 local) until the app was
    restarted. After such a change, restart the app rather than trust the
    hot reload.
  - **The temporary timing code was removed before the commit** (2026-10-02):
    the React `Profiler`s and the JS-stall interval in
    `app/(tabs)/_layout.tsx`, and the commit and press logs (with their
    `useLayoutEffect`) in `components/nav/tab-bar.tsx`, all marked
    `TEMP(tabperf)`. Nothing prints `[tabperf]` any more. Typecheck, lint
    and the 407 tests pass without it.
  - **Not known:** how much faster the switches are on the phone. The
    session was measuring when it ended. Time them on the phone and record
    the result here.
- **The GitHub repos are public.** Found on 2026-10-02, before the work
  since `7f4b50e` was pushed: `danieldazong/Talebrim-Audio-app` and
  `danieldazong/Story-App-Dashboard` both answer GitHub's API without
  signing in. Everything committed, this file included, is readable by
  anyone, and stays in the history once pushed.
  - **No personal email address goes in a commit.** At the owner's choice,
    the owner's address moved from the code to a setting ("Development tools
    belong to the owner's account", above), the tests use `example.com`
    stand-ins, and this file names neither the owner's address nor the
    founder's own mailbox. Neither was ever pushed. Commits are authored as
    `you@yourdomain.com`, a placeholder.
  - **Before every push,** check the changed files against the values in
    both env files without printing any of them, and for email addresses
    other than the public support ones.
  - **One real address is already in public history.** Another session found
    it after the push: the dashboard admin's Google address, in this file's
    commit `7f4b50e` (2026-10-01) and in the dashboard's AGENTS.md. It is the
    only real personal address left in either repo's current files.
    - Taking it out of the current files costs nothing, and leaves the old
      commits as they are.
    - Taking it out of history needs a force-push to `dev` and `main` of a
      public repo, which for the dashboard is the branch Vercel deploys. And
      GitHub keeps serving the old commits until its support purges them.
    - **Left for the owner to decide**, with this recommendation: edit the
      current files only. An address alone gives nobody access, so check that
      the admin account has Google's 2-step verification on.
- **Native tabs on iOS (Liquid Glass).** Asked for by the owner on
  2026-10-02: the tab bar as Apple's Liquid Glass one, through Expo Router's
  native tabs. This change is iOS's, built ahead of prompt 28 and not on an
  `ios` branch, and leaves Android as it was. Android's native tabs follow
  in a separate change (no longer planned, as assumed on 2026-10-03: Android
  keeps its own bar, which now has a sliding circle that native tabs can't
  draw; Decisions — 2026-10-03, "The tab bar's sliding circle"). The web
  keeps `_layout.tsx`: native tabs there are a
  row of text tabs. Not seen on any device: there is no iPhone or Mac yet.
  - **The layout** is `app/(tabs)/_layout.ios.tsx`, which Expo Router uses on
    iOS in place of `_layout.tsx` (checked with its own route builder: iOS
    picks the `.ios` file, Android and the web the plain one). It is
    `NativeTabs` from `expo-router/unstable-native-tabs` (expo-router
    57.0.22, react-native-screens 4.26.2; nothing installed).
    - SF Symbols, each filled when selected: Discover `binoculars` (SF
      Symbols' only compass is `safari`, which Apple reserves for Safari),
      Library `books.vertical` (Apple Books' Library) and Profile `person`.
    - The system draws the bar. The only tokens are the ember tint of the
      selected tab and `bg` behind each screen.
    - Labels are in the system font, not Inter: an iOS tab bar's own type.
  - **The mini player** is the bar's bottom accessory
    (`NativeTabs.BottomAccessory`) while a chapter is loaded, through
    `MiniPlayer`'s new `placement` prop.
    - In the accessory it has no card of its own, a 32dp cover, the title
      alone when inline, and the system's label colours, which follow the
      glass between light and dark. With no `placement` it is unchanged.
    - The accessory is the bar's, so it shows on every tab, as
      `MINI_PLAYER_VISIBLE_ROUTES` allows today.
    - iOS 26 and later only: on iOS 18 and earlier the tabs show no mini
      player.
  - **Bottom padding:** `useBottomTabBarHeight()` throws outside JS tabs, so
    M3, M7 and M11 read `useTabBarInset()` (`hooks/use-tab-bar-inset.ts`).
    It is the same height on Android and the web, and 0 on iOS
    (`use-tab-bar-inset.ios.ts`), where the system insets each tab's scroll
    view.
  - **Kept native:** a second tap scrolls Library and Profile to the top
    (their lists are their screens' first view) and pops to the root
    (nothing to pop: each tab is one screen).
    - Not on Discover: its scroll view sits below the header and genre strip,
      where the system doesn't look. For the same reason it sets
      `disableTransparentOnScrollEdge`, or on iOS 18 and earlier the bar
      would stay see-through over it.
    - Every tab mounts at once on iOS, so there is no preloader.
  - **Checked:** typecheck, lint, the 409 tests, and both native bundles
    (`expo export`). The iOS one holds the native layout and the `.ios`
    hook, the Android one the old hook.
  - **The `.ios` hook went missing, and was restored on 2026-10-03.** The
    session that then started native tabs on Android, not the one that built
    this, deleted `use-tab-bar-inset.ios.ts` to replace it with a
    `.native.ts` for both phones. It then backed that attempt out (Decisions
    — 2026-10-03, "The tab bar's sliding circle") and left the iOS file
    deleted.
    - Until it was restored, iOS would have used the plain hook, whose
      `useBottomTabBarHeight()` throws inside native tabs, on every tab.
    - Typecheck, lint and the 409 tests all passed meanwhile (§ Linting and
      Validation).
    - It was restored exactly as it was (`return 0`). An iOS export
      (`npx expo export --platform ios --no-minify --no-bytecode`) then showed
      `useTabBarInset` returning 0 in the bundle, with the native layout.
      Nothing else of the Android attempt is left in the tree.
  - **To check on an iPhone on iOS 26:**
    - the glass bar and its ember tint
    - the accessory's size and colours, over a bright cover too
    - whether the last row of each list clears the accessory. If the
      system's inset leaves it out, the iOS series adds its height.
    - scroll to the top on Library and Profile
  - **Seeing it needs Xcode 26:** the glass comes from the iOS 26 SDK, so
    the app must be built with Xcode 26 or later and run on iOS 26.
    - This PC can't build iOS. Expo Go has been built with Xcode 26 since
      SDK 54, but this app runs on its development build.
    - An `ios.bundleIdentifier` comes first. It is not set: the owner's
      choice. `com.talebrim.app` would match Android, and it is permanent
      once on the App Store.
    - Then a Mac with Xcode 26 (`npx expo run:ios`), or an EAS simulator
      build from this PC. A build for a phone waits for the Apple Developer
      Program (Decisions — 2026-10-02, "iOS waits for an iPhone").

## Decisions — 2026-10-03

- **The tab bar's sliding circle.** Asked for by the owner at the end of
  2026-10-02, and built on 2026-10-03. The selected tab sits inside a
  coloured circle, showing its icon alone with no label. The other tabs show
  icon and label, and the circle slides between tabs. Built in
  `components/nav/tab-bar.tsx`, with `global.css`'s `nav` utilities.
  - **No frame draws it.** Every frame labels all three tabs, the selected
    one in ember, and `material/3.png`'s "circle" is the filled compass
    glyph itself. The owner's spec wins.
  - **Android and the web only.** iOS keeps the system's tab bar
    (`_layout.ios.tsx`; Decisions — 2026-10-02, "Native tabs on iOS"), which
    can't draw this circle. That is an assumption: the owner didn't mention
    iOS. For the same reason it ends the plan for native tabs on Android,
    whose bar can't draw it either.
  - **What it looks like:**
    - Each tab fills an equal third of the bar (`nav__item`).
    - The selected tab is its filled glyph in `ink` on a 44dp `ember` circle.
      The others are their outline glyph in `muted` over a 12px Inter Medium
      label (`nav__label`).
    - Until now every tab was its icon alone, and the selected one had its
      own ember circle.
    - The circle is ember because § Layout's active state is ember. Ink on it
      matches every ember button (5.5:1). The nav stays exempt from the
      one-ember rule.
    - The bar is still the 56dp pill, so the tab screens' bottom padding
      doesn't change.
  - **The motion:**
    - One shared value holds where the circle is, in tabs. It moves to the
      tab just selected with `withTiming`, over 250ms on
      `Easing.bezier(0.77, 0, 0.175, 1)`. That is the expo-animation skill's
      tab-indicator recipe: ease-in-out, because the circle moves across the
      bar.
    - The circle moves by `translateX`, from the row's measured width.
    - Each tab's two looks fade with the circle's distance from it. The
      filled glyph is gone by 11dp, before it can stick out past the circle's
      edge. The outline glyph and label are back by 52dp, once the circle has
      cleared them.
    - A tab the circle passes over dims as it passes. A tap while the circle
      moves sends it on from where it is.
    - All of it runs on the UI thread, so nothing renders during the slide.
  - **Reduce Motion** (Remove animations on Android) moves the circle at
    once. It is read with Reanimated's `useReducedMotion()`, as M5's toolbar
    reads it.
  - **Touch targets:** the whole third of the bar is the tab, about
    115 × 56dp on a 393dp phone. It was the 44dp circle with 8dp of slop.
  - **Deviation:** the labels are 12px, below § Typography's 14–16px for UI
    chrome. The frames draw them at about 11px, and the app already builds
    small text at 12px (M7, M11).
  - **Checked:** typecheck, lint and the 409 tests. Also the web preview in
    headless Edge at 393 × 852, through a temporary route since deleted:
    - each tab at rest;
    - the slide from Discover to Profile, recorded frame by frame at an
      eighth of its speed;
    - the tabs paint above the circle: where a fading label overlaps it, its
      pixels are the label blended over ember.
  - **Seen on the owner's phone on 2026-10-03, at rest only** (their
    screenshot and the agent's, taken over USB and Metro): Discover selected
    shows the compass glyph alone on the ember circle with no label, and
    Library and Profile show an outline icon over their label. The bar kept
    its 56dp height, and nothing above it moved.
  - **Not seen:** the slide itself. To check on the development build:
    - tap from Discover to Profile and back;
    - tap a third tab while the circle is moving;
    - turn on Remove animations;
    - set the largest text size.
- **M3's header brand.** Asked for by the owner on 2026-10-03: the
  "talebrim" text at the top of Discover was too large, and the logo showed
  nowhere after onboarding. The owner asked for the name at half the size,
  with the logo, or for a recommendation on whether the name is needed beside
  it. Built in `components/discover/discover-header.tsx`.
  - **What it is now:** the logo (`images.logo`) at 22 × 20dp, then the name
    8dp to its right in Fraunces at 12px, half the 24px it was. The logo is
    white headphones over three sound bars, the middle one ember. Its drawing
    is 192 × 172 px with no margin, so it keeps that ratio and sits on the
    16dp edge. The row is still 44dp tall, set by the buttons, so nothing
    below it moved.
  - **Recommended to the owner: keep the name beside the logo, small.**
    - The logo says "audio", and Talebrim is read and listen. The name says
      what the app is, and a new brand's name should show wherever its logo
      does.
    - Apps such as Spotify and Netflix drop the wordmark only once the mark
      is recognised on its own.
    - To show the logo alone later, delete the `Text` in the header. If 12px
      reads too small, `text-sm` (14px) is the next step.
  - **Deviations:** from `material/3.png`, which draws a text wordmark, and
    from § Screen Inventory's M3 line, now changed to match. The owner asked
    for it. The name at 12px is below § Typography's 14–16px for UI chrome:
    it is a logotype, and the owner asked for half.
  - **Ember:** the logo's middle bar is a brand mark and not an action, so
    the hero's `Read or Listen` stays the screen's one ember button.
  - **Screen readers:** the logo is hidden from them (`accessible={false}`),
    and the name beside it is read, as before. The name still stops growing
    at 1.3× text.
  - **Checked:** typecheck, lint and the 409 tests. Seen on the owner's
    phone after a reload, at 12px. A 14px try was never seen: the phone
    stopped taking edits ("Learned on 2026-10-03").
  - **Not seen:** the web preview, or a narrower phone. The lockup is about
    70dp wide in a 393dp row, so there is room.

---

## Build order — what to build, and what is blocked

**Do not start with the Reader and the Player.** They are the interesting
screens and they were the blocked ones: they depended on tables that now exist
(Phase 2, done 2026-09-23) and still depend on a storage decision that has not
been made. Discovery is unblocked, and
it teaches the data layer cheaply.

### Phase 0 — two decisions, before any code

**1 · Confirm the Clerk instance.** Development, to match the dashboard.
Settle it first or you debug two unknowns at once.

**2 · Decide the audio bucket.** **Decided 2026-09-24: private.** The app
signs its own URLs (prompt 18) under a storage policy that checks entitlement
on the server (the deferred setup; Decisions — 2026-09-24, "Audio").

|                  | Private (chosen)                                           | Public                                      |
| ---------------- | ---------------------------------------------------------- | ------------------------------------------- |
| URL              | signed per chapter, expiring                               | immutable, CDN-cached                       |
| Before playback  | one request to sign, made when M6 opens                    | none                                        |
| Offline download | download with a fresh signed URL, then play the local file | works directly                              |
| Paywall          | enforced by the storage policy                             | none: a leaked link plays forever, no login |
| Egress cost      | ~$0.09/GB uncached                                         | ~$0.03/GB cached                            |

Until 2026-09-24 this file recommended public, because `locked` was enforced
only in the app anyway. That gave away too much: a public link needs no login
at all, and the text gap it leaned on is itself to be closed before launch
(§ Before production).

### Phase 1 — build against what exists (unblocked today)

**M1** sign-in · **M3** Discover · **M4** Story Detail · **M8** Search

These run against `books_catalog` and `chapters_catalog` now. Expect a real app
against real data quickly, and expect to learn what the schema actually needs —
which is the point of doing this before Phase 2.

`M2` (genre picker) is unblocked too, and as of prompt 07 persists through the
`onboarding` Zustand store (AsyncStorage-backed) rather than to Supabase —
that remains the only durable home for genre choices until a profile table
exists in Phase 2.

**Status, 2026-09-25.** Built: M1 sign-in and M2 genre picker (prompts
04–07), the navigation shell (08), M3 Discover on `books_catalog` (09–10), M8
Search on `books_catalog` (11), live catalog updates from the dashboard (see
Data Contract), the Phase 2 reader tables with their read-only fetchers
(13), M4 Story Detail (12), and the M5 Reader (14) on real chapter text (15).
The parity writer (16) is built, and its `updated_at` trigger (dashboard
migration `20260924190305`) is applied. M6 Now Playing (17) is wired to real
audio with the live mini player (18). Its device checks wait for the deferred
setup. The M5 ↔ M6 handoff (19) is built and passed the owner's Expo Go
checks on 2026-09-25. M9 Full Chapter List (20) is built on real data
(Decisions — 2026-09-25, "M9 as built"). Its device checks wait for the
owner. M7 Library (21) is built on real data, with M4's `+ My List` pill
(Decisions — 2026-09-25, "M7 as built"). Its device checks wait for the
owner. M3's hero is a carousel of the 5 newest stories that glides every 7
seconds, with Continue on the Discover tab; the owner has seen both working
in the web preview and on BlueStacks (Decisions — 2026-09-25, "M3's hero
carousel and Continue").
The owner decided notifications, wait-for-free and analytics on 2026-09-25
(Decisions — 2026-09-25, "Retention and revenue"). Analytics (21a) is built
and confirmed sending real events, tagged `environment = development`, with
no IP or location and no duplicate or server-render events (Decisions —
2026-09-25, "Analytics as built"). The deferred setup is under way: the first
development build was queued on EAS on 2026-09-25 (Decisions — 2026-09-25,
"Development build"). Prompt 22 was reviewed the same day (Decisions —
2026-09-25, "Paywall"), and its code was built at the owner's request ahead
of its preconditions (Decisions — 2026-09-25, "Paywall as built"): M5a, M10,
M9's bar and the subscription in the lock rule. Its store setup (step 17)
and sandbox tests (step 18) wait for the owner's Google Play and RevenueCat
accounts, and for a development build made after the SDK was installed.
New-chapter alerts (23a) were built on 2026-09-28, the server side live
(Decisions — 2026-09-28); their device checks wait for the development build
made that day. The audio storage policy (deferred setup step 8) went live
the same day, with a second reader account to prove it (Decisions —
2026-09-28, "Audio storage policy"). Offline downloads (24) were built the
same evening, with the `chapters_catalog` size columns live (Decisions —
2026-09-28, "Downloads as built"); their device checks wait for the
development build made after them, `fd1773bc` (finished the same night),
which also carries 23a.
**Status, 2026-10-01.** Build `fd1773bc` reached the phone on 2026-09-30,
and the owner's device checks of 23a and 24 found five failures, all fixed
that day (Decisions — 2026-09-30). Build `9235ee79`, with the audio-focus
fix, is on the phone since 2026-10-01. The owner has confirmed alerts pop
up, locks set in the dashboard hold, and YouTube pauses the narration; the
download that carries on after leaving the app, and M2 staying away after a
sign-out round trip, are still to be re-checked. M11 Profile (25) was built
the same day and seen on the phone (Decisions — 2026-10-01, "M11 as built").
Its `delete-account` function is deployed and proven over HTTP; sign-out and
deletion on the phone are still to be checked. Measuring M11 found
NativeWind's rem was 14 on native, which shrank every screen, and an alerts
loop while offline. Both were fixed the same day; each still needs a look on
the phone, which was locked (Decisions — 2026-10-01).
**Next:** prompt 22's Part C (the store setup and the sandbox tests), waiting
on the owner's Google Play account (Decisions — 2026-10-01, "Prompt 22
(second review)"). Its Part D was built on 2026-10-01 ("A plan that ends
stops a locked chapter that is playing"). Meanwhile RevenueCat runs on its
Test Store in the development build ("RevenueCat's Test Store until Google
Play").
Prompt 22a (the entitlement mirror, locked text on the server) was built on
2026-10-02 (Decisions — 2026-10-02, "Subscriber access on the server as
built"). Then prompt 23, and the passes 26 and 27 last (Decisions —
2026-09-25, "Build order from here"). Each prompt is reviewed against the
code before it is built.
**Status, 2026-10-02** (Decisions — 2026-10-02):
- **Live and proven:** support email comes from `support@talebrim.com`
  (talebrim.com verified in Resend); talebrim.com's pages name Nouvrix LLC
  under North Carolina law; chapters 1–3 of every story are free
  (`free_chapters_at_start` 3).
- **Prompt 22a** is built, live on the server (two migrations, three Edge
  Functions, RevenueCat's webhook) and proven on the phone: a subscriber
  plays, downloads and reads locked chapters, a purchase from the paywall
  opens one within seconds, and a reader without the plan is refused by the
  server.
- **The deferred setup:** steps 3 and 7 (Google sign-in on the development
  build) were found done. Of step 9, screen-off autoplay was fixed and
  passed, and the sleep timer passed; the owner reports the rest working,
  "connectivity lost mid-chapter" included, which they first skipped. The
  deferred setup is complete.
- **Built the same day by other sessions:** Discover's tabs follow the
  published stories' genres (its strip showed on the phone during 22a's
  checks), and the development tools show only on the owner's account (seen
  on the phone). Each is recorded in its own entry.
- **Tab switches render less** (its own entry): built, and its temporary
  `[tabperf]` timing code removed before the commit. Not yet timed on the
  phone.
- **Committed and pushed on 2026-10-02:** everything since `7f4b50e`, as
  `dd21d32`, to `dev` and `main`, with no personal email address in it,
  since both repos are public ("The GitHub repos are public"). The
  dashboard's 22a changes are its commits `527930f` and `39d8035`, and
  `4a98a7f` records their publishing.
**Status, 2026-10-03** (Decisions — 2026-10-03):
- **Built since `dd21d32`, and pushed to `dev` and `main` on 2026-10-03:**
  - The tab bar's sliding circle, on Android and the web. Seen on the
    owner's phone at rest; the slide itself isn't recorded as seen.
  - M3's header brand: the logo beside the name at half its old size. Seen on
    the phone.
  - Native tabs on iOS, built on 2026-10-02 and not seen on any device: there
    is no iPhone or Mac yet. Its `use-tab-bar-inset.ios.ts` was found missing
    on 2026-10-03 and restored (its entry).
- **Waiting on the owner:**
  - Restart Metro with `npx expo start -c`. The running one started before
    `EXPO_PUBLIC_DEVELOPER_EMAIL` was added to `.env.local`, so until then no
    account sees the "Development" group, the owner's included.
  - The one real address still in public history ("The GitHub repos are
    public"): edit the current files only, or rewrite history.
Open before M5 ships:
- The age gate (§ Content Rules). Every live book is `mature_17`, and nothing
  gates it yet. It needs its own prompt, and a decision on whether M1's 18+
  legal line is enough.

Decided for prompt 18 on 2026-09-24 (Decisions — 2026-09-24, "Audio"): a
private bucket, and `expo-audio`. Prompt 18 runs in Expo Go. The development
build and the audio storage policy wait for the deferred setup below, which is
due before prompt 22.

### Deferred setup — due before prompt 23a

Postponed on 2026-09-24 so building can carry on in Expo Go. It cannot wait
for the last prompt: RevenueCat (prompt 22) and rewarded ads (prompt 23) do not
run in Expo Go, and Google Play products need the package name. Once due
before prompt 22, whose code was then built ahead of it; now due before
prompt 23a, which needs the development build, and prompt 24, which needs the
audio storage policy (Decisions — 2026-09-25, "Build order from here").

**Progress, 2026-09-25** (Decisions — 2026-09-25, "Development build"):
steps 1, 2 and 6 are done, and the first development build was queued on
EAS. Still open: 3 (Clerk redirect), 4 and 5 (the owner's phone and test
data), 7 (Google sign-in on the build), 8 (the audio storage policy) and the
device checks in 9.

**Progress, 2026-09-26:** the rebuilt development build is installed on the
owner's phone, an itel A662LM on Android 12 (step 4 asked for 13 or newer
where possible). Four of step 9's checks passed on it; the rest of 9 is still
open, as are 3, 5, 7 and 8.

**Progress, 2026-09-28:** a new development build with `expo-notifications`
(EAS build `596d2398`, for prompt 23a) finished, and is waiting to be
installed on the phone over the current one (same keystore, so the app's
data stays). Later that day step 8 went live and step 5's reader account
was made (Decisions — 2026-09-28, "Audio storage policy"). Steps 3 and 7,
and the rest of 9, are still open. That evening prompt 24 queued another
development build, `fd1773bc` (downloads: `expo-file-system` direct,
`allowBackup` off, storage permissions blocked); it replaces `596d2398`,
which never reached the phone.

**Progress, 2026-09-30:** `fd1773bc` was installed and the owner ran the
device checks for prompts 23a and 24 and step 9. Five failures were fixed
the same day (Decisions — 2026-09-30): a paused download starting over, a
chapter locked inside the free run staying open, M2 showing again after
signing back in, another app's audio playing over the narration, and the
first real alert not showing. The audio fix is native: EAS build `9235ee79`
replaces `fd1773bc` on the phone.

**Progress, 2026-10-01:** `9235ee79` was installed over USB (`adb -d install
-r`, which keeps the app's data), and the owner confirmed that a YouTube
video now pauses the narration. Still open: steps 3 and 7 (Google sign-in on
the development build), and of step 9 the phone call, the Bluetooth buttons,
the screen-off checks and connectivity lost mid-stream.

**Progress, 2026-10-02:**
- Steps 3 and 7 were already done (Google sign-in on the build since
  2026-09-30).
- Step 9's screen-off checks were run with the agent watching the phone's
  log:
  - Autoplay failed. It was fixed and passed the same day (Decisions —
    2026-10-02, "Autoplay with the screen off stalled; fixed").
  - The sleep timer passed.
- The owner reports the phone call, the Bluetooth buttons, the re-mint and
  the lock screen's 10-second skips working.
- Connectivity lost mid-stream: skipped at first, then reported working by
  the owner the same day. **The deferred setup is complete.**

**Owner, before anything else:**

1. **Android package name.** **Done 2026-09-25: `com.talebrim.app`**, in
   `app.json`. It is permanent once the app is on Google Play. Lowercase
   letters, digits and underscores; at least two parts separated by dots, each
   starting with a letter.
2. **Expo account and EAS.** **Done 2026-09-25:** the project is
   `@ayoko123/talebrim-app` (`extra.eas.projectId`
   `effcd777-50c4-4c5e-beb9-ff598da08002`, `owner: "ayoko123"` in
   `app.json`), and EAS generated and keeps the Android keystore on that
   account. The original instructions: sign up at expo.dev, then run these in this repo:
   `npm install -g eas-cli`, `eas login`, `eas whoami`, `eas init`. The last
   one adds a `projectId` to `app.json`, which is expected. If PowerShell
   blocks scripts, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`,
   or put `npx eas-cli` in front of each command. On the first build, let EAS
   generate and keep the Android keystore: every Google Play update must be
   signed with the same key.
3. **Clerk redirect.** Development instance → Talebrim → Configure → Native
   applications → Allowlist for mobile SSO redirect → add
   `talebrimapp://sso-callback`. That is where Google sign-in returns in the
   development build; Expo Go uses its own address. **Done**, found on
   2026-10-02 through Clerk's Backend API (`GET /v1/redirect_urls`). The
   allowlist holds `talebrimapp://sso-callback` and an Expo Go address,
   `exp://100.91.238.31:8081/--/sso-callback`.
4. **An Android phone.** Android 13 or newer if possible, allowed to install
   unknown apps, on the same Wi-Fi as the PC. Bluetooth headphones or a
   speaker for the Bluetooth checks.
5. **Test data.** A second reader account on the development instance that is
   not an admin, with an email you can receive codes on. Also a locked chapter
   with narration (chapter 4 or later, access locked, audio uploaded through
   the dashboard), besides a free chapter with audio. **The chapters exist
   (checked 2026-09-28):** Whispers In the Mist 4 and 5 and Man of Ashes 001
   13 are locked with narration; Whispers 1 to 3 are free with narration.
   **The second reader account exists (2026-09-28):**
   `talebrim.reader.b+clerk_test@example.com`, no role; sign in with the
   code `424242`, as Clerk sends nothing to a `+clerk_test` address on a
   development instance.

**Then one prompt, to be written before prompt 22:**

6. Install `expo-dev-client`. Add `eas.json` with a `development` profile
   (`developmentClient: true`, `distribution: "internal"`, an Android APK), and
   set `android.package`. The owner runs
   `eas build --profile development --platform android` and installs the build
   on the phone. From then on, `npx expo start` opens the development build;
   press `s` to switch to Expo Go. **Done 2026-09-25.** The build (rebuilt
   with `buildFromSource`) was installed on the owner's phone, an itel
   A662LM on Android 12, on 2026-09-26. On this PC the build command needs `EAS_NO_VCS=1` in
   front of it (Decisions — 2026-09-25, "Development build").
7. Sign in with Google on the build, to prove the redirect. **Done
   2026-09-30, confirmed 2026-10-02.**
   - The owner's account was created through Google on 2026-09-30 at
     13:42:28 UTC: its email is verified `from_oauth_google`, and it has no
     password.
   - The session the development build holds on the phone (the
     `com.talebrim.app` process's log names it) was created in that same
     moment, so Google sign-in returned to the build.
8. **The audio storage policy**, a migration in the dashboard repo, with
   § Phase 2's discipline. **Done 2026-09-28** (dashboard migration
   `20260928140000`, proven over HTTP; Decisions — 2026-09-28, "Audio
   storage policy"). The plan it followed:
   - Replace `audio_read` with a policy that allows `select` on `audio`
     objects when `is_admin()` OR a new `security definer` function (`stable`,
     `set search_path = ''`) says this caller may play this object. The
     function returns true only when all of these hold:
     - The object is a chapter's current `audio_path`. The chapter id comes
       from the path's second segment (`<bookId>/<chapterId>/<file>`) and is
       looked up by primary key, never by scanning paths. A malformed segment
       returns false, never an error.
     - The chapter's book is published.
     - The chapter is free by `access`, free by position (`number <=
       free_chapters_at_start` from the live `app_settings` row), or has an
       `unlocks` row for `auth.jwt() ->> 'sub'`.
   - Subscribers wait for the entitlement mirror: leave `-- TODO(paywall)`
     where prompt 22a adds it.
   - It is the second sanctioned change to a dashboard-owned object, after the
     catalog broadcast triggers. The `is_admin()` branch keeps the dashboard's
     playback (`createAudioPlaybackUrl`) and uploads working. Show the owner
     the migration, and get a yes, before `supabase db push`.
   - Verify with real HTTP requests, because storage policies are enforced at
     the Storage API, not in SQL. Follow the dashboard AGENTS.md's method: use
     a newly minted Clerk token at once (tokens live 60 seconds; an expired
     one reads as "Bucket not found"), and read the body rather than the
     status (a denial is a 400 "Object not found"). Prove that a non-admin
     reader can sign a free chapter's audio and an unlocked one's but not a
     locked one's, that `anon` can sign nothing, and that the admin can sign
     all of them. Run the dashboard's three gates and
     `supabase/verify/reader_tables_rls.sql`. Record the change in both
     repos' AGENTS.md.
9. The device checks prompt 18 could not run in Expo Go, on the development
   build:
   - background playback past three minutes, and the lock-screen controls,
     with their skip interval. **Passed 2026-09-26.**
   - pause and resume from Bluetooth headphone buttons. **The owner reports
     it working** (2026-10-02, tested about three days earlier)
   - the Android 13+ notification: its controls should appear with no
     permission asked. **Settled 2026-09-25:** Android exempts
     media-session notifications from `POST_NOTIFICATIONS`, and
     `expo-audio`'s is one (a Media3 `MediaSessionService`), so the app never
     requests it for playback. Its manifest didn't declare it until prompt
     23a: since 2026-09-28 `expo-notifications`' own manifest declares it,
     for new-chapter alerts only. Confirm on the phone that the controls
     show in the notification drawer. Prompt 23a requests the permission for
     new-chapter alerts, from the alerts sheet's "Notify me", never for
     playback.
     **Passed 2026-09-26 on Android 12:** the controls show, and nothing
     asked. Android 12 has no notification permission, so the "nothing
     asked" half is proven only on Android 13 or newer.
   - headphones unplugged and Bluetooth disconnecting on Android: playback
     pauses. **Patched 2026-09-25** (owner's choice over a local module):
     its ExoPlayer sets `setHandleAudioBecomingNoisy(true)`, in
     `patches/expo-audio+57.0.5.patch`. **It failed the phone check on
     2026-09-26**, because the build used `expo-audio`'s precompiled copy;
     `buildFromSource` now compiles the patch (Decisions — 2026-09-25,
     "Development build"). **Both passed on 2026-09-26** with the rebuilt
     build: unplugging, and switching Bluetooth headphones off. iOS pauses on
     its own.
   - the lock screen's 10-second skips (see Decisions — 2026-09-24, "Audio
     as built"): accept them, or decide otherwise. **Accepted by the owner
     on 2026-10-02:** tried on the phone, and they work
   - a phone call pauses and then resumes; another app taking audio focus
     pauses without resuming. **Failed on 2026-09-30** (YouTube played over
     the narration); fixed in the `expo-audio` patch, and **the YouTube half
     passed on 2026-10-01** with build `9235ee79` (Decisions — 2026-09-30,
     "Another app's audio pauses the narration"). **The owner reports the
     phone call working** (2026-10-02, tested about three days earlier). That
     was probably on a build before `9235ee79`, which changed how calls take
     the audio, so a quick repeat is worth doing when convenient
   - with the screen off: the sleep timer pausing on time, autoplay into the
     next chapter, and a re-mint after the URL expires (`DEV_FORCE_EXPIRY`
     in `lib/queries/audio.ts` signs for 60 seconds). **Autoplay failed on
     2026-10-02**: it stalled until the screen came back. It was fixed and
     passed the same day (Decisions — 2026-10-02, "Autoplay with the screen
     off stalled; fixed"). **The sleep timer passed on 2026-10-02:** five
     minutes on Eternal Eclipse chapter 1, and it paused on time, the
     button back to "Sleep timer". **The owner reports the re-mint working**
     too (2026-10-02). It was never run with the forced 60-second expiry
   - connectivity lost mid-stream: it pauses when the buffer runs out, and
     resumes where it stopped on reconnect. Skipped by the owner on
     2026-10-02, then **reported working by the owner the same day**. It was
     not watched in the phone's log.

### Phase 2 — the three reader tables (done 2026-09-23)

Write these **informed by Phase 1**, not before it. Four product questions have
to be answered first:

1. Does a rewarded-ad unlock **expire**, or is it permanent?
2. Is a reading position **per account** or **per device**?
3. Does `My List` (M7) store **order**, or is it sorted by recency?
4. Does an unlock belong to the **user**, or to the **user + chapter** pair
   with a count (e.g. re-watchable)?

Then: `reading_positions`, `unlocks`, `library_items`.

**Answered 2026-09-23:** an unlock is permanent; a position is per account;
My List is sorted by `created_at desc`, with no order column; an unlock
belongs to the user + chapter pair, one row each. The tables were applied
that day. See Data Contract for what exists.

**Every migration follows the discipline already proven here on 2026-09-20:**

- **Written, tested and pushed from the dashboard repo**
  (`story-app-dashboad/supabase/migrations`). It holds this database's only
  migration history, including this app's earlier `20260920000001` and
  `20260923000001`. This repo has no `supabase/migrations` and must not grow
  one — two histories against one database break `supabase db push`.
- **Additive only.** No `alter` on `books`, `chapters`, `app_settings` or
  `activity_log`. Those belong to a dashboard running in production.
- RLS on from the start, scoped to `auth.jwt() ->> 'sub'`, so a reader can
  touch only their own rows.
- `supabase db push`, then **regenerate types and diff them** — the proof a
  migration is additive is that the diff shows _only additions_.
- Re-run the dashboard's three gates: `typecheck`, `lint`, `build`.
- Re-run the RLS impersonation test as a non-admin **and** as an admin, so
  both audiences are proven rather than assumed.

### Phase 3 — the blocked screens, now unblocked

**M5** Reader · **M6** Now Playing · **M7** Library · **M9** Chapter List ·
**M5a** paywall · **M10**/**M11** subscription and profile.

Read/listen parity becomes implementable at this point and not before: steps
2–4 of its algorithm write to `reading_positions`.

### Before production — four things to plan for now, and one closed

**Locked chapter text is protected server-side (closed 2026-10-02).** Until
then RLS let any signed-in reader select `chapters.script_text` for any
published chapter, locked or not: the app never ran the text query for a
locked chapter, which kept the UI honest but was not security. Prompt 22a
closed it with the owner's yes: dashboard migration `20261002130000` rewrote
`chapters_select`, so a reader gets a locked chapter's row only when they
unlocked it or hold Talebrim Unlimited (`has_active_plan()`, from the
entitlement mirror). The catalog views still list every chapter (Decisions —
2026-10-02, "Subscriber access on the server as built"). Audio closed the
same gap on 2026-09-28 (§ Deferred setup, step 8) and gained the plan with
22a.

**The instance is `t3.nano`.** `AGENTS.md` measures a **~450ms floor for a
trivial query** and concludes that **instance size outranks every code-level
fix**. No schema work makes this feel like a modern app. Budget the upgrade,
and lean on TanStack Query's persisted cache so a warm screen never waits on
the network.

**Seed more content.** Three published books, 27 chapters, eight with audio
(2026-09-25). A Discover carousel, a 100-row virtualised chapter list and a
search results screen cannot be evaluated against that. Load it through the
admin dashboard — that path exists and exercising it is the point.

**Chapter text no longer rides in the persisted cache (closed 2026-09-28,
prompt 24).** The whole TanStack cache persists as a single AsyncStorage
value, and live chapters reach ~315,000 characters (Man of Ashes 001 chapters
8–10 and 13); on Android a value past ~2 MB can fail to read back, and then
the cache fails to restore for every screen. `shouldPersistQuery()` now drops
every key under `queryKeys.chapters.textAll()` by prefix (the rest of
`chapters` still persists), and a downloaded chapter's text is a file of its
own (Decisions — 2026-09-28, "Downloads as built"). Recently read text stays
in memory for the session. Still open: the reader lays a whole chapter out in
one `ScrollView`, which has not been tried at that length.

**The store listings' pages exist; the owner still has three steps.** Since
2026-10-01, talebrim.com serves Terms, Privacy, Help and an account-deletion
page from the dashboard repo, and the app links to them (Decisions —
2026-10-01, "Legal pages, support and analytics deletion"). Before launch:
- Published on 2026-10-01 with the owner's approval. The owner still
  supplies the operator's legal name and country and the governing law.
- The support inbox is `support@nouvrix.com`, the parent company's, active
  since 2026-10-01 (it replaced the planned `support@talebrim.com`).
- In Play Console, the privacy policy is
  `https://talebrim.com/privacy`, the account deletion URL in the Data
  safety form is `https://talebrim.com/delete-account`, and the listing's
  contact email is `support@nouvrix.com`.
Keep the pages true as the app changes: rewarded ads (prompt 23) need the
privacy policy updated first.

---

## Connecting — project, keys and instances

> Verified against the live project on 2026-09-20. **This app connects to the
> same Supabase project and the same Clerk application as the admin dashboard.**
> There is no separate mobile backend: the dashboard writes the catalog, this
> app reads it.

### Supabase

|              |                                                                                   |
| ------------ | --------------------------------------------------------------------------------- |
| Project name | `story-app-dashboad` (the typo is in the real project name — do not "correct" it) |
| Project ref  | `fwjrdzzdtshbqrfkgivd`                                                            |
| Region       | `us-east-1`                                                                       |
| Instance     | `t3.nano` — see the performance ceiling below                                     |
| API URL      | `https://fwjrdzzdtshbqrfkgivd.supabase.co`                                        |

```bash
# .env — the anon key is designed to ship in a client; RLS is what protects data.
EXPO_PUBLIC_SUPABASE_URL=https://fwjrdzzdtshbqrfkgivd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key from Supabase → Settings → API>
```

**Never put `SUPABASE_SERVICE_ROLE_KEY` in this app**, in any form, including
behind a feature flag or in a build-time constant. It bypasses every policy in
this document. Anything needing it runs in an Edge Function.

This project uses the newer **`sb_publishable_…` / `sb_secret_…`** key format
rather than the legacy JWT-shaped keys. That matters in one recorded place: the
resumable-upload endpoint rejects them at parse, so a Node script written
against the old format will fail confusingly (AGENTS.md, prompt 16). The
mobile app does not upload, so it is unaffected — noted only so the format is
not mistaken for a misconfiguration.

**Edge Functions.** Every function lives in the dashboard repo's
`supabase/functions/`, beside the only migration history. Each is deployed
with `verify_jwt` off and checks its own credential, since none is called
with a Supabase token (Supabase's docs for the `sb_` keys). Deploy with
`--no-verify-jwt --use-api`.

- **`notify-new-chapters`** (prompt 23a; Decisions — 2026-09-28) is called
  by `pg_cron`, never by this app. Its secrets (`NOTIFY_CRON_SECRET`,
  `EXPO_ACCESS_TOKEN`, and the project's own secret key, which Supabase
  injects) live only in the function's environment.
- **`delete-account`** (prompt 25; Decisions — 2026-10-01, "M11 as built")
  is called by this app, only from `hooks/use-delete-account.ts`, with the
  reader's Clerk session token as the bearer. The function verifies that
  token against Clerk's JWKS itself. Its secrets are `CLERK_SECRET_KEY` (the
  development instance's) and `CLERK_ISSUER`
  (`https://cheerful-walleye-3066.clerk.accounts.dev`), plus the project's
  own secret key. **At the production Clerk cutover, change both Clerk
  secrets together**, or every deletion fails as an unverified token.
  Deployed on 2026-10-01 with the owner's yes, and proven over HTTP
  (Decisions — 2026-10-01, "M11 as built"). Its PostHog step deletes the
  reader's PostHog person and events. It was deployed on 2026-10-01 with
  `POSTHOG_PERSONAL_API_KEY` (person write, the `Talebrim_app` project
  only), `POSTHOG_HOST` (`https://us.posthog.com`) and `POSTHOG_PROJECT_ID`
  (`628093`); without all three, every deletion answers `not_configured`
  (Decisions — 2026-10-01, "Account deletion removes the reader's
  analytics"). Since 2026-10-02 (prompt 22a) it also deletes the reader's
  `entitlements` row and their RevenueCat customer, before PostHog and
  Clerk, with `REVENUECAT_SECRET_KEY` and `REVENUECAT_PROJECT_ID`; its
  answer gains `entitlements` (a count) and `revenuecat_customer`
  (`"deleted"` or `"already_gone"`).
- **`sync-entitlement`** (prompt 22a; Decisions — 2026-10-02, "Subscriber
  access on the server as built") is called by this app, only from
  `lib/server-plan.ts`, with the reader's Clerk token, verified as
  `delete-account` verifies it. It asks RevenueCat for the caller's active
  entitlements and writes the `entitlements` mirror to match, answering
  `{ active, expires_at }`. A row synced in the last 10 seconds answers from
  the table. Its secrets: `CLERK_ISSUER`, `REVENUECAT_SECRET_KEY`,
  `REVENUECAT_PROJECT_ID` and `REVENUECAT_ENTITLEMENT_ID` (`ad_free`'s
  internal id, `entlb97eb9391d`).
- **`revenuecat-webhook`** (prompt 22a) is called by RevenueCat only, for
  every event from production and sandbox (the Test Store's included). Its
  `Authorization` header must equal `REVENUECAT_WEBHOOK_AUTH` (in the
  dashboard's `.env` and the function's secrets; RevenueCat → Integrations →
  Webhooks holds the same value). It syncs every Clerk id an event names
  from RevenueCat's REST API, never from the event, and answers 500 on a
  failure so RevenueCat retries.
- **`contact-support`** (Decisions — 2026-10-01, "Help is a message to
  support") is called by this app, only from
  `hooks/use-contact-support.ts`, with the reader's Clerk token. It emails
  M11's Help form to `support@nouvrix.com` (`SUPPORT_EMAIL_TO`, since
  2026-10-01) through Resend.
  - Its secrets are the two Clerk ones (change them with `delete-account`'s
    at the cutover), plus `RESEND_API_KEY`, `SUPPORT_EMAIL_TO` and
    `SUPPORT_EMAIL_FROM`.
  - Deployed 2026-10-01. `RESEND_API_KEY` set the same day, and a message
    delivered (Decisions — 2026-10-01, "Support is support@nouvrix.com").
  - Since 2026-10-02 the sender is `Talebrim Support
    <support@talebrim.com>`, on talebrim.com as verified in Resend
    (Decisions — 2026-10-02, "Support emails come from talebrim.com").

### Clerk

Two instances exist, and **both are registered as Supabase Third-Party Auth
issuers**, so a token from either is accepted by RLS.

| Instance    | Issuer                                             | Use                |
| ----------- | -------------------------------------------------- | ------------------ |
| Development | `https://cheerful-walleye-3066.clerk.accounts.dev` | local dev, Expo Go, the development build |
| Production  | `https://clerk.talebrim.com`                       | release builds     |

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=<pk_test_… for dev, pk_live_… for release>
```

**The session-token claim is the load-bearing setting.** Both instances are
configured with:

```json
{ "metadata": "{{user.public_metadata}}" }
```

Without it `auth.jwt() -> 'metadata'` is empty and **every RLS policy denies
everything** — which fails closed, not open, but presents as a total outage
rather than a permissions error. If reads suddenly return nothing, check this
before anything else.

Note the **two different `role` claims** in a Clerk token, which is a live trap
this project has already hit: the **top-level** `role` is always
`authenticated` and is what every policy's `to authenticated` matches; the
**operator** role is the nested `metadata.role`. Conflating them makes
`is_admin()` false for everyone. A reader needs only the top-level claim —
this app should never grant `metadata.role`.

⚠️ **The admin dashboard currently runs on the DEVELOPMENT instance.** The
production cutover was completed, verified, and then rolled back on 2026-09-19
when its sign-in card stopped rendering; the cause is unresolved. See
`AGENTS.md`, Deferred Security Tasks item 3, and
`docs/PRODUCTION-CLERK-CUTOVER.md`. Point this app at the development instance
too until that is settled, or the two halves of the product will be
authenticating against different user pools.

### Storage and the CDN

`app_settings` is a single live row and is the source of truth for these —
read it rather than hardcoding:

| Setting                  | Live value                                 |
| ------------------------ | ------------------------------------------ |
| `public_cdn_domain`      | `https://fwjrdzzdtshbqrfkgivd.supabase.co` |
| `bucket_name`            | `novelnow-media`                           |
| `storage_provider`       | `supabase_storage`                         |
| `free_chapters_at_start` | `3` (set by the owner on 2026-10-02)       |
| `default_chapter_access` | `locked`                                   |

Cover URLs are built as
`<public_cdn_domain>/storage/v1/object/public/covers/<cover_path>`. The
migration's _default_ for `public_cdn_domain` is the stale
`https://cdn.novelnow.app` from before the rename — the live row is correct, so
read the row. If `app_settings` is ever empty the dashboard falls back to
`SETTINGS_DEFAULTS`; this app should surface an error rather than invent a
domain.

**Readers cannot select `app_settings` itself** — its policy is `is_admin()`,
so a normal reader gets zero rows (verified 2026-09-23; testing as the admin
hides this). Read the three values this app needs — `public_cdn_domain`,
`free_chapters_at_start`, `default_chapter_access` — through the
`reader_settings()` function (dashboard migration `20260923000001`), which
`appSettingsOptions()` in `lib/queries/app-settings.ts` already calls. It works
signed out too, and returns nothing else from the row.

---

## Data Contract — what actually exists in Supabase

> Verified against the live schema on 2026-09-20. The admin dashboard
> (`story-app-dashboad`, a separate repo with its own `AGENTS.md`) owns this database; this app is a **reader** of it.
> Anything below marked **does not exist** has to be built before the screen
> that needs it, and building it is a schema change that must not break the
> dashboard.

### Tables that exist today

| Table          | What it holds                                                                                            | Mobile use          |
| -------------- | -------------------------------------------------------------------------------------------------------- | ------------------- |
| `books`        | title, author, short*description, synopsis, genres[], maturity, status, cover*\*, default_chapter_access | M3, M4, M7, M8      |
| `chapters`     | book_id, number, title, script_text, audio_path, audio_duration_seconds, access                          | M4, M5, M6, M9      |
| `app_settings` | single row: CDN domain, accepted formats, free_chapters_at_start                                         | read-only config    |
| `activity_log` | admin audit trail, append-only                                                                           | **not for the app** |

Two views exist and are **shaped for the dashboard, not for this app**:
`chapters_list` deliberately omits `script_text` (it exists so the admin
Chapters table does not ship 50,000 words to render word counts), and
`chapters_needing_attention` is an admin work queue. Do not build reader
screens on either; they will be joined by a reader-facing view instead.

### The reader tables (migrations 20260923121634, 20260923121638, 20260923121642)

Applied on 2026-09-23 from the dashboard repo, and **purely additive**. A
before/after comparison of every object in `public` showed 0 removed and 0
changed. All 108 additions belong to these three tables, and the generated
types gained only their three definitions. These tables are this app's; the
migration files live in the dashboard repo, which holds the only migration
history (see Phase 2).

| Table               | One row per                          | Readers may                               | Read through (`lib/queries/`)        |
| ------------------- | ------------------------------------ | ----------------------------------------- | ------------------------------------ |
| `reading_positions` | reader + chapter (unique)            | select, insert, update, delete their own  | `readingPositionByChapterOptions()`, `resumeTargetOptions()`, `recentPositionsOptions()` |
| `unlocks`           | reader + chapter (unique), permanent | **select their own only**                 | `unlocksByUserOptions()`             |
| `library_items`     | reader + book (unique)               | select, insert, update, delete their own  | `libraryItemsByUserOptions()`        |

- `user_id` is `text` (the Clerk `sub`, like the dashboard's
  `activity_log.actor_id`) and defaults to the caller's own `sub`.
- `reading_positions` holds `audio_ms`, `text_offset` (a **character**
  offset) and `last_mode` (`text` | `audio`). A check constraint requires the
  side named in `last_mode` to hold a value. `updated_at` is the parity
  clock. Trigger `reading_positions_set_updated_at` (migration
  `20260924190305`) sets it on every insert and update, overwriting whatever
  a client sends. Applied 2026-09-24 (see parity above).
  `book_id` is denormalised so Library needs no join.
- `unlocks.source` is `ad` | `purchase`. A subscription never writes here:
  access comes from the RevenueCat entitlement at read time.
- Policies are `to authenticated`, scoped to
  `user_id = (select auth.jwt() ->> 'sub')`, with **no `is_admin()` branch**.
  An operator sees only their own rows. `anon` has no grants at all.
  `authenticated` has exactly the operations above: the project's default
  privileges would otherwise have handed every new table ALL rights, TRUNCATE
  included.
- Every foreign key is **`on delete cascade`**, so a book or chapter the
  dashboard deletes takes readers' rows with it, instead of the delete failing
  on them. Each foreign key is indexed, so the cascade never scans.
- Writers: `reading_positions` only through `lib/parity/writer.ts`;
  `library_items` only through M4's `+ My List` pill (`hooks/use-my-list.ts`,
  with `addToMyList()` and `removeFromMyList()`); `unlocks` never. A reader's
  rows in all three, and in `push_tokens`, are deleted only by the
  `delete-account` Edge Function, at the reader's request (M11).
- Verified by `supabase/verify/reader_tables_rls.sql` in the dashboard repo:
  40 impersonation checks covering readers A and B, `anon`, and an admin, all
  passing on the live tables. It rolls back everything it seeds, so re-run it
  after any change to these tables:
  `npx supabase db query --linked -f supabase/verify/reader_tables_rls.sql`.

### New-chapter alerts (migration 20260928120000)

Applied 2026-09-28 from the dashboard repo, additive, with prompt 23a
(Decisions — 2026-09-28).

| Object                 | What it is                                                         | Readers may                        |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------- |
| `push_tokens`          | one row per phone with alerts on: its Expo push token, one account | select their own                   |
| `set_push_token(token, enabled)` | `security definer`: true gives the phone's token to the caller, false releases it whoever holds it | call it (`authenticated` only) |
| `chapter_alerts`, `book_alerts`, `push_tickets` | the job's state: chapters found and sent, each book's last alert, Expo's tickets | nothing (server only) |
| `notify_find_new_chapters()`, `notify_due_books()`, `notify_mark_sent()` | the job's steps | nothing (`service_role` only) |

- Writer: `push_tokens` only through `lib/push.ts`, and only by calling
  `set_push_token()`. Nothing else in the app touches these objects.
- The Edge Function `notify-new-chapters` (dashboard repo) runs every minute
  from `pg_cron` through `pg_net`, with a shared secret from Vault (every 5
  minutes until migration `20260930130000`; Decisions — 2026-09-30, "Alerts
  go out right away").
- Verified by `supabase/verify/new_chapter_alerts_rls.sql` in the dashboard
  repo: 53 checks since 2026-09-30, the job's steps included, all passing.
  Re-run it after any change to these objects.

### The entitlement mirror (migrations 20261002120000, 20261002130000)

Applied 2026-10-02 from the dashboard repo with the owner's yes (prompt 22a;
Decisions — 2026-10-02, "Subscriber access on the server as built").

| Object | What it is | Readers may |
| --- | --- | --- |
| `entitlements` | one row per reader while RevenueCat says Talebrim Unlimited (`ad_free`) is active: its expiry, product, store and environment | nothing (server only) |
| `has_active_plan()` | `security definer`: the caller has an `ad_free` row whose `expires_at` is null or later than now | call it (`authenticated` only) |

- Written only by the `revenuecat-webhook` and `sync-entitlement` Edge
  Functions, from RevenueCat's REST API (§ Connecting, "Edge Functions"), and
  emptied for a reader by `delete-account`. This app never reads or writes
  it: its lock rule reads RevenueCat's SDK, and `lib/server-plan.ts` only
  asks the server to check again.
- `has_active_plan()` opens a chapter in `can_play_audio()` (the audio
  policy) and in `chapters_select` (the text), so a subscriber plays,
  downloads and reads every locked chapter. The server's clock ends a plan
  at its expiry, webhook or not.
- Sandbox and Test Store plans count, as in the app.
- Verified by `supabase/verify/entitlements_rls.sql` (31 checks) and
  `supabase/verify/locked_text_rls.sql` (29), with
  `audio_read_policy.sql` (27, its subscriber cases added) in the dashboard
  repo.

**Still does not exist:** `bookmarks` (M5's bookmark button is omitted until
it does).

### Column facts that change how screens are built

- **`chapters.access` is `free | locked`.** There is no "unlocked for this
  user" column, by design — that is per-user state and belongs in the missing
  `unlocks` table. M9's four row states are therefore **computed**, not stored.
- **`books.status` is `draft | published`.** The app must filter
  `status = 'published'` on every catalog read. A draft is unfinished admin
  work and must never reach a reader.
- **`maturity` is `general | mature_17`** — the enum value is `mature_17`
  and every label reads **`Mature 18+`**. Renaming the enum is a migration the
  dashboard shares; do not "fix" it in the app.
- **`chapters.audio_duration_seconds` is nullable, and so is
  `audio_duration_source`.** A file can be in storage with no duration ever
  measured — `loadedmetadata` reports `Infinity`/`NaN` for some encodings.
  Render a "duration unknown" state; never print `00:00` over an unmeasured
  file. The dashboard learned this the hard way.
- **`script_text` is plain Markdown with exactly three marks** — `**bold**`,
  `_italic_`, `## heading`. The admin editor stores nothing else, deliberately,
  because this app consumes the column directly. Parse those three; do not
  assume full Markdown.
- **Cover fields are nullable.** `cover_path` null is a legitimate state —
  render the placeholder, never a broken image.

### Storage buckets and the audio problem

| Bucket    | Public?         | Consequence for this app                                                         |
| --------- | --------------- | -------------------------------------------------------------------------------- |
| `covers`  | **public read** | Build URLs directly from `cover_path` + CDN domain. No signing, cacheable, fast. |
| `audio`   | **private**     | **Signed per chapter by the app, under a policy that checks entitlement (prompt 18).** |
| `scripts` | admin only      | Never touched by this app. Prose comes from `chapters.script_text`.              |

**Decided 2026-09-24: `audio` stays private** (Decisions — 2026-09-24,
"Audio"). The app signs each chapter's URL itself, through `createSignedUrl`
under the reader's Clerk token. Storage signs only what the `audio` read policy
allows. Since 2026-09-28 (dashboard migration `20260928140000`) that is
`is_admin()` or `public.can_play_audio(name)`: a published chapter's current
file, free by its own access, unlocked by this reader, or opened by
Talebrim Unlimited (`has_active_plan()`, since migration `20261002120000`;
never by its number since migration `20260930120000`). Until then any
signed-in user could read any object. No Edge Function and no service-role
key are involved in signing.

- A signed URL is a bearer credential, and it expires: never persist one.
- An offline download is a copy made with a fresh signed URL. The file then
  plays locally, so the expiry no longer matters to it.
- `chapters.audio_path` stays readable to any signed-in reader. Once the policy
  is in, that is harmless: a path the reader may not sign plays nothing.
  (Since 2026-10-02 a locked chapter's row, `audio_path` included, reaches
  only a reader who may open it: § Before production.)

### Query patterns this app needs, and the indexes behind them

The dashboard's indexes are `chapters(book_id)`, `chapters(book_id, number)`
and `activity_log(created_at desc)`. **There is no index on `books.status`**,
which is the column every reader query filters on. Discover, Search and Library
all table-scan today. That is invisible at two books and will not be at five
hundred.

Additive index and view work is required before launch. It cannot break the
dashboard — indexes and new views change no existing table — but it must be
written as its own migration and verified against the dashboard's gates and
RLS tests.

### What has already been built (migration 20260920000001)

Applied to the live database and verified. **Purely additive** — no existing
table, view or policy was altered, which is what makes it safe to run against a
database the admin dashboard is using in production.

**Indexes:** `books(status)` — the column every reader query filters on and
which nothing indexed; `books` GIN on `genres` for the Discover tab strip and
Search chips (a btree cannot serve `@>` containment on a text[]); and a partial
index on `chapters(book_id) where audio_path is not null` for the audio-first
screens, which stays small because the catalog is mostly text today.

**`books_catalog`** — one row per **published** book with `chapter_count`,
`audio_count`, `free_chapter_count` and `total_duration_seconds` computed in
Postgres. Use this for M3, M4, M7 and M8 instead of querying `books` and then
counting chapters per row; that N+1 is what makes a list feel slow when a
trivial query already costs ~450ms. `total_duration_seconds` is **null, not
zero**, when nothing has a measured duration.

**`chapters_catalog`** — chapter metadata for M4's preview and M9's full list,
with `has_audio` / `has_text` booleans and **no `script_text`**. Fetch prose
per chapter from `chapters.script_text` when the reader actually opens one.
That single-row read by id (`chapterTextOptions()` in
`lib/queries/chapters.ts`) is a **sanctioned direct read of `chapters`**.
It runs only after `chapters_catalog` has returned the same chapter — which
proves it is published — and never for a chapter that resolves to locked.
Prompt 18 adds the only other one, `audio_path` for signing
(`chapterAudioSourceOptions()`), on the same terms. Since 2026-10-02 the
server enforces those terms too: a locked chapter's row comes back only to a
reader who unlocked it or whose plan the server knows of; to anyone else
the read answers no row (`textWithheld()`, prompt 22a).

Since dashboard migration `20260928150000` (prompt 24, 2026-09-28) it also
carries two sizes for offline downloads, appended at its end:
`audio_size_bytes` (the size the dashboard records at upload) and
`text_bytes` (`octet_length(script_text)`, a number, never the text). M4's
and M9's queries keep their explicit columns; `lib/queries/downloads.ts`
selects the sizes.

Both views set `security_invoker = on` until 2026-10-02, so the caller's RLS
applied. Since dashboard migration `20261002130000` (prompt 22a) they run as
their owner (`security_invoker = off`, `security_barrier = on`), because
`chapters` now withholds a locked chapter's row from a reader without access,
and the lists, the lock icons and `books_catalog`'s counts need every
chapter. They hold no text and no `audio_path`, and their grants are SELECT
for `authenticated` only: a signed-out request gets 401. A later `create or
replace view` of either must restate both options. Supabase's advisor flags
them as security-definer views; that is expected. Drafts are excluded **by
construction**: a mobile query that forgets `status = 'published'` cannot
leak one, because there are none in the view.

Verified by impersonating a non-admin reader in SQL: `is_admin()` false, zero
drafts visible, no `script_text` column, `activity_log` and `app_settings`
still denied — and separately as an admin, confirming `chapters_list` and
`chapters_needing_attention` still return what the dashboard expects. The
dashboard's typecheck, lint and build all pass against regenerated types.

### Live catalog updates (migration 20260923000002)

Applied 2026-09-23 with the owner's explicit approval — **the one sanctioned
exception to "don't touch `books`/`chapters`"**. Six statement-level triggers
on `books` and `chapters` call `broadcast_catalog_change()`, which sends
`{ book_ids, chapter_ids }` (ids only, published books only, including
published → draft) on the private Realtime topic `catalog`. Its body cannot
fail a dashboard write: errors downgrade to a WARNING. A select-only policy
on `realtime.messages` lets signed-in users receive; there is no insert
policy, so no client can send on the topic.

App side: `hooks/use-catalog-sync.ts` (mounted in `app/_layout.tsx`) listens
while signed in and in the foreground, then invalidates the affected query
keys (`lib/catalog-sync.ts`), always including lists, search and both of
Library's lists, which `isLibraryQuery()` matches for every account. Every
join does a catch-up refresh. Do not drop
the triggers or add columns to the payload; new screens get live data just by
using the key factory.

**Tokens keep the channel alive.** Realtime closes a private channel the
moment the token it holds expires, and realtime-js never rejoins a closed
channel. Clerk tokens live 60 seconds, and a cached one can already be expired
by the server's clock (seen on Android 2026-09-23 as "Token has expired 1
seconds ago"). So `refreshRealtimeAuth()` in `lib/supabase.ts` hands the
socket a newly issued token (`skipCache`) before every join, on every channel
error, and every 30 seconds. The hook rebuilds a closed channel with backoff
(1s, 3s, 10s, 30s). Ordinary REST queries keep using Clerk's cached token.

`realtime.messages` is partitioned by day, and Realtime creates the
partitions only when a client connects. With nobody connected the trigger's
send fails quietly, which is harmless because nobody is listening.

### Performance ceiling, stated plainly

The database is a `t3.nano` instance. `AGENTS.md` records a measured **~450ms
floor for a trivial query** and **1244ms for a cold `HEAD`**, and concludes
that **instance size outranks every code-level fix**. No amount of schema work
makes this feel like a modern app on that instance. Budget for an upgrade, and
lean on TanStack Query's persisted cache so a warm screen never waits on the
network.

---

## Clerk Rules

Use Clerk for authentication. Do not build custom auth.

**One application, shared with the admin dashboard** — see Identity model. The
mobile client is a **Native application** inside Talebrim, not a second Clerk
app. Do not create one.

- Publishable key only in the app. Secret keys never ship to the client.
- Token retrieval always goes through Clerk's `getToken`. Never cache a token in a module-level variable or in AsyncStorage.
- Sign-out clears persisted Zustand state and any user-scoped TanStack Query cache.
- `touchSession` is off on the web (`app/_layout.tsx`, 2026-09-25). In a browser, clerk-js "touches" the session each time the tab regains focus and leaves a failed request uncaught, which Expo's development overlay showed as "ClerkJS: Network error … Failed to fetch". A phone has no browser focus event, so the native apps never send it.

---

## Audio Rules

- `expo-audio` (decided 2026-09-24), with one app-wide player from `createAudioPlayer()` that outlives M6: background playback, lock-screen and Bluetooth controls through its media session, variable speed, sleep timer, and autoplay next chapter. It shows no next/previous-chapter buttons on the lock screen and offers no Android Auto browsing; both accepted.
- Its config plugin runs with `recordAudioAndroid: false` and `microphonePermission: false`. This app never records, and Google Play asks every app holding `RECORD_AUDIO` to justify it.
- Lock-screen controls, the playback notification and Bluetooth or car buttons all come from `expo-audio`'s media session. None of them exist in Expo Go (its manifest lacks the media service, so `player.ts` skips them there); test them on the development build.
- Playback pauses when headphones are unplugged or Bluetooth disconnects. On Android that is a patch to `expo-audio` (`patches/expo-audio+57.0.5.patch`, `setHandleAudioBecomingNoisy(true)`), because `expo-audio` 57.0.5 doesn't handle it. It only takes effect because `package.json` lists `expo-audio` under `expo.autolinking.android.buildFromSource`; without that, Gradle uses the module's precompiled copy and ignores the patch. Keep both through every upgrade until `expo-audio` does it itself.
- Never ask for the notification permission for playback: Android 13+ exempts media-session notifications from `POST_NOTIFICATIONS`.
- Audio focus on Android is ExoPlayer's (`handleAudioFocus = true`, usage media, content speech), patched into `expo-audio` (2026-09-30): full focus for every way playback starts, so another app's audio pauses the narration for good, a call pauses and resumes it, and a short sound (navigation) pauses rather than ducks it. `expo-audio`'s own module-level request is off in the same patch. Keep both through every upgrade until `expo-audio` does this itself.
- Narration is AAC in `.m4a`, mono, 64 kbps, with fast start: the dashboard's upload standard (Decisions — 2026-09-25, "Narration format"). This app plays whatever `audio_path` names and never converts audio.
- Downloads are offline copies, not files the reader owns: app-private storage, tied to the account, checked again online, and valid for 30 days offline. A chapter's audio and its text are two separate files. Implement both (prompt 24; Decisions — 2026-09-25, "Downloads").
- Auto-bookmark on pause.
- A loaded chapter the reader may no longer play (locked in the dashboard, unpublished) stops and unloads at the next catalog change or catch-up (`recheckLoaded()`; Decisions — 2026-09-30, "A lock set in the dashboard holds").
- M5 ↔ M6 handoff preserves position in both directions.
- Audio plays from signed URLs (private bucket). Never persist one, and never add a cache-busting parameter of your own to media. Each signing is a new URL, so do not count on CDN hits for audio (cached egress ~$0.03/GB against ~$0.09/GB uncached): a cost accepted with the private bucket. Offline downloads keep repeat plays off the network.

---

## Billing Rules

- Entitlements, restore and receipt validation go through RevenueCat. Supabase may mirror entitlement state for RLS, but RevenueCat is authoritative.
- **Plans, prices and renewal dates render from RevenueCat offerings/packages.** The prices in the M10 frame are placeholder.
- The yearly savings badge is **computed** from fetched package prices. Never hardcode a discount percentage.
- Restore Purchases is mandatory and must be reachable from M10 and M11 (Google Play policy).
- IAP does not work in Expo Go or on simulators. Plan EAS Build; test on real devices.
- Rewarded ads require a custom dev client. Never gate an already-unlocked chapter behind an ad.

---

## Content Rules

Catalog and chapter content come from Supabase, loaded through the admin CMS — the Talebrim Admin Dashboard, a separate repo at `C:\Users\PC\Desktop\story-app-dashboad` whose own `AGENTS.md` **owns this schema**. Read its Data Model Notes and Upload Rules before changing anything in Postgres: a migration written for this app can break that dashboard, and its three gates (`typecheck`, `lint`, `build`) plus its RLS verification are what prove it did not.

This app is a **reader**. It creates its own per-user tables (unlocks, reading positions) but must not alter `books`, `chapters`, `app_settings` or `activity_log`.

Seed content may live as typed JSON/TS in `data/` for local development.

The maturity flag is per book — respect it per title rather than assuming the whole catalog is mature. Show the age gate before content access. **The enum value is `mature_17`; every user-visible label reads `Mature 18+`.** That split is deliberate and shared with the admin dashboard — see Data Contract.

---

## Code Simplicity Rules

Avoid overengineering.

Duplicate twice; extract on the third use. No barrel-file re-export webs. No wrapper around a wrapper — if a component only forwards props, delete it. Delete dead code rather than commenting it out.

Refactor only when needed.

---

## Component Creation Rule

Only create reusable components when necessary. Ask if unsure.

Check `components/ui/` first. Today it holds `Badge`, `Button`, `Chip`, `Cover`, `ProgressBar` (prompt 21), `Screen`, `SegmentedControl`, `Sheet` (a sheet route's scrim and frame, prompt 23a), `TextLink` (prompt 22; its `tone` is `muted` by default, or `destructive` for M11's Sign out and Delete account, prompt 25) and the `Body`/`Heading` type helpers. Add others there when a screen first needs them.

Components take data via props and do not fetch. Fetching lives in `hooks/`.

Every interactive component implements its full state set and has an accessibility label.

Never put a button inside another button. A screen reader reads a button as one element and hides any button inside it, and on the web a button can't contain one. Lay them out as siblings in a row, as the mini player and M9's row with its headphone do (Decisions — 2026-09-25). The one exception is a tap area that is not a button: M5's page (`components/reader/chapter-body.tsx`) is an `accessible={false}` Pressable that toggles the toolbar, so the chapter buttons inside it stay reachable.

Name by role, not appearance: `PrimaryButton`, not `OrangeButton`.

`SegmentedControl` must default to the correct option — this is a known defect source in the design frames.

---

## Linting and Validation

Run:

```bash
npm run lint
npm run typecheck
npm test
```

Fix errors. A change that does not typecheck is not done.

**Those three commands can't see a platform file** (`name.ios.ts`,
`name.android.ts`, `name.native.ts`, `_layout.ios.tsx`). TypeScript and lint
resolve only the plain `name.ts`, and no test imports these hooks. On
2026-10-03 `use-tab-bar-inset.ios.ts` had been missing for hours, which would
have crashed every tab on iOS, while all three passed. After adding, changing
or deleting a platform file, export that platform to a folder outside the repo
and look for the file's code in the bundle:

```bash
npx expo export --platform ios --no-minify --no-bytecode --output-dir <folder>
```

It took about a minute and a half on 2026-10-03, and needs no phone.

Do not disable a rule to silence an error; fix the cause. An inline disable needs a justification comment. Do not reformat files you did not otherwise change.

---

## Running the development build on the owner's phone

Established on 2026-09-26. The owner tests the development build
(`com.talebrim.app`, built by EAS; see Decisions — 2026-09-25, "Development
build") on an **itel A662LM** (Android 12) connected to the PC by a **USB
cable**. Loading the app's code over Wi-Fi doesn't work on the owner's
network: the development bundle is about 18 MB and the download stalls at
99%, then "Reloading...". Always connect over USB.

**If the owner asks an agent** ("connect the phone to the dev build"):
1. Check that Metro is running: `curl -s http://localhost:8081/status` should
   print `packager-status:running`. If it doesn't, start Metro in the
   background with `npx expo start --dev-client --port 8081`.
2. Link the phone over USB: `adb -d reverse tcp:8081 tcp:8081`.
3. Open the app pointed at the PC:
   `adb -d shell am force-stop com.talebrim.app`, then
   `adb -d shell am start -a android.intent.action.VIEW -d "exp+talebrim-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.talebrim.app`.
4. Confirm it loaded. `curl http://localhost:8081/json/list` lists one
   target once the app's JavaScript runs. Then take a screenshot with
   `adb -d exec-out screencap -p > screen.png` and look at it.

`adb` is `%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe`. `-d` means
"the device on USB". BlueStacks is often attached too (as `emulator-5554`),
and it rejects `adb reverse` ("error: closed").

**If the owner does it themselves**, in the VS Code terminal (PowerShell):

Terminal 1, left running while testing:
```powershell
npx expo start
```

Terminal 2, with the phone plugged in by USB (again after every re-plug):
```powershell
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
& $adb -d reverse tcp:8081 tcp:8081
& $adb -d shell am start -a android.intent.action.VIEW -d "exp+talebrim-app://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.talebrim.app
```

Give the owner PowerShell syntax (`$env:LOCALAPPDATA`, `& "…"`), never
Command Prompt's `%LOCALAPPDATA%`, which PowerShell rejects.

**When it doesn't load:**
- **"unexpected end of stream on http://localhost:8081"** on the phone
  means Metro isn't running. `%TEMP%\adb.log` then shows "cannot connect to
  127.0.0.1:8081 … actively refused". Start Metro again.
- **A blank grey screen** is normal for about 15 seconds in development
  mode. If it stays grey, the phone has no internet. It needs its own Wi-Fi
  or mobile data for Clerk, Supabase and the audio; only the app's code
  comes over the cable.
- **"Allow USB debugging?"** on the phone: tap Allow, and tick "Always allow
  from this computer".
- **To read the phone's log**, first raise its 64 KB buffer with
  `adb -d logcat -G 16M`, then reproduce the problem and read
  `adb -d logcat -d`.
- **Two Metro servers** on port 8081 clash. Stop one before starting
  another.

**Learned on 2026-10-02:**
- **Check which account the phone is signed in to** before reading
  RevenueCat or the server's copy of a plan. That day it was a second Google
  account (`user_3JivpJ82m3qLux5aKJ57DKwH03b`) for one test and the owner's
  main account (`user_3K3ACK3uL5Mv59I1UbjJfiXNgK9`, the address in
  `EXPO_PUBLIC_DEVELOPER_EMAIL`) for the next. Reading the wrong one
  first looked like RevenueCat being slow. Profile's "Development" group
  shows only on the main account.
- **`adb -d logcat -c` can fail** on this phone ("failed to clear the
  'main,system,crash,kernel' logs"). Never chain the app's relaunch after it
  with `&&`.
- **With no phone attached, `adb -d logcat` waits forever.** Check `adb
  devices` first; the owner sometimes unplugs the phone between tests.
- **Other Claude sessions may share the phone and Metro.** Three did that
  day. Agree with them before restarting the app or sending taps, and say
  when the phone is free again.
- **The app can come back from the background as a fresh screen** ("Running
  \"main\"" again in the log, the same process). Android had destroyed the
  activity while memory was short. That time nothing was loaded in the
  player afterwards.

**Learned on 2026-10-03:**
- **Edits can stop reaching the phone.** Fast Refresh delivered none of three
  edits in a row, with the app still listed as a target at
  `localhost:8081/json/list`. Step 3's link (the `am start` with the
  dev-client URL, no force-stop needed) reloads the bundle: the screen is
  grey for about 25 seconds, then the app is back. Take the screenshot after
  that, not before.
- **A second Metro may be running.** `expo start --no-dev --minify --port
  8082` is a production-style bundle for timing and has no hot reload. The
  phone was on 8081 (`adb -d reverse --list` shows the mapping, and 8081's
  `/json/list` names the phone; 8082's lists no target).

---

## Communication Style

Be concise.

Lead with what changed and where — file paths, then the reason. Explain how to test.

Flag deviations from this file explicitly, with the source that justifies them. State assumptions and mark them as assumptions. If a design image and this file disagree, say so rather than silently choosing.

No progress narration. No restating the request. No summarising work visible in the diff.

When a feature is finished, end the report with § Owner reminders' open items, one line each.

---

## Important Constraints

**Supabase is the database.** Domain data lives in Postgres. AsyncStorage is for local-only concerns — onboarding completion, reader preferences, persisted Query cache — and is never the system of record.

Use:

- Supabase Postgres for catalog and chapters (existing), plus the reader tables `reading_positions`, `unlocks` and `library_items` (see Data Contract)
- Supabase Storage + CDN for covers and narration audio
- TanStack Query for server state
- Zustand for client state
- AsyncStorage for local persistence
- backend route handlers or Edge Functions for anything needing a service-role key

**iOS is in scope** (decided by the owner on 2026-09-29; Decisions — 2026-09-29, "iOS in scope"). It is built after Android v1, through prompt 28 (an audit and plan, no code) and the iOS series it writes. Until then, what is Android-only stays Android-only: billing, new-chapter alerts, downloads and the `expo-audio` patch. Every V1 frame is a 393 × 852dp Android frame, so iOS layout, safe areas and App Store review specifics are settled in that series, not assumed.

---

## Final Reminder

Before every feature implementation:

- Read this file
- Follow it strictly
- Build clean, simple code
- Replicate UI exactly when designs are provided
- Treat placeholder content as data, never as constants
- Protect read/listen parity above all else

After every feature: end the report with § Owner reminders' open items. The
owner asked to be reminded of them every time.

And the five non-negotiables from the top of this file, restated because this
is the section most likely to be re-read on its own:

1. The **service-role key** never enters this app.
2. Never **write** to `books`, `chapters`, `app_settings` or `activity_log` —
   this app reads a database the admin dashboard owns and runs in production.
3. Every catalog read filters **`status = 'published'`**, or uses the views
   that already do.
4. A Clerk token's **top-level `role`** (`authenticated`) is not its nested
   **`metadata.role`** (operator). Never grant the second from this app.
5. **One Clerk application**, shared with the dashboard — the mobile client
   is a Native application inside `Talebrim`, never a second Clerk app — and
   the **same instance**, currently development.
