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
  (approved 2026-09-24; installed by the deferred setup before prompt 22, see
  Build order)
- `expo-file-system` — offline downloads, new API only (`File`, `Directory`,
  `Paths`), never the legacy one (approved 2026-09-25; installed by prompt 24
  with `npx expo install`)

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

393 × 852dp frames, 8pt grid, 16dp side padding, 16dp card radius, pill buttons, 2:3 covers at 12dp radius, 56dp mini player, three-item bottom nav (Discover, Library, Profile) with active ember and inactive `#A79BB5`.

---

## Screen Inventory

> Provenance note: these specs come from the design prompts and design-review notes for this project. Where a design image disagrees, **the image wins for layout and this file wins for tokens** — and flag the conflict rather than silently choosing.

**M1 · Sign In / Sign Up** — Cover collage across the top third. Fraunces headline "Pick up where you left off". Outlined pill buttons for Google and Apple. Email input. Ember pill `Continue with email`. Legal line noting 18+ (see Data Contract on the label-vs-enum split). No bottom nav, no mini player.

**M2 · Onboarding Genre Picker** — Top-third collage. Headline "What do you love to read?". Genre chip grid — the dashboard's genre list, mirrored in `data/genres.ts` (see Decisions); selected chips blush-filled, unselected outlined. Step indicator. Ember pill `Start Reading`. Muted `Skip`. Selections seed recommendations; persist them and never re-show the screen.

**M3 · Home / Discover** — Wordmark left; search and notification icons right. Horizontal tab strip (Discover, New, Werewolf, Romance, Vampire, Fantasy) with ember underline on active. Hero card with a single ember `Read or Listen` — since 2026-09-25 a swipeable carousel of the tab's 5 newest stories, and on the Discover tab a `Continue` card above it for returning readers (Decisions — 2026-09-25, "M3's hero carousel"). Three carousels: Picked for You, Trending Now, New Audio Releases — audio titles carry a teal headphone badge. Mini player above bottom nav. Search icon routes to M8.

**M4 · Story Detail** — Flat `bg` surface (no backdrop); round back and share icons, and a `+ My List` pill left of Share that no frame draws (Decisions — 2026-09-25, "M7 as built"). Centred 2:3 cover. Fraunces title, author beneath. Metadata row: rating · chapters · length · status. Blush genre chips. `Read` ember pill beside `Listen` teal outlined pill. Thin progress line with resume label. Synopsis with `More`. Preview chapter rows with durations and lock icons, ending in an entry point to M9. **No bottom nav, no mini player.**

**M5 · Reader** — Light mode `#FBF7F1` by default (sepia and dark are user choices). Literata 18sp/1.7. Minimal top bar: back, chapter title, `Aa`. Fraunces chapter heading. Floating bottom toolbar on `#2C1E42` with brightness, `Aa`, bookmark, and a teal Listen icon that hands off to M6 at the equivalent position. Ember progress bar with position label. **No bottom nav, no mini player.**

**M5a · Paywall bottom sheet (over Reader)** — `#2C1E42` sheet, lock icon, headline naming the next chapter. Ember `Watch ad & continue`. Teal outlined `Go Ad-Free`. Muted restore-purchases and manage-subscription links. States the ad-free value proposition before any purchase. Never shown for an already-unlocked chapter.

**M6 · Now Playing** — The app's only full-screen gradient. Dismiss chevron. Large square cover with a thin ember rim. Title, author, chapter. Scrub bar with ember track and thumb, elapsed and remaining labels. Transport row: back-15, previous, 72dp ember play/pause with a `#1A1420` icon, next, forward-15. Secondary teal controls: speed, `Sleep timer`, `Read instead` — hands back to M5 at the equivalent position.

