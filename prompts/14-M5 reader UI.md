Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @"/c:/Users/PC/Desktop/talebrim-app/material/7.png" — build
it exactly as shown, except where a step below says otherwise. Every size
below is measured from that frame (393dp wide) and is binding. Build the
reading surface against mock text; prompt 15 fetches real `script_text` and
the parity prompt adds parity persistence.

Prompt 15 wires this screen to real data and may not change any visual
detail or string. So everything visible — every state in step 18 included —
is designed here, with its final copy.

Revised 2026-09-23 after the first build was reviewed on screen: the
position label moved from a floating capsule into the toolbar (steps 9–10),
the selected segment got a visible fill (step 11), a tap on the page toggles
the toolbar (step 13), and the Atkinson Hyperlegible switch works now that
the font is bundled (steps 3, 4 and 11).

1. Replace the `reader/[chapterId]` placeholder from prompt 08. It receives
   only the chapter id from the route param; pass no data through params.
   - Validate the id with `isUuid()` (`lib/ids.ts`, prompt 12). A malformed
     id renders the "not available" state from step 18 and nothing else.
   - M5 shows NO bottom tab bar and NO mini player (AGENTS.md M5). It is a
     stack route outside `(tabs)`, so neither mounts. Verify that during the
     push transition too, not just after it settles.
   - Back uses the same fallback as M4 and M8: `router.back()` when
     `router.canGoBack()`, otherwise `router.replace("/")`. A deep link has
     no back stack.
2. Mock data lives in `data/mock-chapter.ts`, typed, imported only by the
   reader route and marked `// MOCK — prompt 15 fetches real script_text`.
   AGENTS.md forbids prose inside components. Prompt 15 deletes the file. It
   holds:
   - `bookTitle`, `chapterNumber`, `chapterTitle` and `chapterCount`, which
     the top bar, the heading and the position label need.
   - `scriptText`: a realistically long body, several thousand words, so
     scrolling, memory and the toolbar are tested against something honest
     rather than two paragraphs. Use exactly the three marks AGENTS.md
     permits — `**bold**`, `_italic_`, `## heading` — each at least once. End
     it with one short paragraph of unsupported syntax (a `### heading`, a
     `[link](url)`, a lone `**`, a `snake_case` word), commented as the
     renderer check for step 5.
   - `status`: which state the screen shows. `"ready"` by default; the other
     values are step 18's states. Changing this one field is how each state
     is viewed until prompt 15 derives it from the query.
3. Type roles. Never mix them:
   - Body text is Literata, 18sp with 1.7 line-height by DEFAULT, or
     Atkinson Hyperlegible when the reader turns it on (step 11). Size and
     line height come from the `reader` slice (`fontSize`, `lineSpacing`) as
     an inline style — the dynamic-style exception — with
     `lineHeight = fontSize × lineSpacing`. This is the only place Literata
     and Atkinson Hyperlegible are used in the app.
   - The chapter title and in-text `## ` headings are Fraunces 600.
   - All chrome — top bar labels, `Aa`, toolbar, position label, states and
     the settings sheet — is Inter.
4. Bold and italic switch the font FILE, never the weight or style.
   `**bold**` uses `font-body-emphasis` (Literata SemiBold) and `_italic_`
   uses `font-body-italic` (Literata Italic). Setting `fontWeight` or
   `fontStyle` on Literata Regular makes the platform fake it or fall back to
   the system font. Bold inside italic renders as SemiBold: there is no
   SemiBold Italic file. Atkinson Hyperlegible (the original family, not
   "Next") has Regular, Italic, Bold and Bold Italic files, the
   `font-reader-accessible*` tokens, so bold inside italic gets its own file
   there. The face classes live in `components/reader/reader-theme.ts`.
