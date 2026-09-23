Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @"/c:/Users/PC/Desktop/talebrim-app/material/7.png" — ensure everything is as is
shown, except where a step below says otherwise. Build the reading surface
against mock text; prompt 15 fetches real `script_text` and the parity prompt
adds parity persistence.

1. Replace the `reader/[chapterId]` placeholder from prompt 08. It receives only
   the chapter id from the route param. Per the prompt-08 map
   (`lib/mini-player-visibility.ts`), M5 shows NO bottom tab bar and NO mini
   player — the reading surface owns the screen. Verify that is true during the
   push transition too, not just after it settles.
2. Render from a local mock chapter for now, containing exactly the three
   Markdown marks AGENTS.md permits in `script_text` and nothing else. Mark it
   `// MOCK — prompt 15 fetches real script_text`. Include a realistically long
   body — several thousand words — so scrolling, memory and the toolbar are
   tested against something honest rather than two paragraphs. Put the book
   title, chapter number, chapter title and the book's chapter count in the same
   mock object: the top bar and the position label (step 13) need them, and
   prompt 15 swaps them for real values.
3. Body type is Literata at 18sp with 1.7 line-height as the DEFAULT, and it is
   the only place Literata is used in the app. Chapter headings use Fraunces 600.
   Any UI chrome — toolbar labels, chapter number, progress text — is Inter.
   Do not apply Literata to chrome and do not apply Inter to body text.
4. Write a small renderer for exactly the three permitted marks — `**bold**`,
   `_italic_`, `## heading` — and nothing else. Do not add
   `react-native-markdown-display` or any other Markdown library: it renders far
   more than three marks, and every extra rule is one more thing to switch off.
   Unsupported syntax must degrade to plain text, never to a raw token on screen
   and never to a crash. The renderer splits the text into paragraphs and keeps
   each paragraph's starting CHARACTER offset in the source string. Step 12
   depends on it.
5. Three reader themes, exactly the `ReaderTheme` values already in
   `store/reader-store.ts`, all from the prompt-01 tokens, no raw hex:
   - `light`, the DEFAULT: `reader-light` background with `ink` text
   - `sepia`: `reader-sepia` background with `ink` text
   - `dark`: `bg` background with `body` text

   This matches AGENTS.md M5, the frame and the existing store. Every theme's
   body text must clear 4.5:1 against its own background — measure and report
   all three. Theme choice reads from and writes to the `reader` slice in the
   prompt-07 Zustand store, which is already persisted.
6. Top bar as in the frame: back, the book title above "Chapter {n}", and `Aa`
   on the right. The top-bar `Aa` opens the same settings sheet as the toolbar's
   `Aa` (step 9).
7. Floating toolbar as shown, with the AGENTS.md fix applied: the design file has
   the toolbar overlapping body text, which is a known defect. Give the scroll
   container bottom padding equal to the toolbar height plus the safe-area inset
   so the last line is never covered. Report the value you used.
8. The toolbar auto-hides on scroll down and returns on scroll up or on tap.
   Implement it with the `Animated` value exception the AGENTS.md style table
   permits. It must always be reachable — never leave a state where the user
   cannot get it back without scrolling.
9. Toolbar controls, left to right as in the frame, with these changes:
   - Brightness (sun icon): cycles the theme light → sepia → dark. There is no
     screen-brightness control and no `expo-brightness`; the theme is what
     covers night reading. Keep the frame's icon, and report that its meaning
     changed.
   - `Aa`: opens a settings sheet — a real screen or bottom sheet, not an
     `Alert` — with font size, theme and line spacing bound to the `reader`
     slice. Show the Atkinson Hyperlegible toggle but keep it inert until the
     accessibility-font prompt. The font is not bundled, and
     `readerFontFamily()` in `theme/typography.ts` falls back to Literata.
   - Bookmark: NOT rendered. A manual bookmark needs its own table, and prompt
     13 does not create one. Mark it
     `// UNBACKED — bookmark needs a bookmarks table` and report the omission.
   - Listen: a teal-outlined pill with a headphone icon, as in the frame and
     AGENTS.md M5. Reuse the `Button` audio variant (`btn--audio`) that prompt
     12 adds. It is NOT ember.

   The reader has no ember button. Its only ember element is the progress bar
   (step 13). Every other control is `muted` or outline.