**M7 · My Library** — Fraunces title. Segmented toggle (Books / Audiobooks) on a dark track. `Continue` card: cover, title, progress label, ember progress bar, resume button. `My List` as a 3-column cover grid with an ember progress line under each; audiobook items carry a teal headphone badge. Mini player above bottom nav. Frame: `material/9.png`. Books are added and removed from M4's `+ My List` pill, which no frame draws (Decisions — 2026-09-25, "M7"). Built by prompt 21 ("M7 as built").

**M8 · Search & Results** — Back chevron plus search field in the header. Filter chips, active chip blush-filled. Result count line. Rows: cover thumbnail, title, author, metadata, audio badge where applicable. Recent searches when the query is empty. Needs a real empty state and a distinct no-results state.

**M9 · Full Chapter List** — Sticky header with cover and title. Sort toggle (Newest / Oldest). `Download all`. Long scrolling rows, each in exactly one state with a distinct visual: **Reading Now**, **Unlocked**, **Downloaded**, **Locked**. Bottom bar with `Unlock all chapters` and an ember `Go Ad-Free`. Must be virtualised — serials run well past 100 chapters. Frame: `material/5.png`. `Download all` and the bottom bar wait for the downloads and paywall prompts (Decisions — 2026-09-25, "M9"). Built by prompt 20 ("M9 as built").

**M10 · Subscription & Manage Plan** — Status card with current plan and renewal date. Switch-plan cards for Weekly, Monthly (blush savings badge) and Yearly (blush "Best value"); active plan carries an ember border. Confirm-change button. `Restore purchases` and `Manage in Google Play`. Muted cancel link. **Every price, plan title, badge percentage and renewal date is dynamic.**

**M11 · Profile & Settings** — Avatar card with name and plan badge. Upsell card with ember `See plans`. Three grouped sections as 56dp rows: Reading (text size, theme, Atkinson Hyperlegible toggle), Account (restore purchases, manage subscription), Support (help, contact). Sign-out link in `#C9705F`. Version string. Mini player above bottom nav. This is the Profile bottom-nav destination.

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
| `onboarding` | `hasCompletedOnboarding`, `selectedGenres`                          | yes — the only durable home for genres until Phase 2's profile table |
| `reader`     | `theme`, `fontSize`, `lineSpacing`, `atkinsonEnabled`                | yes — device-level, not per-account, so sign-out does not clear it |
| `playback`   | `currentChapterId` (mirrors the player's loaded chapter), `speed`, and the sleep timer's end time and chosen length. Only `lib/audio` writes it. Playing and the position are read from the player, never copied here (prompt 18) | no — session only |
| `parity`     | the in-session authoritative reading position, keyed by chapter, with the server `updated_at` it last saw and a dirty flag | no — see Read/listen parity below; only `lib/parity/writer.ts` writes it |
| `search`     | M8's `recentSearches` (most recent first, at most 8) — added in prompt 11 | yes — per account, so sign-out clears it; never written to the database, and no search-history table exists or should |

`hasCompletedOnboarding` also drives the routing gate: `app/_layout.tsx` uses
Expo Router's `Stack.Protected` (not an imperative `router.replace` in a
`useEffect`) to compose it with the Clerk auth gate — not signed in → M1;
signed in and incomplete → M2; signed in and complete → past onboarding. A
completed user cannot navigate back into M2 by any path, including a
force-quit or a reinstall-then-sign-in, because the screen is removed from
the navigator rather than merely redirected away from.

