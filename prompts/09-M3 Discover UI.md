Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @"/c:/Users/PC/Desktop/talebrim-app/material/3.png" — ensure everything is as is
shown. Build the UI against `data/seed-catalog.ts` only; prompt 11 swaps in the
real query without touching the layout.

1. Replace the Discover placeholder at `app/(tabs)/index.tsx`. Keep the tab bar
   and the mini-player slot from prompt 08 exactly as built — this prompt adds
   screen content and nothing else. Prompt 08 did not export a bottom-padding
   constant (the bar's height is insets-dependent, not a fixed number), but
   its custom `tabBar` render prop is still measured by React Navigation like
   any other: call `useBottomTabBarHeight()` (re-exported from
   `expo-router/tabs`) inside this screen and use it as the scroll content's
   bottom padding, so the last carousel is never hidden — and the padding
   updates live if the mini player mounts mid-session, since that measured
   height covers the mini player plus the bar together. Also change this
   screen's `Screen` `edges` prop from the default `["top", "bottom"]` to
   `["top"]` — the tab bar already carries its own bottom safe-area inset
   (prompt 08), so keeping `Screen`'s bottom edge here double-pads the
   bottom.
2. Header: wordmark on the left, search and notification icons on the right.
   AGENTS.md defines no wordmark or logo asset and the Image Generation Rules
   forbid creating one. Render the word `talebrim` in Fraunces 600 as a text
   wordmark, leave a `// MISSING ASSET: wordmark` comment, and list it in your
   summary. The material's header reads "NovelNow" — the product is talebrim;
   report that conflict, do not render it. The search icon pushes the `search`
   route (M8) built in prompt 12; until then it is a no-op with a TODO.
3. Tab strip below the header: Discover, New, Werewolf, Romance, Vampire,
   Fantasy. This is a FILTER, not navigation — it must not push a route or change
   the bottom tab. Selected state uses an ember underline — a new visual, not
   the existing `Chip`/`chip--selected` (blush-filled, used by M2/M8); either
   add an underline variant or build a small dedicated component for this
   strip, and note the choice in your summary. The underline is exempt from
   the one-ember-element rule. Note in a comment that this strip shows six
   entries while `data/genres.ts` holds eleven (Romance, Werewolf, Vampire,
   Fantasy, Billionaire, Possessive, Dark Romance, Mafia, Royalty, Shifter,
   Forbidden — expanded from AGENTS.md's original seven on prior user
   instruction) — most have no tab, and "New" is not a genre at all — and
   report it. Do not reconcile the two lists yourself.
4. Hero card: cover, title, metadata, and a "Read or Listen" action. The action
   is the single ember element on this screen; every other button is outline or
   text. Ember label in `ink #1A1420`, never white. The material shows a
   "#1 Trending" badge — there are no view counts and no reads table, so do not
   render an invented rank. Omit the badge, leave a `// NO BACKING METRIC`
   comment, and say so in your summary.
5. Three horizontal carousels, in order: Picked for You, Trending Now, New Audio
   Releases. Section headings in Fraunces 600 with an optional text-only "See
   all". Trending Now has no real metric — render it from seed data with the same
   `// NO BACKING METRIC` marker rather than inventing an ordering rule.
6. Cover cards: 12dp radius, title in Inter, and a teal `Badge` with a
   headphone icon on titles that have audio. Neither a `Cover` nor a `Badge`
   primitive exists yet — no prior prompt built one (prompt 02 is
   Supabase/Clerk client wiring only, no UI). Build both now as small
   components under `components/ui/` (`Cover`, `Badge`), following the
   existing primitives' pattern (`Button`, `Chip`) of composing `global.css`
   utilities rather than inline styles. Teal is the design token
   `--color-teal` (`#9FD8D0` in `global.css` / `theme/colors.ts` — the single
   source of truth; do not hardcode a different hex) and a reserved status
   colour; the audio badge is its one permitted decorative-adjacent use here —
   do not use teal anywhere else on this screen.
7. Every cover uses `expo-image` through `constants/images.ts`. `cover_path`
   in the seed data is a storage-style path (e.g. `covers/shadow-of-the-moon.jpg`),
   not a key into `constants/images.ts` — write the small lookup that maps
   known seed `cover_path` values to the matching `images.covers.*` entry.
   `constants/images.ts` currently has 4 local covers (`eternalEclipse`,
   `reignOfAshes`, `shadowOfTheMoon`, `whispersInTheMist`) — matching the 4
   images in `material/thumbnails/` — but `data/seed-catalog.ts` only has 3
   books and none of their `cover_path` strings currently match a real
   asset key; add a 4th seed book (or correct the existing 3) so all four
   local covers are reachable and every carousel has real variety. Note also
   that `constants/images.ts` has **no `coverPlaceholder` export yet** — it is
   explicitly listed there as still missing pending the admin CMS or a
   designer (AGENTS.md § Image Generation Rules forbids generating one). Until
   it exists, when `cover_path` is null or unmapped, render a plain flat
   `surface`-coloured box at the cover's aspect ratio (no icon, no generated
   art) with a `// MISSING ASSET: cover-placeholder` comment, and report this
   gap in your summary rather than substituting any other image. Never
   hotlink a third-party image URL, never fetch from Unsplash, Picsum,
   placehold.co or any remote placeholder service, and never generate
   artwork. Set `recyclingKey` on list images and be aware `recyclingKey`
   plus `transition` has known glitches (expo/expo#22516) — prefer
   `recyclingKey` and drop the transition if they conflict.
8. Format duration only through `formatDuration()` from prompt 04. Null
   `total_duration_seconds` means duration UNKNOWN and must render the unknown
   label — never `00:00`, never a hidden field, never a zero-length progress bar.
9. Virtualise every carousel with `FlatList` `horizontal`
   (https://reactnative.dev/docs/flatlist) — or FlashList if it is already a
   dependency, but do not add a new list library just for this. Set
   `keyExtractor`, `initialNumToRender` and `getItemLayout` since card widths are
   fixed. Do not render a carousel with `.map()` inside a `ScrollView`.
10. Cards push `book/[id]` (M4). Keep it a plain push with the id — no prefetch,
    no data passed through params beyond the id, since M4 fetches its own data in
    prompt 13.
11. Render the loading, empty and error states now, surface-matched on `bg`
    (`#150E1F`, this app's screen background token — `plum-deep` is not a
    token in this project): skeleton rows sized to the real cards, a written
    empty state per carousel, and an inline error with a retry. No
    spinner-in-the-middle-of-a-blank screen, no red toast, no `Alert.alert`.
12. Every interactive element gets an `accessibilityRole` and a label, and every
    touch target is at least 44dp even where the visual is smaller.

Do not: call Supabase, TanStack Query or any network in this prompt — seed data
only, and prompt 11 wires the real source; import from `data/seed-catalog.ts`
anywhere outside this screen; query `books` or `chapters` directly when prompt 11
arrives — `books_catalog` is the only reader-facing source; write to any table or
seed the catalogue, which is a blocker to report, not to fill; add a second ember
element; add a gradient, glow, blur or shadow; use raw hex outside `global.css`'s
`@theme` block (this project has no `tailwind.config.js` — Tailwind v4 +
NativeWind v5 are CSS-first, see AGENTS.md § NativeWind Rule); build M4, M8 or
the Library and Profile screens.

Finish by running `npx tsc --noEmit`, then paste the three reported conflicts
(wordmark asset missing, "NovelNow" vs talebrim, six tab-strip entries vs eleven
genres), confirm the omitted trending badge, confirm the cover-placeholder gap
and which seed book was added/changed to exercise all 4 local covers, and
confirm scrolling stays smooth with the seed set at 60fps — on a physical
device if one is available in this workflow, otherwise report the best
available substitute (simulator or web) and say so explicitly rather than
silently skipping the check.
