
Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/08-reader.png — ensure everything is as is
shown. Build the reading surface against mock text; prompt 16 fetches real
`script_text` and prompt 17 adds parity persistence.

1. Replace the `reader/[chapterId]` placeholder from prompt 09. It receives only
   the chapter id from the route param. Per the prompt-09 map, M5 shows NO bottom
   tab bar and NO mini player — the reading surface owns the screen. Verify that
   is true during the push transition too, not just after it settles.
2. Render from a local mock chapter for now, containing exactly the three
   Markdown marks AGENTS.md permits in `script_text` and nothing else. Mark it
   `// MOCK — prompt 16 fetches real script_text`. Include a realistically long
   body — several thousand words — so scrolling, memory and the toolbar are
   tested against something honest rather than two paragraphs.
3. Body type is Literata at 18sp with 1.7 line-height as the DEFAULT, and it is
   the only place Literata is used in the app. Chapter headings use Fraunces 600.
   Any UI chrome — toolbar labels, chapter number, progress text — is Inter.
   Do not apply Literata to chrome and do not apply Inter to body text.
4. Render only the three permitted Markdown marks. Either write a small renderer
   for exactly those three, or if you use `react-native-markdown-display`, pass
   explicit `rules` so nothing else renders
   (https://github.com/iamacup/react-native-markdown-display/). Unsupported
   syntax must degrade to plain text, never to a raw token on screen and never to
   a crash. Say which approach you chose and why.
5. Three reader themes, all from the prompt-02 tokens, no raw hex: the default
   nocturnal plum surface, a darker night variant, and a cream reading surface
   using `cream #FBF9F7` with `ink #1A1420` text. Every theme's body text must
   clear 4.5:1 against its own background — measure and report all three. Theme
   choice reads from and writes to the `reader` slice in the prompt-08 Zustand
   store, which is already persisted.
6. Floating toolbar as shown, with the AGENTS.md fix applied: the design file has
   the toolbar overlapping body text, which is a known defect. Give the scroll
   container bottom padding equal to the toolbar height plus the safe-area inset
   so the last line is never covered. Report the value you used.
7. The toolbar auto-hides on scroll down and returns on scroll up or on tap.
   Implement it with the `Animated` value exception the AGENTS.md style table
   permits. It must always be reachable — never leave a state where the user
   cannot get it back without scrolling.
8. Toolbar controls, rendered but not all wired here: an `Aa` button that opens
   a settings sheet (build the sheet as a real screen or bottom sheet, not an
   `Alert`, with font size, theme and line spacing bound to the `reader` slice —
   the Atkinson Hyperlegible toggle is installed but stays inert until prompt 28);
   chapter navigation previous/next; a "Listen" affordance that will hand off to
   M6. "Listen" is the single ember element on this screen; every other control is
   `muted` or outline. Ember label in `ink #1A1420`, never white.
9. "Listen" is a no-op with a `// TODO(20)` marker. Do not push `player/[id]`
   yet — the handoff must carry a position in both directions and there is no
   `reading_positions` write path until prompt 17. A handoff that loses the
   reader's place is worse than no handoff.
10. Track scroll offset into the `parity` slice from prompt 08, session-only, not
   persisted to disk. Restore it when the screen remounts within the session
   (https://reactnative.dev/docs/scrollview). Mark it
   `// SERVER COPY ADDED IN 17`. Do not write to `reading_positions` here even
   though the table now exists.
11. A reading progress indicator derived from scroll offset. Progress bars are
   exempt from the one-ember-element rule, so it may use ember.
12. Set `allowFontScaling` deliberately. Body text SHOULD scale with the system
   setting, but cap it with `maxFontSizeMultiplier`
   (https://reactnative.dev/docs/text) so the largest accessibility size does not
   destroy the toolbar and chrome. State the cap you chose. Never disable scaling
   outright on body text.
13. Keep the screen awake while reading with `expo-keep-awake`'s hook
   (https://docs.expo.dev/versions/latest/sdk/keep-awake/), scoped to this screen
   only so it releases on unmount. Do not enable it app-wide.
14. Loading, empty and error states surface-matched to the ACTIVE reader theme —
   a cream-theme error must not render on a plum background. Skeleton lines shaped
   like text, not a centred spinner. No `Alert.alert`, no red toast.
15. `accessibilityRole` and a label on every toolbar control, 44dp minimum touch
   targets, and make sure the auto-hiding toolbar is still reachable by a screen
   reader when visually hidden.

Do not: fetch anything — no Supabase, no TanStack Query in this prompt; write to
`reading_positions`, `unlocks` or `library_items`; check entitlement, render a
paywall, or gate a locked chapter — prompt 23 owns that, and this screen assumes
the chapter is readable; play audio or install `react-native-track-player`; add
text selection, highlighting, bookmarks, notes, translation or dictionary
lookup — none are in the design; add a second ember element; add a gradient,
glow, blur or shadow — the one permitted gradient belongs to M6; use raw hex
outside `tailwind.config.js`; build M6, M9 or the `Aa` sheet's accessibility
font switching.

Finish by running `npx tsc --noEmit`, then paste the three theme contrast ratios
from step 5, the toolbar padding value from step 6, your Markdown approach from
step 4, the `maxFontSizeMultiplier` cap from step 12, and confirm on a physical
device that a several-thousand-word chapter scrolls at 60fps and that no line is
ever hidden behind the toolbar.