`lib/session.ts`'s `clearUserScopedState()` — called by sign-out and by a
`__DEV__`-only button on the temporary index route — clears the persisted
TanStack cache, the persisted `onboarding` slice (so the next account on
this device sees M2 again, not the previous account's genres) and the
persisted `search` slice (one account's recent searches are not the next
one's), and resets `parity`/`playback` in memory. It deliberately leaves the `reader` slice
alone.

---

## lib/

Use this for external service helpers and pure functions.

```txt
lib/
  supabase.ts
  clerk.ts
  parity/       the one reading_positions writer, and its pure rules
  query-status.ts  how a screen's status reads the queries it waits on (M5, M6)
  chapter-list.ts, library.ts, hero.ts  M9's, M7's and M3's hero's pure parts, each with its tests
  audio/        the one app-wide player (expo-audio), from prompt 18
  revenuecat.ts
  format.ts
  cn.ts
```

No React, no hooks, no JSX in `lib/`.

Never expose secret keys in the mobile app.

---

## State Management Rules

Strict split — violating it causes the parity bug this app exists to avoid.

**TanStack Query** owns all server data: catalog, book and chapter metadata, chapter text, audio URLs, entitlements, unlock records. (Unlock records live in `unlocks`, which the app can read but never write. There is no entitlement mirror: subscription access comes from RevenueCat. See Data Contract.) It also owns offline caching via a persister. Query keys are declared in one place.

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
  `TODO(parity)`, `TODO(handoff)`.
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
    entitlement mirror (the paywall prompt).
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
    more protected than text, and no real reader uses the app yet.
  - **Moved from prompt 19 into prompt 18:** the live mini player and the
    Android notification permission. Dismissing M6 leaves audio playing, and
    the mini player must not show a placeholder over a real track.
  - **Still to revise at their own reviews:** prompt 22 (the policy's
    subscription branch) and prompt 24 (it signs downloads through an Edge
    Function). Prompt 19 was revised on 2026-09-25.
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
    timing doesn't change.
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
    `hooks/use-reduce-motion-enabled.ts`). One story: no swiping, no dots.
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
- **Retention and revenue, proposed 2026-09-25, awaiting the owner.** Aimed
  at "come back more often and read more chapters", never at keeping readers
  longer than they meant: no invented urgency or rankings, no ads that are
  hard to close. The carousel and Continue on Discover are built (previous
  entry). The rest needs decisions before prompts 22–23 are reviewed:
  - **The chapter end is the revenue moment.** "Continue to Chapter N" as
    one tap, and when that chapter is locked, the paywall there (watch an ad,
    or go ad-free). Prompts 22–23 to be reviewed with this in mind.
  - **New-chapter notifications** for books on My List, the bell on
    Discover's purpose. Needs a notifications library (owner's approval), a
    server trigger on chapter publish, and the development build.
  - **Wait-for-free:** one locked chapter per book unlocks free each day, or
    at once with an ad or the subscription. Unlocks are server-written only
    (Decisions — 2026-09-23), so it needs a server function, and it changes
    the paywall's design.
  - **Analytics:** return rates, chapters per visit, paywall to ad or
    purchase. Needs a tool the owner approves.
  - **More stories** through the dashboard: 3 are published.

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
**Next: the deferred setup** (§ Deferred setup), which prompt 22 waits on,
and the owner's calls on notifications, wait-for-free and analytics
(Decisions — 2026-09-25, "Retention and revenue") before prompts 22–23 are
reviewed. Open before M5 ships:
- The age gate (§ Content Rules). Every live book is `mature_17`, and nothing
  gates it yet. It needs its own prompt, and a decision on whether M1's 18+
  legal line is enough.

Decided for prompt 18 on 2026-09-24 (Decisions — 2026-09-24, "Audio"): a
private bucket, and `expo-audio`. Prompt 18 runs in Expo Go. The development
build and the audio storage policy wait for the deferred setup below, which is
due before prompt 22.

### Deferred setup — due before prompt 22

Postponed on 2026-09-24 so building can carry on in Expo Go. It cannot wait
for the last prompt: RevenueCat (prompt 22) and rewarded ads (prompt 23) do not
run in Expo Go, and Google Play products need the package name. Prompt 22 stops
until this is done.

**Owner, before anything else:**

1. **Android package name.** Recommended: `com.talebrim.app`. It is permanent
   once the app is on Google Play. Lowercase letters, digits and underscores;
   at least two parts separated by dots, each starting with a letter.
