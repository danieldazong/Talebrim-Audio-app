Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: `material/8.png`. The image wins for layout; AGENTS.md wins
for tokens. Where they disagree, follow this page and report it.

Build M6 Now Playing on REAL chapter data with MOCKED playback. Prompt 18
wires real audio; prompt 19 wires the M5 ↔ M6 handoff. Everything the screen
shows about the book and chapter comes from Supabase in this prompt. Only the
playback itself (playing, position, buffering) is mocked.

What exists (prompts 08–16). Build on it, not around it:

- `app/player/[chapterId].tsx` is a placeholder, registered in
  `app/_layout.tsx` outside `(tabs)` with `animation: "fade"`. No tab bar and
  no mini player, by construction, during the transition and after it.
- `nowPlayingGradient` in `theme/colors.ts`, one of the three gradients
  AGENTS.md approves. `expo-linear-gradient` is installed.
- Queries: `chapterDetailOptions()` (number, title, access, `has_audio`,
  `audio_duration_seconds`, `book_id`), `bookDetailOptions()` (title, author,
  `cover_path`), `appSettingsOptions()`, `unlocksByUserOptions()`,
  `chapterNeighboursOptions()`. `resolveCoverUrl()` in `lib/covers.ts`.
  `chapterStateFor()` in `types/states.ts` is the one lock rule.
- M5's `hooks/use-chapter-reader.ts` shows the pattern: one hook resolves a
  status union from those queries, with `lockStateFor()` and `waitFor()`.
- `store/playback-store.ts` is session-only. The mini player
  (`components/player/MiniPlayer.tsx`) appears whenever `currentChapterId`
  is set.
- `Button` has an `audio` variant (teal outline). `Cover` is 2:3 only.
  `formatDuration()` in `lib/format.ts` prints "Duration unknown" for null.
  `components/reader/reader-settings-sheet.tsx` is the sheet pattern: a
  React Native `Modal` on `raised`.

1. Route. Replace the placeholder. The only param is the chapter id; a
   malformed one (`isUuid()`) is the "not available" state, as in M5. Key the
   screen by chapter id.
   - The dismiss control is a down chevron, so present the screen from the
     bottom: change the player route's `animation` in `app/_layout.tsx` from
     `"fade"` to `"slide_from_bottom"`. The chevron and Android back call
     `router.back()`, or `router.replace("/")` when there is nothing to go
     back to.
2. Data: `hooks/use-now-playing.ts`, shaped like `use-chapter-reader.ts`. It
   reads the chapter row, the book, the settings and the unlocks, and returns
   the status the screen switches on plus the data each state needs.
   - Precedence, as in M5: offline (a needed query paused with no data) →
     failed (errored and not refetching; Retry refetches only the failed ones)
     → loading → not available (missing, unpublished, a null `id`/`book_id`/
     `number`, or a null book) → locked (the same lock rule) → no audio
     (`has_audio` false) → ready.
   - Share, don't copy: move `lockStateFor()` from `use-chapter-reader.ts` to
     `types/states.ts` beside `chapterStateFor()`. Move `waitFor()` and its
     `NeededQuery` type to a pure `lib/query-status.ts`, generalised only as far
     as both hooks need. M5's behaviour does not change, and these moves are the
     only edits to M5's files.
   - No storage, no `audio_path`, no signed URL: prompt 18 owns all of that.
3. Surface. `nowPlayingGradient` (`#150E1F → #2C1E42`, vertical, two stops)
   through `expo-linear-gradient`, filling the whole screen under the status
   bar and home indicator. Light status bar. No third stop, no radial variant,
   no second gradient, no glow, blur or shadow. The frame's red haze around the
   cover is a glow: omit it. Report any gradient in the app beyond the three in
   `theme/colors.ts`.
4. Header, measured from the frame: 24dp side padding. Left, a 40dp round
   dismiss button (`chevron-down`, `surface` fill, 1dp `raised` border) with a
   44dp touch target. Centre, "AUDIO SYNC ACTIVE" in teal, Inter SemiBold 13sp,
   uppercase, letter-spacing about 1.5.
   - The frame's right-hand hamburger has no defined function, so OMIT it and
     keep a matching 44dp spacer so the label stays centred. An inert button is
     a dead control for a screen reader. This follows the rule that dropped M5's
     bookmark ("No UI without data behind it"). Report it.
   - "AUDIO SYNC ACTIVE" claims a live parity sync. The parity writer exists
     (prompt 16), but nothing syncs in this shell. Render it as static copy,
     marked `// STATIC — made truthful by prompt 18`, and report it.
