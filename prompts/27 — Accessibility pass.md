Read AGENTS.md first and follow it strictly. Do only what is on this page. This
is a PASS over the finished app, not new features. Change no layout, no
navigation and no data query. If a fix needs a structural change, list it and
ask me before making it. Accessibility work has been scattered across earlier
prompts by design; this is where it becomes verifiable.

1. Wire the Atkinson Hyperlegible Next toggle, which has been installed since
   prompt 02 and inert ever since. Replace the `// TODO(28)` markers in M5's
   `Aa` sheet and M11's settings. It applies to READER BODY TEXT ONLY, replacing
   Literata when enabled — it does not replace Fraunces headings or Inter chrome.
   The setting lives in the persisted `reader` slice and must survive a restart.
2. CONTRAST AUDIT against WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large text
   and for non-text UI such as borders, icons and focus indicators
   (https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html,
   https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html). Measure
   and tabulate every foreground-on-background pair actually used, not the token
   table in the abstract. Pay particular attention to the pairs most likely to
   fail: `blush #E9A8C0` backgrounds (which is why chip labels are `ink`),
   `teal #2F8C7F` on plum, `muted #6E6478` on `plum-deep #150E1F`,
   `muted-light #A79BB5` as inactive tab text, and every reader theme including
   cream. Paste the table with pass/fail per pair. Where a pair fails, fix it by
   swapping to an existing token — do NOT invent a new colour, and if no existing
   token works, report it rather than improvising.
3. TOUCH TARGETS: WCAG 2.2 sets 24×24 CSS px as the AA minimum
   (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), but
   AGENTS.md requires 44dp, which is stricter — apply 44dp. Audit every
   interactive element, including the ones most likely to be small: M6's
   transport controls either side of the 72dp play button, M5's floating toolbar
   icons, M8's clear button, M9's row affordances, M7's remove action, carousel
   cards, and genre chips. Use `hitSlop` where the visual must stay small. Paste
   the list of elements you enlarged.
4. LABELS on every interactive element, and they must describe the ACTION AND
   ITS CURRENT STATE, not the widget (https://reactnative.dev/docs/accessibility).
   The play/pause control's label changes with state; a locked chapter row says
   it is locked; a downloaded row says so; a selected genre chip announces
   selection via `accessibilityState`; a segment announces which is active; the
   remove action names the story it removes. Every label in a list must be
   unique so rows are distinguishable. Add `accessibilityHint` only where the
   outcome is not obvious from the label — do not pad every element with hints.
5. NEVER CONVEY MEANING BY COLOUR OR ICON ALONE. Audit each: M9's four row
   states, the teal audio badge, the ember active tab, download progress, the
   locked affordance, and M10's recommended-plan marker. Each needs a text or
   label equivalent.
6. DYNAMIC TYPE at the largest system setting. Reader body text scales with the
   cap from prompt 15; chrome must not break. Walk every screen at the maximum
   setting and fix clipping, truncation of essential text, and overlapping
   elements. The known risk areas are M6's transport row, M10's plan cards, tab
   bar labels, and M9's row metadata. Paste before/after evidence for anything
   you fixed.
7. SCREEN READER ORDER AND FOCUS: verify reading order matches visual order on
   every screen; group related elements so a card reads as one coherent item
   rather than four fragments; ensure M5's auto-hiding toolbar stays reachable
   when visually hidden; ensure M5a and any bottom sheet traps focus and is
   dismissible; ensure a pushed screen moves focus to its own content rather than
   leaving it behind on the previous screen.
8. Announce important asynchronous changes rather than leaving them silent: a
   successful unlock, a completed download, a purchase result, and a failed save
   the user needs to know about. Use `AccessibilityInfo`
   (https://reactnative.dev/docs/accessibilityinfo). Do not announce routine
   background parity saves — those are deliberately invisible.
9. Respect reduce-motion. Query `isReduceMotionEnabled` and disable or shorten
   the app's animations when it is on: M5's toolbar auto-hide, any collapsing
   header on M4, sheet transitions, and image fade transitions. Keep everything
   functional without the motion.
10. MANUAL TESTING IS REQUIRED — an automated check is not sufficient. Run
    VoiceOver on iOS and TalkBack on Android across one complete user journey:
    sign in, pick genres, browse Discover, open a story, read a chapter, hand off
    to audio, hit a locked chapter, subscribe or watch an ad, add to My List, and
    sign out. Paste findings per platform. Report what you could not test and why
    — for example if in-app purchase sandbox flows are not screen-reader
    navigable in your environment.
11. Verify accessibility did not break the design invariants from prompt 27:
    still exactly one ember element per screen, gradient on M6 only, teal confined
    to audio badges and M6's speed and sleep controls, `danger` on M11's
    destructive rows only, no white on ember, no raw hex outside
    `tailwind.config.js`, Literata in reader body only — now with Atkinson as its
    permitted substitute.
12. Produce a short accessibility statement for the repo: what conforms, what
    does not yet, and the known gaps. This is the honest record, not a marketing
    claim — do not write that the app is "fully accessible" or "WCAG compliant" if
    step 2 or step 6 found anything unresolved.

Do not: add a feature, screen, route or dependency; change a layout, token,
query or navigation structure; invent a new colour to fix a contrast failure;
add analytics, crash reporting or an accessibility-scanning SDK; apply Atkinson
to headings or chrome; disable font scaling outright on body text; alter any
table, policy or view; resolve any of the open conflicts from prompt 27 step 10
on your own.

Finish by running `npx tsc --noEmit`, then paste the contrast table from step 2,
the enlarged-target list from step 3, the largest-text-size evidence from step 6,
the VoiceOver and TalkBack findings from step 10, the invariant check from step
11, and the accessibility statement from step 12.

This is the final prompt in the sequence. In your summary, also list every
`// TODO`, `// MISSING ASSET`, `// UNBACKED`, `// NO BACKING METRIC` and
`// UNDEFINED` marker still present in the codebase, so nothing planted during
the build is left behind.