5. Write a small renderer for exactly those three marks. Do not add
   `react-native-markdown-display` or any other Markdown library: it renders
   far more than three marks, and every extra rule is one more thing to
   switch off.
   - It splits the text into paragraphs on blank lines and keeps each
     paragraph's starting CHARACTER offset in the source string. Step 14
     depends on it.
   - A heading is a paragraph that starts with exactly `## ` (two hashes and
     a space).
   - Anything else renders as its literal characters: a `### heading` keeps
     its hashes, a lone `**` shows as two asterisks, and underscores inside a
     word (`snake_case`) are not italic. Never drop text, never crash, and
     never show a parser artefact such as `undefined` or `[object Object]`.
6. Three themes — exactly the `ReaderTheme` values in
   `store/reader-store.ts`, read from and written to the persisted `reader`
   slice. Tokens only, no raw hex:

   | | `light` (DEFAULT) | `sepia` | `dark` |
   | --- | --- | --- | --- |
   | Page, top bar, safe areas | `reader-light` | `reader-sepia` | `bg` |
   | Body text, back, top-bar `Aa` | `ink` | `ink` | `body` |
   | Fraunces text (chapter title, `## ` headings, top-bar "Chapter N") | `ink` | `ink` | `champagne` |
   | Secondary text (book-title label, "CHAPTER N" label, state captions) | `ink/65` | `ink/65` | `muted` |
   | Top-bar hairline, skeleton lines | `ink/10` | `ink/10` | `raised` |
   | Status-bar icons | dark | dark | light |

   - The frame's secondary labels are a tan (`#958675`) that is not a token
     and fails AA at their size. `muted` fails too: 2.46:1 on `reader-light`
     and 2.11:1 on `reader-sepia`. `ink/65` measures 5.48:1 and 5.13:1 and
     matches the frame's book-title grey. Report the change.
   - Measure and report body AND secondary-text contrast in all three
     themes. Both must clear 4.5:1.
   - `app/_layout.tsx` sets light status-bar icons app-wide, which vanish on
     a light page. This screen renders `expo-status-bar`'s `StatusBar` with
     the style above, so the app's style returns when the screen leaves.
   - `Screen` paints its safe areas `bg`. Give it an optional background
     colour (`theme/colors.ts` holds the reader colours for props that take
     no className), so plum never shows above the top bar or below the page.
   - The toolbar and the settings sheet are `raised` in every theme (steps 9
     and 11).
7. Top bar — fixed; it does not scroll or hide.
   - 64dp tall below the top safe-area inset, page-coloured, with a 1dp
     hairline along its bottom edge.
   - Left: back, `chevron-back` at 24, a 44dp target 16dp from the screen
     edge.
   - Right: `Aa` as text, Inter SemiBold 16sp, a 44dp target 16dp from the
     edge. It opens the same settings sheet as the toolbar's `Aa` (step 11).
   - Centre, two lines: the book title in UPPERCASE, Inter Medium 13sp,
     letter-spacing 0.5, secondary colour, one line with an ellipsis; below
     it "Chapter {n}" in Fraunces 600 15sp. Neither may run under the side
     controls.
8. Reading column — a plain `ScrollView`, not `FlatList` (step 14 needs every
   paragraph laid out), with 24dp side padding.
   - 20dp below the hairline: "CHAPTER {n}" with the number in DIGITS, Inter
     Medium 14sp, UPPERCASE, letter-spacing 0.5, secondary colour. The frame
     spells it out ("CHAPTER TWELVE"); digits need no number-to-words helper
     and stay short at chapter 148. Report the change.
   - 4dp below: the chapter title, Fraunces 600 28sp, line-height 34,
     wrapping. Omit the line when the title is null.
   - 32dp below: the body. Paragraph spacing is 20dp at the default 18sp;
     scale it with the font size (1.1 × `fontSize`) so the rhythm holds.
   - After the last paragraph: the end-of-chapter controls (step 12), then
     the bottom padding from step 10.