5. Cover. Square, about 72% of the screen width (281dp on the 393dp frame),
   centred, 12dp radius, with a 1dp ember border: the "thin ember rim" AGENTS.md
   M6 specifies. The rim is a decorative edge, not an action, so the single
   ember action stays the play button; say so in a comment. Crop the 2:3 art
   with `contentFit="cover"` and `contentPosition="top"` (AGENTS.md § Image
   Rule), so the title lettering survives.
   - Add an optional `aspectRatio` prop to `Cover` (default 2/3) that applies
     `contentPosition="top"` whenever it is not 2:3, and use it here. A null
     source keeps `Cover`'s flat `surface` box, so the missing-art rule stays in
     one place.
   - Source: `resolveCoverUrl(publicCdnDomain, cover_path)`. Never the local art
     in `constants/images.ts`; those covers are placeholders.
6. Metadata, centred, below the cover. Everything the frame shows here is
   placeholder copy.
   - Book title: Fraunces 600, about 26sp, champagne, at most two lines.
   - "Chapter {n}: {title}": Inter SemiBold, about 16sp, `body`, at most two
     lines. Just "Chapter {n}" when the title is null.
   - "By {author}": Inter 14sp, `muted`. Hidden when the author is null.
   - The frame's "Narration by …" credit has no column behind it: omit it and
     report it.
   - The chapter line is Inter, as the frame shows, not Fraunces. Literata never
     appears on this screen.
7. Scrubber. Build it from the installed `react-native-gesture-handler` and
   Reanimated. Do not add a slider library: `@react-native-community/slider`
   cannot draw the frame's 4dp track and 14dp thumb on Android, and `@expo/ui`
   stays out of these screens.
   - A 4dp track on `surface`, with an ember fill and a 14dp ember thumb.
     Progress bars are exempt from the one-ember rule. 24dp side padding.
   - Below it: elapsed on the left (`muted`, `formatDuration()`). "Shared
     Bookmark" centred, teal, Inter SemiBold 14sp: static, with the same marker
     as step 4. Remaining on the right, as `-` followed by `formatDuration()`.
   - Unknown duration (`audio_duration_seconds` null): the track draws no fill
     and no thumb, and dragging is off. Elapsed still counts. The right-hand
     label reads "Duration unknown", with no minus sign. The ±15 controls still
     work. Never `00:00`, never a full bar, never a zero-length bar.
   - Screen readers: `accessibilityRole="adjustable"`, a spoken value such as
     "4 minutes 15 seconds of 18 minutes 35 seconds", and increment and
     decrement actions of 15 seconds. Operable without dragging.
   - In this shell it drives the mocked elapsed time only.