10. "Listen" is a no-op with a `// TODO(handoff)` marker. Do not push
    `player/[id]` yet — the handoff must carry a position in both directions and
    there is no `reading_positions` write path until the parity prompt. A
    handoff that loses the reader's place is worse than no handoff.
11. Chapter navigation is NOT in the toolbar; the frame has no previous/next
    there. At the end of the chapter text, render an outlined "Next chapter"
    button and a "Previous chapter" text link. Hide Previous on chapter 1 and
    Next on the last chapter (the mock's chapter count from step 2 decides).
    Both are no-ops here, marked `// Wired in prompt 15`.
12. Reading position is a CHARACTER offset, never pixels. Using step 4's
    paragraphs, record each paragraph's starting offset and its `onLayout` y.
    - On scroll end (not on every scroll event), the paragraph at the top of
      the viewport gives the offset. Write
      `{ chapterId, textOffset, lastWrittenBy: "text", updatedAt }` to the
      `parity` store from prompt 07, session-only, not persisted to disk. Keep
      `audioMs` as the store already holds it for this chapter, or 0.
    - On remount within the session, scroll to the paragraph that contains
      the stored offset (https://reactnative.dev/docs/scrollview).
    - When the font size or line spacing changes, keep that same paragraph at
      the top. This is what a pixel offset cannot do, and it is what the audio
      handoff will map from.

    Mark it `// SERVER COPY — added by the parity prompt`. Do not write to
    `reading_positions` here even though the table now exists.
13. Progress: a thin ember bar pinned to the bottom edge, as in the frame.
    Progress bars are exempt from the one-ember-element rule. Its label reads
    "Chapter {n} of {chapter count} · {x}%", where x is progress through THIS
    chapter, derived from the scroll position. Put the label just above the
    toolbar so it moves with it, never over the text.
    - The frame's "Page 4 of 18" is dropped, because a scrolling reader has no
      pages.
    - Its "22% of book" is dropped, because it needs every chapter's length,
      which nothing provides.

    Report both omissions.
14. Set `allowFontScaling` deliberately. Body text SHOULD scale with the system
    setting, but cap it with `maxFontSizeMultiplier`
    (https://reactnative.dev/docs/text) so the largest accessibility size does not
    destroy the toolbar and chrome. State the cap you chose. Never disable scaling
    outright on body text.
15. Keep the screen awake while reading with `expo-keep-awake`'s `useKeepAwake`
    hook (https://docs.expo.dev/versions/latest/sdk/keep-awake/). It was
    approved on 2026-09-23 (AGENTS.md § Tech Stack). Install it with
    `npx expo install expo-keep-awake`. Scope it to this screen only so it
    releases on unmount, and do not enable it app-wide.
16. Loading, empty and error states surface-matched to the ACTIVE reader theme —
    a light-theme error must not render on a plum background. Skeleton lines
    shaped like text, not a centred spinner. No `Alert.alert`, no red toast.
17. `accessibilityRole` and a label on every toolbar control and on the
    end-of-chapter navigation, 44dp minimum touch targets, and make sure the
    auto-hiding toolbar is still reachable by a screen reader when visually
    hidden.

Do not:
- fetch anything. No Supabase and no TanStack Query in this prompt.
- write to `reading_positions`, `unlocks` or `library_items`.
- check entitlement, render a paywall, or gate a locked chapter. The paywall
  prompt owns that, and this screen assumes the chapter is readable.
- play audio or install `react-native-track-player`.
- add text selection, highlighting, bookmarks, notes, translation or dictionary
  lookup.
- add a Markdown library, a brightness library, or any library other than
  `expo-keep-awake`.
- store a pixel scroll offset as the reading position.
- add an ember button.
- add a gradient, glow, blur or shadow. The gradients AGENTS.md permits are
  not on this screen.
- use raw hex outside `global.css`'s `@theme` block (`theme/colors.ts` only
  for props that take no className).
- build M6, M9 or the `Aa` sheet's accessibility font switching.

Finish by running `npm run typecheck` and `npm run lint`. Then:
- paste the three theme contrast ratios from step 5
- paste the toolbar padding value from step 7
- paste the `maxFontSizeMultiplier` cap from step 14
- confirm that changing the font size keeps the same paragraph at the top
  (step 12)
- list every frame element you omitted or changed, with the reason: bookmark,
  the brightness icon's meaning, "Page 4 of 18" and "22% of book"
- confirm on a physical device that a several-thousand-word chapter scrolls at
  60fps and that no line is ever hidden behind the toolbar