9. Floating toolbar — 56dp tall, fully rounded, flat (no shadow), 16dp from
   each side and 20dp above the bottom safe-area edge.
   - Fill it `raised`: AGENTS.md makes toolbars `raised`. The frame fills
     the toolbar `surface` and its Listen pill `raised`; AGENTS.md wins for
     tokens. Report the conflict.
   - 12dp padding inside each end. Left: brightness (`sunny-outline` at 22,
     `muted`), then `Aa` (Inter SemiBold 15sp, `muted`) beside it. Each is a
     44dp target.
   - The frame's bookmark sits third. It is NOT rendered: a manual bookmark
     needs a table that does not exist. Mark it
     `// UNBACKED — bookmark needs a bookmarks table` and report it. Its slot
     holds the position label (step 10), centred between `Aa` and Listen.
   - Right: Listen, the `Button` `audio` variant (`btn--audio`, added in
     prompt 12) with the `headset` icon, 16dp horizontal padding — teal
     outline and teal label on `raised` (9.63:1). It is NOT ember.
   - The frame spaces four items (brightness 40dp in, `Aa` 77dp to its right,
     Listen 20dp from the right edge). With the bookmark gone that spacing
     left a lopsided gap, so the toolbar is rebalanced as above.
   - The reader has no ember button. Its only ember element is the progress
     bar, and every other toolbar control is `muted` or outline.
10. Position label, progress bar and bottom padding.
    - The frame's label row floats bare over the body text — the known
      overlap defect. A floating capsule was tried and still read as clutter,
      with words showing on either side of it. The label sits INSIDE the
      toolbar instead, in the bookmark's slot: Inter Medium 12sp, `muted`,
      one line, shrinking slightly rather than truncating. It hides and
      returns with the toolbar and never sits over text.
    - It reads "{n} of {chapterCount} · {x}%", where x is progress through
      THIS chapter; the top bar already says "Chapter {n}". Its accessibility
      label spells it out: "Chapter {n} of {chapterCount}, {x} percent read".
      The frame's "Page 4 of 18" is dropped, because a scrolling reader has
      no pages. Its "22% of book" is dropped, because it needs every
      chapter's length, which nothing provides. Report both.
    - Progress bar: 3dp tall, full width, flush with the bottom edge of the
      screen, ember fill, no visible track. It is always visible and does not
      hide with the toolbar. Progress bars are exempt from the one-ember rule.
    - Give the scroll content bottom padding equal to the toolbar, its 20dp
      gap, 16dp of clearance and the bottom safe-area inset, so neither the
      last line nor the end-of-chapter controls are ever covered. Report the
      value.
11. Toolbar controls:
    - Brightness (sun): cycles the theme light → sepia → dark. There is no
      screen-brightness control and no `expo-brightness`; the theme is what
      covers night reading. Keep the frame's icon and report that its meaning
      changed.
    - `Aa` (toolbar and top bar): opens the reading settings sheet, a React
      Native `Modal` (transparent, sliding up). Not `@expo/ui`, whose native
      look cannot take these tokens, and never an `Alert`. The M5a paywall can
      reuse the pattern later.
      - Scrim `bg/60`. Tapping it closes the sheet, as do Android back
        (`onRequestClose`) and a "Done" text button in the sheet's top-right
        corner.
      - Sheet: `raised`, 16dp top corners, 24dp padding plus the bottom
        safe-area inset. Title "Reading settings", Fraunces 600 20sp,
        `champagne`.
      - Rows, 56dp each, label Inter 15sp `body` on the left:
        - "Text size": round A− and A+ buttons (44dp) around the current size,
          in 2sp steps within the slice's 14–28sp. Each disables at its end.
        - "Theme": `SegmentedControl` — Light / Sepia / Dark.
        - "Line spacing": `SegmentedControl` — Compact (1.5) / Default (1.7) /
          Relaxed (2.0).
        - "Atkinson Hyperlegible": a working `Switch` bound to the slice's
          `atkinsonEnabled`, with a `muted` caption "Designed for low-vision
          readers". On: body text, bold and italic switch to Atkinson
          Hyperlegible; headings stay Fraunces and chrome stays Inter. Teal
          track when on. The paragraph at the top stays there (step 14).
      - Build `SegmentedControl` in `components/ui/`; AGENTS.md expects it
        there and M7 will reuse it. `bg` track; the SELECTED option is filled
        `muted/25` with a `body` label, the others have a `muted` label; 44dp
        tall, fully rounded. A `surface` fill was tried first and measured
        about 1.1:1 against the track, which made the choice unreadable. It
        always opens on the current value — a wrongly filled segment is a
        known defect in the frames.
    - Listen: a no-op marked `// TODO(handoff)`. Do not push `player/[id]`
      yet: the handoff must carry a position in both directions, and nothing
      writes `reading_positions` until the parity prompt. A handoff that
      loses the reader's place is worse than no handoff.