2. **Expo account and EAS.** Sign up at expo.dev, then run these in this repo:
   `npm install -g eas-cli`, `eas login`, `eas whoami`, `eas init`. The last
   one adds a `projectId` to `app.json`, which is expected. If PowerShell
   blocks scripts, run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`,
   or put `npx eas-cli` in front of each command. On the first build, let EAS
   generate and keep the Android keystore: every Google Play update must be
   signed with the same key.
3. **Clerk redirect.** Development instance → Talebrim → Configure → Native
   applications → Allowlist for mobile SSO redirect → add
   `talebrimapp://sso-callback`. That is where Google sign-in returns in the
   development build; Expo Go uses its own address.
4. **An Android phone.** Android 13 or newer if possible, allowed to install
   unknown apps, on the same Wi-Fi as the PC. Bluetooth headphones or a
   speaker for the Bluetooth checks.
5. **Test data.** A second reader account on the development instance that is
   not an admin, with an email you can receive codes on. Also a locked chapter
   with narration (chapter 4 or later, access locked, audio uploaded through
   the dashboard), besides a free chapter with audio.

**Then one prompt, to be written before prompt 22:**

6. Install `expo-dev-client`. Add `eas.json` with a `development` profile
   (`developmentClient: true`, `distribution: "internal"`, an Android APK), and
   set `android.package`. The owner runs
   `eas build --profile development --platform android` and installs the build
   on the phone. From then on, `npx expo start` opens the development build;
   press `s` to switch to Expo Go.
7. Sign in with Google on the build, to prove the redirect.
8. **The audio storage policy**, a migration in the dashboard repo, with
   § Phase 2's discipline:
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
     where prompt 22 adds it.
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
     with their skip interval
   - Bluetooth pause and resume, and headphones unplugged
   - the Android 13+ notification: whether its controls appear without
     `POST_NOTIFICATIONS`. If they don't, request it with
     `requestNotificationPermissionsAsync()` at the first Play, never at
     launch. On denial, playback still works with fewer controls, and the app
     never asks twice in a session.
   - headphones unplugged and Bluetooth disconnecting on Android. `expo-audio`
     57.0.5 has no `ACTION_AUDIO_BECOMING_NOISY` handling (iOS pauses on its
     own), so playback likely carries on through the speaker. If it does, the
     owner chooses between a small local module and a patch to `expo-audio`;
     both need the development build.
   - the lock screen's 10-second skips (see Decisions — 2026-09-24, "Audio
     as built"): accept them, or decide otherwise
   - a phone call pauses and then resumes; another app taking audio focus
     pauses without resuming
   - with the screen off: the sleep timer pausing on time, autoplay into the
     next chapter, and a re-mint after the URL expires (`DEV_FORCE_EXPIRY`
     in `lib/queries/audio.ts` signs for 60 seconds)
   - connectivity lost mid-stream: it pauses when the buffer runs out, and
     resumes where it stopped on reconnect

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

### Before production — four things to plan for now

**Locked chapter text is not protected server-side.** RLS lets any signed-in
reader select `chapters.script_text` for any published chapter, locked or not
— by design, `locked` is enforced in the app, not a row-level secret. The app
never runs the text query for a locked chapter, which keeps the UI honest but
is not security: anyone replaying their own token can read every chapter.
Before launch, serve text through a server-side check of unlocks and
subscription entitlement (a `security definer` function or an Edge Function),
written as an additive migration in the dashboard repo — the `chapters`
policies stay the dashboard's. Audio closes the same gap in the deferred
setup (§ Deferred setup): its storage policy signs only what the reader may
play. Both checks need the subscription entitlement mirror once the paywall
prompt adds subscriptions.

**The instance is `t3.nano`.** `AGENTS.md` measures a **~450ms floor for a
trivial query** and concludes that **instance size outranks every code-level
fix**. No schema work makes this feel like a modern app. Budget the upgrade,
and lean on TanStack Query's persisted cache so a warm screen never waits on
the network.

