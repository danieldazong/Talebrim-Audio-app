Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material:
@"/c:/Users/PC/Desktop/talebrim-app/material/3.png" — ensure everything is as is
shown. Build the shell in isolation with placeholder screens. Do NOT build any
real screen UI in this prompt.

1. Create the tab group `app/(tabs)/_layout.tsx` using Expo Router's JavaScript
   tabs (https://docs.expo.dev/router/advanced/tabs/), nested under the existing
   three-way `Stack.Protected` gate in `app/_layout.tsx` (built in prompt 07) so
   the tabs never mount for a signed-out or not-yet-onboarded user. Concretely:
   replace the placeholder `<Stack.Screen name="health" />` in the
   `isSignedIn && hasCompletedOnboarding` branch with
   `<Stack.Screen name="(tabs)" />`. `health` stays registered as a reachable
   route (see step 11) but stops being the post-onboarding landing screen.
   Also update `POST_ONBOARDING_ROUTE` in `lib/auth-routing.ts` from `/health`
   to the tab group's root so a first-time user lands on Discover, not the
   health probe, right after completing M2.
2. Exactly three tabs, in this order: Discover, Library, Profile. No centre
   action button, no floating action button, no fourth tab, no decorative or
   spring animation on the bar. Icons come from `@expo/vector-icons` (already
   installed — confirm in `package.json` before adding anything) using the
   icon set the design material actually shows (Ionicons outline glyphs for
   compass/book/person, or the nearest equivalent already used elsewhere in
   this app); do not introduce a second icon library.
3. Tab colours from the real design tokens in `src/global.css`'s `@theme`
   block (mirrored in `src/theme/colors.ts`), never raw hex here: active
   `ember` `#E8663F`, inactive `muted` `#A79BB5`, bar surface `raised`
   `#2C1E42`. There is no `tailwind.config.js` in this project — Tailwind v4 +
   NativeWind v5 are CSS-first and `global.css`'s `@theme` block IS the token
   source (see the note at the top of that file); use the `nav` / `nav__item`
   / `nav__item--active` utilities already defined there rather than inventing
   new ones. Remove the default hairline border if it does not match the
   material. The design shows the active tab as an ember-filled circle behind
   the icon (matching `nav__item--active`), not an underline — underlines are
   a different component used elsewhere (e.g. M3's genre tab strip) and do not
   apply here. This active-fill state does NOT count against the
   one-ember-element-per-screen rule — nav active state, progress bars and
   active-tab underlines are all exempt.
4. Respect the bottom safe-area inset on the bar
   (https://reactnavigation.org/docs/handling-safe-area/). Do not hardcode a bar
   height for a notched device; read the inset.
5. Build the mini player as a component at `components/player/MiniPlayer.tsx`,
   56dp tall (`layout.miniPlayerHeight` / `h-14`), sitting directly ABOVE the
   tab bar — rendered in the tab layout, not inside each screen, so it does not
   unmount and remount on tab change. Its vertical offset must be computed from
   the tab bar height plus the safe-area inset, not a magic number.
6. Mini-player visibility is per route and must be data-driven from one exported
   map, not scattered conditionals. Present on M3, M7 and M11. Absent on M5 and
   M6 — the reader and the full player own the screen. Absent entirely on M1 and
   M2, which sit outside the tab group and therefore have no nav and no mini
   player by construction.
7. When no track has ever been loaded, the mini player renders nothing and
   occupies zero height — do not reserve an empty 56dp strip and do not show a
   placeholder track. Every screen's bottom padding must derive from the same
   measured value so content is never hidden behind it when it appears mid-session.
8. The mini player is a static shell in this prompt: cover thumbnail, title, a
   play/pause control that only toggles local state, and a tap target opening
   M6 later. `constants/images.ts` does not have a `cover-placeholder` entry
   yet (it is explicitly listed there as still missing, pending the admin CMS
   or a designer per AGENTS.md § Image Generation Rules) — do NOT block on
   that. Use `images.covers.eternalEclipse` (from `constants/images.ts`,
   already wired to `assets/Image/covers/eternal-eclipse.jpg`) as the
   thumbnail for this shell instead, since the mini player exists only to
   show a track is "loaded," not to render real per-book data yet; the other
   four covers already imported there
   (`reignOfAshes`, `shadowOfTheMoon`, `whispersInTheMist`) and
   `images.onboardingBanner` (`Onboarding-banner.png`) are not needed by this
   prompt — they belong to Discover carousels and M1/M2, owned by later
   prompts — so do not wire them here. Leave a comment noting the thumbnail
   should swap to `images.coverPlaceholder` (for a track with no cover) once
   that asset exists, and to the real per-book cover once chapter/book data is
   wired in prompt 19/20. Note the real image directory on disk is
   `assets/Image/` (capital I, singular — see `constants/images.ts`), not
   `assets/images/`. Read and write playback state through the EXISTING
   `usePlaybackStore` in `src/store/playback-store.ts` (built in prompt 07) —
   do not create a new slice. No audio, no `react-native-track-player`, no
   progress bar wired to real time. Mark the shell parts
   `// SHELL — wired in prompt 19/20`.
9. Placeholder screens at `app/(tabs)/index.tsx` (Discover),
   `app/(tabs)/library.tsx` and `app/(tabs)/profile.tsx`: each a `Screen` on
   `bg` `#150E1F` (via `className="bg-bg"`, not a raw hex) with just its name.
   Using the real background prevents a white flash before the actual screens
   land. Explicitly defer all Discover UI — prompt 10 owns it.
10. Add the non-tab routes as stack screens outside the tab group so they cover
    the bar when pushed: `book/[id]` (M4), `reader/[chapterId]` (M5),
    `player/[chapterId]` (M6), `chapters/[bookId]` (M9), `search` (M8). Placeholder
    bodies only. M5 and M6 must present with no tab bar and no mini player.
11. Delete the temporary links from `app/index.tsx` now that real routing exists,
    but keep the `__DEV__` clear-storage button from prompt 07 and the `theme`
    and `health` routes reachable (they no longer need to be reachable from
    `app/index.tsx`'s link list, but do not delete the route files themselves).
    State which scaffolding you removed.
12. Verify every tab preserves its own navigation stack when you switch away and
    back, and that the Android hardware back button behaves sanely from a pushed
    screen and from a tab root.

Do not: build the Discover header, tab strip, hero card or any carousel; build
Library, Profile, the reader or the player UI; install
`react-native-track-player`, RevenueCat or an ads SDK; play audio; fetch from
Supabase in this prompt; add a gradient anywhere — the single permitted gradient
belongs to M6 in prompt 18; add a blur, glow or shadow to the bar; hardcode hex
values outside `src/global.css`'s `@theme` block; use a remote image.

Finish by running `npx tsc --noEmit`, then paste the route→mini-player visibility
map from step 6, the measured tab bar height plus inset from steps 4 and 5, and
confirm on both platforms that M5 and M6 show neither the bar nor the mini
player while M3, M7 and M11 show both.