12. End-of-chapter controls, centred in the reading column 48dp below the
    last paragraph: an outlined "Next chapter" pill (48dp tall, full column
    width), then a "Previous chapter" text link (44dp target) 8dp below it.
    - Draw both from the ACTIVE theme: label in the theme's text colour, 1dp
      border at `ink/20` on light and sepia, `muted/40` on dark. Do not use
      `Button`: its `outlined` variant has a `body` label, which is invisible
      on `reader-light`.
    - Hide Previous on chapter 1 and Next on the last chapter; the mock's
      `chapterCount` decides. Both are no-ops marked `// Wired in prompt 15`.
    - Chapter navigation is NOT in the toolbar; the frame has none there.
13. Auto-hide: the toolbar slides down out of view on scroll down, and
    returns on scroll up, at the top of the chapter and at its end. A tap on
    the reading surface toggles it, as in Apple Books and Kindle.
    - Use Reanimated (installed, not yet used) with
      `useAnimatedScrollHandler`, so the direction check runs on the UI
      thread. On the JavaScript thread it is the 60fps risk this screen is
      tested for. This is the `Animated.View / Reanimated` exception in the
      AGENTS.md style table.
    - 200ms timing, no spring. With the system's reduce-motion setting on
      (`useReducedMotion`), show and hide without animating.
    - While a screen reader is on (`AccessibilityInfo`), the toolbar never
      hides. That is how it stays reachable when it cannot be seen.
