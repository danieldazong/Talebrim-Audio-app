# 05 — Onboarding screen

Read AGENTS.md first and follow it strictly.

Implement the onboarding screen exactly as shown in the attached reference, using
only local assets. Add a navigation link on the home route (/) to open it.
Single static screen — no carousel, no swipe, no pagination dots.

Reference: @material/Onborading-screen 01.png
Covers: material/thumbnails/
Fonts: assets/fonts/
Logo: assets/Image/logo.png

1. Load the font files already in `assets/fonts/` with `expo-font` — Fraunces 600
   for the two headline lines, Inter for every other string. Do not install a
   Google Fonts package and do not fall back to the system face. Keep the splash
   up until fonts resolve; a frame painted early renders sans-serif and never
   re-renders. Verify on iOS and Android (PostScript name vs filename).
2. Collage: 248dp tall from the very top, full bleed behind a translucent
   light-content status bar, no black band, no gap on either edge. Centred and
   overflowing both sides symmetrically, covers overlapped and slightly angled
   with the centre cover raised, fading into `plum-deep`. `contentFit="cover"` at
   100% width. Covers come from `material/thumbnails/` via `constants/images.ts`
   with `expo-image` — never generate, download or hotlink one.
3. `logo.png` as a 40dp badge top-left, offset by the top safe-area inset so it
   clears the clock.
4. Copy and colours exactly as shown: headline 36sp Fraunces 600 at 1.1
   line-height, "Read it." in `cream` and "Or hear it." in `ember`; subhead 16sp
   Inter `muted-light`; parity card on `plum-raised` at 16dp radius with the teal
   "Synced in real time" dot and an ember progress track at 65%; two value rows
   with 40dp ember-bordered icon circles; then the free-chapters line, the button,
   the account line and the legal line.
5. THE PARITY CARD IS STATIC MARKETING COPY. Hardcode "Ch. 14 · 65%", "Text ·
   Page 182" and "Audio · 18:42 left" in one marked constant. Do not read
   `reading_positions` or call the parity writer.
6. "Start with N free chapters." reads N from the live `free_chapters_at_start`
   in `app_settings` — never hardcode 3. This is the only network call here; on
   failure render the sentence without a number.
7. "Start Reading" is the single ember element: 56dp full-width pill, label 16sp
   Inter semibold in `ink #1A1420`, never white. It and "Sign in" both go to M1
   and both set the same completion flag, so this screen never shows twice.
8. No dead vertical space: one flexible spacer between the collage and the
   headline, none below it, content bottom-anchored, 24dp side padding, 8pt grid
   between blocks. The legal line must be fully visible above the bottom inset —
   it is currently clipped. If content will not fit at 852dp, collapse the spacer
   first; never shrink a type size.
9. Nothing below 14sp. `accessibilityRole` and a label on every interactive
   element, 44dp minimum touch targets, and cap `maxFontSizeMultiplier` so the
   button stays on screen.

Do not: add dots, a pager or a skip; add a price, discount, trial badge, rating
or a "Coins" concept; add a gradient, glow, blur or shadow; add a second
ember-filled element; use raw hex outside `tailwind.config.js`; touch any other
screen.

Finish with `npx tsc --noEmit`, then confirm Fraunces renders as a serif on both
platforms, the collage has no edge gap, the legal line is not clipped, and paste
the live `free_chapters_at_start` value.
