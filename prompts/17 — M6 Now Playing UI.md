Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/09-now-playing.png — ensure everything is as is
shown. This is the most constrained screen in the app. Build the shell with
mocked playback state; prompt 19 wires real audio and prompt 20 wires the
handoff.

1. Replace the `player/[chapterId]` placeholder from prompt 09. Pushed stack
   route outside the tab group, receiving only the chapter id. Per the prompt-09
   map, M6 shows NO bottom tab bar and NO mini player — confirm that holds during
   the push transition, not just after it settles.
2. THIS SCREEN OWNS THE ONE PERMITTED GRADIENT IN THE ENTIRE APP:
   `#150E1F → #2C1E42`, the constant defined in prompt 02. Install
   `expo-linear-gradient` (https://docs.expo.dev/versions/latest/sdk/linear-gradient/)
   and use it here and nowhere else. Two stops only. Do not add a third stop, a
   radial variant, a second gradient on the artwork, a glow behind the cover, a
   blur, or an outer shadow. If any other screen acquires a gradient, that is a
   violation to report.
3. Cover artwork centred, 12dp radius via the `Cover` primitive, from
   `expo-image` through `constants/images.ts`. Null `cover_path` renders the
   local `cover-placeholder.png` — a valid state. No remote placeholder service,
   no generated artwork, no hotlinked URL.
4. The play/pause control is 72dp, ember-filled, with the icon in `ink #1A1420` —
   never white, never `cream`. This is the single ember element on the screen.
   Every other control — back-15, previous, next, forward-15 — is `muted-light`
   or outline, sized at least 44dp even where the glyph is smaller.
5. Transport row in this order: back-15, previous, play/pause, next, forward-15.
   Use the icon set already installed; do not add a second icon library. The skip
   controls move by exactly 15 seconds — do not make it 10 or 30 to match a
   habit.
6. Speed control and Sleep timer both render in `teal #2F8C7F`. Teal is a
   reserved status colour whose permitted uses are the audio badge and these two
   controls — do not extend it anywhere else. Both open a sheet, not an
   `Alert.alert`. If you need a bottom sheet and `@gorhom/bottom-sheet` is not
   already a dependency, ask before adding it; a plain modal screen is acceptable.
7. "Read instead" is an outline or text control, never ember. In this prompt it
   is a no-op with a `// TODO(20)` marker. Do NOT push `reader/[chapterId]` yet:
   the handoff must carry a position in both directions through the prompt-17
   parity writer, and a handoff that drops the listener's place is worse than no
   handoff at all.
8. Scrubber bound to local mocked state only. Show elapsed and remaining, both
   through `formatDuration()` from prompt 04. When `audio_duration_seconds` is
   null the duration is UNKNOWN: render the unknown label and a determinate-
   position-but-indeterminate-length treatment — never `00:00`, never a full bar,
   never a zero-length bar. Progress bars are exempt from the one-ember-element
   rule. If you need a slider and one is not installed, prefer
   `@react-native-community/slider`
   (https://docs.expo.dev/versions/latest/sdk/slider/) and say so.
9. Metadata block: chapter title, book title, and chapter position in the serial.
   Book and chapter titles in Fraunces 600; everything else Inter. Literata does
   not appear on this screen — it is reader body text only.
10. The design material shows an "AUDIO SYNC ACTIVE" header label and a hamburger
    control that the AGENTS.md screen inventory never defines. Render them exactly
    as shown, wire the hamburger to nothing with an `// UNDEFINED CONTROL` comment,
    and report both in your summary. Do not invent a queue screen or a menu behind
    the hamburger.
11. All playback state reads from the `playback` slice in the prompt-08 Zustand
    store — current chapter, playing, speed, sleep timer — which is deliberately
    session-only and not persisted. Mock the transitions locally. Mark the module
    `// SHELL — wired in prompt 19`.
12. Every state, surface-matched on the gradient: loading (cover skeleton and
    disabled transport, not a centred spinner), buffering as distinct from paused,
    error inline with retry, and the no-audio case where `has_audio` is false —
    which should not normally be reachable, so render a clear message with the
    Read path offered rather than a broken player. No `Alert.alert`, no red toast.
13. Accessibility matters more here than anywhere: every transport control needs
    a unique, meaningful label — "play", "pause", "skip forward 15 seconds", not
    "button" (https://developer.android.com/guide/topics/ui/accessibility/principles).
    The play/pause control's label must change with its state. Announce the
    scrubber's value and make it operable by a screen reader, not drag-only.

Do not: install `react-native-track-player`, play any audio, or request an audio
file — prompt 19 owns all of that; mint a signed URL or call storage; write to
`reading_positions` — prompt 17 owns the writer and prompt 20 the handoff;
check entitlement or render a paywall; add a queue, a playlist, a chapter
drawer, casting, an equaliser, a waveform visualiser or an autoplay toggle —
none are in the design; add a second ember element; use the gradient anywhere
outside this screen; put white on ember; use raw hex outside
`tailwind.config.js`; change anything in M5.

Finish by running `npx tsc --noEmit`, then paste confirmation that the gradient
appears on this screen only, the two undefined elements from step 10, the
null-duration treatment from step 8, and a VoiceOver/TalkBack pass over every
transport control with the labels you assigned.

Next prompt: `19-player-trackplayer.md`.