14. Reading position is a CHARACTER offset, never pixels. Using step 5's
    paragraphs, record each paragraph's starting offset and its `onLayout` y.
    - When the scroll settles (150ms without movement), the paragraph at the
      top of the viewport gives the offset — whatever moved the page: a
      drag, a fling, a mouse wheel or a screen reader's scroll action.
      Scroll-end events are not enough: React Native sends Android momentum
      events only to a JavaScript `onMomentumScroll*` prop, which the
      UI-thread handler is not, and a wheel or a screen reader sends no drag
      events at all (found on 2026-09-23: the label stuck at 0%). Write
      `{ chapterId, textOffset, lastWrittenBy: "text", updatedAt }` to the
      `parity` store, session-only, not persisted to disk. Keep `audioMs` as
      the store already holds it for this chapter, or 0.
    - On remount within the session, scroll to the paragraph that contains
      the stored offset (https://reactnative.dev/docs/scrollview).
    - When the font, font size or line spacing changes, keep that same
      paragraph at the top once the new layout has settled. This is what a pixel offset
      cannot do, and it is what the audio handoff will map from.
    - The position label's percentage updates when the scroll settles; the progress bar
      follows the scroll on the UI thread. Neither re-renders the chapter on
      every scroll event.
    - Do not write to `reading_positions`, even though the table exists.
    - `store/parity-store.ts` says `reading_positions` "does not exist yet".
      It exists; only its writer is missing. Correct that note and keep the
      `// SERVER COPY — added by the parity prompt` marker.
15. Font scaling: body text scales with the system setting, capped with
    `maxFontSizeMultiplier` (https://reactnative.dev/docs/text) so the
    largest accessibility size does not break the layout. Chrome uses 1.3,
    as the rest of the app does. State the body cap you chose. Never disable
    scaling on body text.
16. Keep the screen awake while reading with `expo-keep-awake`'s
    `useKeepAwake` hook
    (https://docs.expo.dev/versions/latest/sdk/keep-awake/), approved on
    2026-09-23 (AGENTS.md § Tech Stack). Install it with
    `npx expo install expo-keep-awake`. Scope it to this screen so it
    releases on unmount; never app-wide.
17. `accessibilityRole` and a label on every control: back, both `Aa`,
    brightness (saying which theme it switches to), Listen, every control in
    the settings sheet, and the end-of-chapter navigation. 44dp minimum
    touch targets.
18. States. Prompt 15 wires these to the query and may not change them, so
    design all of them here, with this exact copy.
    - Each renders inside the reader shell — the top bar with back and `Aa`,
      its title lines only when their values exist — on the ACTIVE theme's
      page colour. A light-theme error must never render on plum.
    - Layout: a centred icon (32, secondary colour), a message in Inter 16sp
      in the theme's text colour, a caption in Inter 14sp in the secondary
      colour. Buttons use step 12's theme-aware pill.
    - No spinner, no `Alert.alert`, no toast.

    | State | Icon | Message | Caption | Control |
    | --- | --- | --- | --- | --- |
    | Loading | none | — | — | — |
    | Failed | `alert-circle-outline` | "We couldn't load this chapter." | "Check your connection and try again." | "Retry" |
    | Offline, nothing saved | `cloud-offline-outline` | "You're offline." | "This chapter isn't saved on this device yet. It will open when you reconnect." | none — queries resume on their own |
    | Not available | `book-outline` | "This chapter isn't available." | "It may have been taken down, or the link is out of date." | "Go back" |
    | No text (audio-only) | `headset-outline` | "This chapter has no text yet." | "You can listen to it instead." | none — the toolbar's Listen |
    | Locked | `lock-closed-outline` | "Chapter {n} is locked." | none | none — `// TODO(paywall)` where the paywall sheet opens (AGENTS.md M5a) |

    - Loading is a text-shaped skeleton: a short label bar, a title bar,
      then about 12 bars of varying width at the body line height, in the
      skeleton colour. Never a centred spinner.
    - The toolbar shows only in the ready and no-text states. The position
      label and the progress bar show only in ready.

Do not:
- fetch anything. No Supabase and no TanStack Query in this prompt.
- write to `reading_positions`, `unlocks` or `library_items`.
- check entitlement, render a paywall, or gate a locked chapter. The locked
  state is a design only; the paywall prompt owns the logic, and this screen
  assumes the chapter is readable.
- build the age gate. AGENTS.md records it as open before M5 ships; it gets
  its own prompt.
- play audio or install `react-native-track-player`.
- add text selection, highlighting, bookmarks, notes, translation or
  dictionary lookup.
- add a Markdown library, a brightness library, `@expo/ui` components, or any
  library other than `expo-keep-awake`. Reanimated is already installed.
- store a pixel scroll offset as the reading position.
- add an ember button.
- add a gradient, glow, blur or shadow. The gradients AGENTS.md permits are
  not on this screen.
- use raw hex outside `global.css`'s `@theme` block (`theme/colors.ts` only
  for props that take no className).
- build M6 or M9.

Finish by running `npm run typecheck` and `npm run lint`. Then:
- paste the body and secondary-text contrast ratios for all three themes
  (step 6)
- paste the scroll bottom padding (step 10) and the body
  `maxFontSizeMultiplier` (step 15)
- confirm that changing the font size keeps the same paragraph at the top
  (step 14)
- confirm every state in step 18 renders by switching the mock's `status`,
  in all three themes
- confirm the renderer-check paragraph shows its unsupported syntax as
  literal text (step 5)
- list every frame element you omitted or changed, with the reason: the
  bookmark, the brightness icon's meaning, "Page 4 of 18", "22% of book",
  the position label's move into the toolbar, the toolbar's spacing,
  "CHAPTER TWELVE" in digits, and the toolbar and label colours
- confirm on a physical device that a several-thousand-word chapter scrolls
  at 60fps, that no line is ever hidden behind the toolbar, and that the
  status-bar icons are visible in all three themes
