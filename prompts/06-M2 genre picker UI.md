# 07 — M2 genre picker UI

Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @"/c:/Users/PC/Desktop/talebrim-app/material/2.png" — ensure everything is as is
shown. Selection is local to this screen; prompt 08 makes it persist.

1. Build M2 at `app/(auth)/genres.tsx` inside the same `(auth)` group,
   `headerShown: false`. Structure mirrors M1: top-third collage, headline, body,
   then actions. No bottom tab bar, no mini player.
2. Collage from `onboarding-collage.png` via `constants/images.ts` with
   `expo-image`. Same rule as M1: never generate, download or hotlink it. If
   absent, render a `bg-plum-raised` block of the right height with a
   `// MISSING ASSET` comment and list it in your summary.
3. Headline "What you love to read" — use the exact string from AGENTS.md; if the
   material's wording differs, render the AGENTS.md string and report the
   difference. Fraunces 600, with an Inter body line beneath it.
4. Chip grid, multi-select, from `data/genres.ts` only — do not hardcode the list
   in this file. AGENTS.md defines seven: Romance, Werewolf, Vampire, Fantasy,
   Possessive, Billionaire, Dark. The design material shows eleven chips and the
   copy "Pick 3 or more"; AGENTS.md states no minimum and no maximum. Render the
   seven from the data file, do not enforce a count, and report both mismatches.
   Do not invent the four extra genres — a chip with no matching value in the
   `genres` text[] column returns an empty catalogue.
5. Chip states via the prompt-02 `Chip` primitive: unselected is outlined on the
   plum surface, selected is `bg-blush` with a label in `ink #1A1420` — not
   white and not `muted`. Blush `#E9A8C0` is too light to carry white text at
   4.5:1 (https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html), so
   the dark label is a requirement, not a preference. Chips stay blush and never
   become ember, because the single ember element on this screen is the primary
   button. The chip's outline must clear 3:1 against its background
   (https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html).
6. Every chip is a `Pressable` with `accessibilityRole="button"`,
   `accessibilityState={{ selected }}` and a label, so selection is announced
   rather than implied by colour alone
   (https://reactnative.dev/docs/accessibility). Minimum 44dp touch target even
   though the chip's visual height may be smaller.
7. Actions: an ember "Start Reading" pill with an `ink` label, and a `muted`
   text-only "Skip" below it. Skip is a real path — it must lead onward with an
   empty selection, not be disabled. Keep "Start Reading" enabled at zero
   selections unless I tell you otherwise, since AGENTS.md sets no minimum.
8. Step indicator at the top. The material shows three dots on the second
   position, which implies a third onboarding step that the screen inventory does
   not define. Render three dots exactly as shown, hardcode the current index, add
   a `// UNDEFINED STEP 3` comment, and raise it in your summary. Do not invent a
   third screen.
9. Hold selections in local component state only and log them on submit. No
   AsyncStorage, no Zustand, no Supabase write. AGENTS.md has no profile table
   until Phase 2, so these choices are local-only for now and prompt 08 persists
   them to AsyncStorage. Note in a comment that this screen must never re-show
   once completed, and that the completion flag gating the route arrives in
   prompt 08.
10. On submit, call the same routing function from prompt 05 step 9 to reach M3.
    Keep the temporary link from `app/index.tsx` to this screen. Mark both as
    scaffolding for prompt 09.

Do not: write to any table, or create a `profiles` row — no such table exists;
persist anything to AsyncStorage or Zustand in this prompt; add a search field, a
"see all genres" button, a category count badge, or chip reordering; use ember,
teal, gold or danger on a chip; add a second ember element to the screen; build
M3, a tab bar or a mini player; add a gradient, glow or shadow; fetch or create
imagery.

Finish by running `npx tsc --noEmit`, then paste the chip list you rendered, the
selected/unselected contrast ratios you measured for step 5, and the three
reported mismatches: chip count (7 vs 11), the "Pick 3 or more" copy against no
stated minimum, and the undefined third onboarding step.