8. Transport row, in this order: back-15, previous, play/pause, next,
   forward-15.
   - Play/pause: a 72dp ember circle with the icon in `ink`, never white. It is
     the single ember action on the screen.
   - The others: `muted` Ionicons (the installed `@expo/vector-icons`; no second
     icon set), each with at least a 44dp target.
   - Back-15 and forward-15: an arrow with "15" beneath it, Inter SemiBold 11sp,
     as the frame shows. Exactly 15 seconds.
   - Previous and next go to the neighbouring chapters from
     `chapterNeighboursOptions()` with `router.replace`, as M5's end-of-chapter
     controls do. A locked neighbour opens in its locked state. They are
     disabled (not hidden: the row's layout is fixed) at either end of the book
     and while the neighbours load. Prompt 18 turns them into real track
     changes.
   - Buffering is distinct from paused: the circle stays, and a small `ink`
     activity indicator replaces the glyph, labelled "Buffering". The mock shows
     it for a moment after Play.
9. Secondary row, in teal.
   - "{speed}x", Inter SemiBold.
   - A moon icon with "Sleep timer". While a timer is set, the label reads the
     time left, such as "28 min".
   - "Read instead": `Button variant="audio"` with a book icon, on ONE line. The
     frame's two-line wrap is a design defect.
   - Speed and Sleep timer each open a sheet in the reader settings sheet's
     `Modal` pattern on `raised`, never an `Alert.alert`.
     - Speeds: 0.75, 1.0, 1.25, 1.5, 1.75, 2.0.
     - Sleep timer: 5, 10, 15, 30, 45 and 60 minutes, and Off.
   - "Read instead" is a no-op marked `// TODO(handoff)` in the ready state. Do
     not push the reader yet: the handoff must carry the position through
     `lib/parity` (prompt 19), and one that drops the listener's place is worse
     than none.
10. Mocked playback, marked `// SHELL — wired in prompt 18`: local state for
    playing, buffering and elapsed. Elapsed advances once a second while
    playing, at the chosen speed. It seeks with the scrubber and the ±15
    controls, and stops at the end.
    - Write only `setSpeed` to the `playback` slice: speed is a real session
      preference. The sleep-timer choice stays local; nothing plays for it to
      stop yet.
    - NEVER set `currentChapterId` or `isPlaying`. The mini player appears
      whenever `currentChapterId` is set, so the mock would put a track that
      isn't playing in it.
    - Nothing records a position: prompt 18 records audio positions through
      `lib/parity`.
11. States, all on the gradient. The header, and the metadata lines whose values
    exist, show in every state, as M5's top bar does. The copy matches M5 where
    the meaning matches, so the two screens speak alike. Icons 32dp in `muted`,
    messages in `body` Inter 16sp, captions in `muted` Inter 14sp. Controls use
    `Button`.

    | State                   | Icon                    | Message                              | Caption                                                                         | Control                                                                                                    |
    | ----------------------- | ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
    | Loading                 | none                    | —                                    | —                                                                               | A square cover skeleton, bars for the metadata, the transport drawn but disabled. Never a centred spinner. |
    | Failed                  | `alert-circle-outline`  | "We couldn't load this chapter."     | "Check your connection and try again."                                          | "Retry"                                                                                                    |
    | Offline, nothing cached | `cloud-offline-outline` | "You're offline."                    | "This chapter isn't saved on this device yet. It will open when you reconnect." | none                                                                                                       |
    | Not available           | `book-outline`          | "This chapter isn't available."      | "It may have been taken down, or the link is out of date."                      | "Go back"                                                                                                  |
    | No audio                | `volume-mute-outline`   | "This chapter has no narration yet." | "You can read it instead."                                                      | "Read instead"                                                                                             |
    | Locked                  | `lock-closed-outline`   | "Chapter {n} is locked."             | none                                                                            | none: `// TODO(paywall)` where M5a opens                                                                   |
    - No audio's "Read instead" opens `reader/[chapterId]` with
      `router.replace`. That is not the handoff: there is no audio position to
      carry, and the reader restores its own.
    - No `Alert.alert`, no red toast.

12. Accessibility. Every control has a unique label and a 44dp target:
    - "Close player"
    - "Play" or "Pause", changing with the state; "Buffering" while it is
    - "Skip back 15 seconds", "Skip forward 15 seconds"
    - "Previous chapter", "Next chapter"
    - "Playback speed, 1.0 times"
    - "Sleep timer", or "Sleep timer, 28 minutes left" while one is set
    - "Read instead"
    - the scrubber, as in step 7

    Mark the header label and the book title as headers. Test the metadata at
    the largest system text size.

Do not:

- install `react-native-track-player`, play audio, request an audio file, call
  storage or mint a signed URL — prompt 18 owns all of that.
- write to `reading_positions` or call `lib/parity`.
- set `currentChapterId` or `isPlaying` in the `playback` slice.
- check subscription entitlement, or render a paywall.
- add a queue, playlist, chapter drawer, casting, equaliser, waveform or autoplay
  toggle — none are in the design.
- add a second ember action, a gradient beyond the three approved, a glow,
  blur or shadow, or put white on ember.
- use raw hex outside `global.css`'s `@theme` block (and its `theme/colors.ts`
  mirror, for props that take no className).
- add a slider, sheet or icon library, or `@expo/ui`.
- change M5's behaviour. Step 2's helper moves are the only edits to its files.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then:

- confirm the gradient appears on this screen only, and no new gradient was
  added
- report the frame elements omitted (the hamburger, the narration credit, the
  glow) and rendered as static (the two parity labels)
- describe the unknown-duration treatment from step 7
- list every accessibility label from step 12, as a checklist for the user to
  confirm with TalkBack or VoiceOver on a device
- confirm the shell never sets `currentChapterId`, so the mini player stays
  hidden
