Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/04-nav-shell.png — ensure everything is as is
shown. Build the shell in isolation with placeholder screens. Do NOT build any
real screen UI in this prompt.

1. Create the tab group `app/(tabs)/_layout.tsx` using Expo Router's JavaScript
   tabs (https://docs.expo.dev/router/advanced/tabs/), nested under the protected
   branch of the prompt-08 gate so the tabs never mount for a signed-out user.
2. Exactly three tabs, in this order: Discover, Library, Profile. No centre
   action button, no floating action button, no fourth tab, no decorative or
   spring animation on the bar. Icons come from the icon set AGENTS.md specifies —
   confirm which set is installed before adding one; do not introduce a second
   icon library.
3. Tab colours from the prompt-02 tokens, never raw hex here: active `ember`
   `#E8663F`, inactive `muted-light` `#A79BB5`, bar surface `plum-raised`
   `#2C1E42`. Remove the default hairline border if it does not match the
   material. The active tab state does NOT count against the one-ember-element
   rule — nav active state, progress bars and active-tab underlines are exempt.
4. Respect the bottom safe-area inset on the bar
   (https://reactnavigation.org/docs/handling-safe-area/). Do not hardcode a bar
   height for a notched device; read the inset.
5. Build the mini player as a component at `components/player/MiniPlayer.tsx`,
   56dp tall, sitting directly ABOVE the tab bar — rendered in the tab layout, not
   inside each screen, so it does not unmount and remount on tab change. Its
   vertical offset must be computed from the tab bar height plus the safe-area
   inset, not a magic number.
6. Mini-player visibility is per route and must be data-driven from one exported
   map, not scattered conditionals. Present on M3, M7 and M11. Absent on M5 and
   M6 — the reader and the full player own the screen. Absent entirely on M1 and
   M2, which sit outside the tab group and therefore have no nav and no mini
   player by construction.
7. When no track has ever been loaded, the mini player renders nothing and
   occupies zero height — do not reserve an empty 56dp strip and do not show a
   placeholder track. Every screen's bottom padding must derive from the same
   measured value so content is never hidden behind it when it appears mid-session.
8. The mini player is a static shell in this prompt: cover thumbnail from the
   local `cover-placeholder.png`, title, a play/pause control that only toggles
   local state, and a tap target opening M6 later. Read `playback` from the
   prompt-08 Zustand slice. No audio, no `react-native-track-player`, no progress
   bar wired to real time. Mark it `// SHELL — wired in prompt 19/20`.
9. Placeholder screens at `app/(tabs)/index.tsx` (Discover),
   `app/(tabs)/library.tsx` and `app/(tabs)/profile.tsx`: each a `Screen` on
   `plum-deep` `#150E1F` with just its name. Using the real background prevents a
   white flash before the actual screens land. Explicitly defer all Discover UI —
   prompt 10 owns it.
10. Add the non-tab routes as stack screens outside the tab group so they cover
    the bar when pushed: `book/[id]` (M4), `reader/[chapterId]` (M5),
    `player/[chapterId]` (M6), `chapters/[bookId]` (M9), `search` (M8). Placeholder
    bodies only. M5 and M6 must present with no tab bar and no mini player.
11. Delete the temporary links from `app/index.tsx` now that real routing exists,
    but keep the `__DEV__` clear-storage button from prompt 08 and the `theme` and
    `health` routes. State which scaffolding you removed.
12. Verify every tab preserves its own navigation stack when you switch away and
    back, and that the Android hardware back button behaves sanely from a pushed
    screen and from a tab root.

Do not: build the Discover header, tab strip, hero card or any carousel; build
Library, Profile, the reader or the player UI; install
`react-native-track-player`, RevenueCat or an ads SDK; play audio; fetch from
Supabase in this prompt; add a gradient anywhere — the single permitted gradient
belongs to M6 in prompt 18; add a blur, glow or shadow to the bar; hardcode hex
values outside `tailwind.config.js`; use a remote image.

Finish by running `npx tsc --noEmit`, then paste the route→mini-player visibility
map from step 6, the measured tab bar height plus inset from steps 4 and 5, and
confirm on both platforms that M5 and M6 show neither the bar nor the mini
player while M3, M7 and M11 show both.