**Seed more content.** Three published books, 27 chapters, eight with audio
(2026-09-25). A Discover carousel, a 100-row virtualised chapter list and a
search results screen cannot be evaluated against that. Load it through the
admin dashboard — that path exists and exercising it is the point.

**Chapter text rides in the one persisted cache value.** The whole TanStack
cache persists as a single AsyncStorage value, and every chapter read in the
last 24 hours is in it. Live chapters reach ~315,000 characters (Man of Ashes
001 chapters 8–10 and 13). On Android a value past ~2 MB can fail to read back,
and then the cache fails to restore for every screen. Prompt 24 closes this:
downloaded text becomes a file, and `shouldPersistQuery()` drops chapter text
(Decisions — 2026-09-25, "Downloads"). Until then the risk stands. The reader
also lays a whole chapter out in one `ScrollView`, which has not been tried at
that length.

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
| `free_chapters_at_start` | `3`                                        |
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
  with `addToMyList()` and `removeFromMyList()`); `unlocks` never.
- Verified by `supabase/verify/reader_tables_rls.sql` in the dashboard repo:
  40 impersonation checks covering readers A and B, `anon`, and an admin, all
  passing on the live tables. It rolls back everything it seeds, so re-run it
  after any change to these tables:
  `npx supabase db query --linked -f supabase/verify/reader_tables_rls.sql`.

**Still does not exist:** `bookmarks` (M5's bookmark button is omitted until
it does) and any entitlement mirror.

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
allows. The deferred setup (§ Deferred setup, before prompt 22) replaces the
dashboard's `audio_read`, which lets any signed-in user read any object, with
one that allows a published chapter that is free, or unlocked by this reader.
No Edge Function and no service-role key are involved.

- A signed URL is a bearer credential, and it expires: never persist one.
- An offline download is a copy made with a fresh signed URL. The file then
  plays locally, so the expiry no longer matters to it.
- `chapters.audio_path` stays readable to any signed-in reader. Once the policy
  is in, that is harmless: a path the reader may not sign plays nothing.

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
(`chapterAudioSourceOptions()`), on the same terms.

Both views set `security_invoker = on`, so the caller's RLS still applies.
Drafts are excluded **by construction**: a mobile query that forgets
`status = 'published'` cannot leak one, because there are none in the view.

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
- Narration is AAC in `.m4a`, mono, 64 kbps, with fast start: the dashboard's upload standard (Decisions — 2026-09-25, "Narration format"). This app plays whatever `audio_path` names and never converts audio.
- Downloads are offline copies, not files the reader owns: app-private storage, tied to the account, checked again online, and valid for 30 days offline. A chapter's audio and its text are two separate files. Implement both (prompt 24; Decisions — 2026-09-25, "Downloads").
- Auto-bookmark on pause.
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

Check `components/ui/` first. Today it holds `Badge`, `Button`, `Chip`, `Cover`, `ProgressBar` (prompt 21), `Screen`, `SegmentedControl` and the `Body`/`Heading` type helpers. Add others there when a screen first needs them.

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

Do not disable a rule to silence an error; fix the cause. An inline disable needs a justification comment. Do not reformat files you did not otherwise change.

---

## Communication Style

Be concise.

Lead with what changed and where — file paths, then the reason. Explain how to test.

Flag deviations from this file explicitly, with the source that justifies them. State assumptions and mark them as assumptions. If a design image and this file disagree, say so rather than silently choosing.

No progress narration. No restating the request. No summarising work visible in the diff.

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

**Open item — iOS.** The stack lists Apple IAP, but every V1 frame is a 393 × 852dp Android frame. iOS layout, safe areas and App Store review specifics are unspecified. Confirm iOS scope before building for it.

---

## Final Reminder

Before every feature implementation:

- Read this file
- Follow it strictly
- Build clean, simple code
- Replicate UI exactly when designs are provided
- Treat placeholder content as data, never as constants
- Protect read/listen parity above all else

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
