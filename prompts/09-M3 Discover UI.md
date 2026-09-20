Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/05-discover.png — ensure everything is as is
shown. Build the UI against `data/seed-catalog.ts` only; prompt 11 swaps in the
real query without touching the layout.

1. Replace the Discover placeholder at `app/(tabs)/index.tsx`. Keep the tab bar
   and the mini-player slot from prompt 09 exactly as built — this prompt adds
   screen content and nothing else. Bottom padding must use the measured value
   from prompt 09 so the last carousel is never hidden behind the mini player.
2. Header: wordmark on the left, search and notification icons on the right.
   AGENTS.md defines no wordmark or logo asset and the Image Generation Rules
   forbid creating one. Render the word `talebrim` in Fraunces 600 as a text
   wordmark, leave a `// MISSING ASSET: wordmark` comment, and list it in your
   summary. The material's header reads "NovelNow" — the product is talebrim;
   report that conflict, do not render it. The search icon pushes the `search`
   route (M8) built in prompt 12; until then it is a no-op with a TODO.
3. Tab strip below the header: Discover, New, Werewolf, Romance, Vampire,
   Fantasy. This is a FILTER, not navigation — it must not push a route or change
   the bottom tab. Selected state uses an ember underline, which is exempt from
   the one-ember-element rule. Note in a comment that this strip shows six
   entries while `data/genres.ts` holds seven — Possessive, Billionaire and Dark
   are absent and "New" is not a genre at all — and report it. Do not reconcile
   the two lists yourself.
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
6. Cover cards: 12dp radius via the prompt-02 `Cover` primitive, title in Inter,
   and a teal `Badge` with a headphone icon on titles that have audio. Teal
   `#2F8C7F` is a reserved status colour and the audio badge is its one permitted
   decorative-adjacent use here — do not use teal anywhere else on this screen.
7. Every cover uses `expo-image` through `constants/images.ts`. When
   `cover_path` is null, render the local `cover-placeholder.png` — that is a
   valid state, not an error. Never hotlink a third-party image URL, never fetch
   from Unsplash, Picsum, placehold.co or any remote placeholder service, and
   never generate artwork. Set `recyclingKey` on list images and be aware
   `recyclingKey` plus `transition` has known glitches
   (expo/expo#22516) — prefer `recyclingKey` and drop the transition if they
   conflict.
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
11. Render the loading, empty and error states now, surface-matched on
    `plum-deep`: skeleton rows sized to the real cards, a written empty state per
    carousel, and an inline error with a retry. No spinner-in-the-middle-of-a-blank
    screen, no red toast, no `Alert.alert`.
12. Every interactive element gets an `accessibilityRole` and a label, and every
    touch target is at least 44dp even where the visual is smaller.

Do not: call Supabase, TanStack Query or any network in this prompt — seed data
only, and prompt 11 wires the real source; import from `data/seed-catalog.ts`
anywhere outside this screen; query `books` or `chapters` directly when prompt 11
arrives — `books_catalog` is the only reader-facing source; write to any table or
seed the catalogue, which is a blocker to report, not to fill; add a second ember
element; add a gradient, glow, blur or shadow; use raw hex outside
`tailwind.config.js`; build M4, M8 or the Library and Profile screens.

Finish by running `npx tsc --noEmit`, then paste the three reported conflicts
(wordmark asset missing, "NovelNow" vs talebrim, six tab-strip entries vs seven
genres), confirm the omitted trending badge, and confirm scrolling stays smooth
with the seed set at 60fps on a physical device.
