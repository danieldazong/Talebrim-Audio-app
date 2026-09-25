Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revised 2026-09-25 against the code as built by prompts 14–18. The live
> mini player and the Android notification permission moved to prompt 18
> (mini player done; the permission is in AGENTS.md § Deferred setup), so this
> file's name is out of date. Audio is `expo-audio` behind `lib/audio/`, never
> called from a screen. Decisions this review made are in AGENTS.md
> § Decisions — 2026-09-25.

This prompt connects the two halves that were built apart: the reader (M5,
prompts 14–15), the player (M6, prompts 17–18) and the parity writer
(`lib/parity/`, prompt 16). Wire BOTH directions in this one prompt. A user who
can hand off and not hand back is stranded. Do not change either screen's
design or layout, except the two uses of existing text slots in step 8 and the
disabled states in step 9.

What exists. Build on it, not around it:
- `lib/parity/writer.ts`: `recordPosition({ chapterId, bookId, mode, value })`
  writes the session slice at once and queues the server write; `flush()`;
  each write sends only its own side and sets `last_mode` to its mode.
- `lib/parity/convert.ts`: `textOffsetToAudioMs()` and `audioMsToTextOffset()`
  return `{ value, basis: "estimate" | "chapter-start" }`. The data has no
  alignment: the mapping is proportional within a chapter, and falls back to
  the chapter start when the narration has no measured duration.
- M5 already restores from the side that wrote last: `textRestoreOffset()` in
  `hooks/use-chapter-reader.ts` maps an audio position into the text when
  listening wrote last. Audio → text is therefore mostly built.
- M6 does not: `audioRestoreMs()` in `lib/audio/rules.ts` takes the audio side
  only, with a `// TODO(handoff)` where the text side belongs.
- `lib/audio/player.ts` is the one player. `playChapter()`, `pausePlayback()`,
  `togglePlayback()` and `seekPlayback()` are its controls; its listener
  records audio positions for the LOADED chapter. Prompt 18's rule stands:
  M6 changes nothing that plays until a user action says so.
- The two no-ops: `listen()` in `app/reader/[chapterId].tsx` (used by the ready
  toolbar AND the no-text toolbar) and `readInstead()` in
  `app/player/[chapterId].tsx`, both marked `// TODO(handoff)`. M6's no-audio
  state's own "Read instead" already opens the reader and stays as it is.

1. Restate the five-step parity algorithm from AGENTS.md next to how prompt 16
   resolved each step (AGENTS.md § Decisions — 2026-09-24, "Parity writer").
   Name any gap between the spec and the code before writing any.
2. The route is the only payload. Both directions navigate with
   `router.replace` to the other screen with the chapter id, plus, for
   Listen only, a `play` flag (step 5). Never a position in a param, a module
   global or AsyncStorage: the destination reads the position from the
   parity session slice, which `recordPosition()` has already written.
3. Never block the handoff on the network (parity step 5). Record the
   source's position synchronously, start `flush()` without awaiting it, and
   navigate. The destination restores from the session copy, which is
   already current; the writer's queue outlives the unmount and sends it.
   - M5 records its current place at the moment of the tap. Don't wait for
     the scroll to settle: a settle timer still pending would record after
     M6 has already read the position.
   - M6 records only for the loaded chapter (step 6).
4. Text → audio in the restore itself, so every way into M6 gets it (Listen,
   M4's Listen, a chapter change), not just the handoff:
   - Replace the `TODO(handoff)` in `audioRestoreMs()`. When the newer
     position (`newerPosition()`) was written by reading, the start is
     `textOffsetToAudioMs()` of its text offset; otherwise the audio side as
     now, with the replay-within-5-seconds rule kept.
   - The mapping needs the chapter's text length. M6 reads it from
     `chapterTextOptions()`, on that query's sanctioned-read terms (after
     `chapters_catalog` returned the chapter, never for a locked one), and
     only when the newer position was written by reading. Coming from M5 it
     is already cached. Otherwise M6 fetches it and waits as it waits for the
     position. If the text cannot be read (offline, failed), fall back to the
     audio side, else the chapter start.
   - `lib/audio/resolve.ts` (previous, next, autoplay) uses the same rule
     with the text length from the cache only. No background download of a
     chapter's text.
   - A chapter that is loaded but paused, whose newer position was written
     by reading since (`lastWrittenBy === "text"`), shows the mapped point on
     the scrubber, and Play starts from there. This is the Read instead →
     read on → Listen round trip: without it, Listen would resume where the
     audio paused, not where the reader got to.
5. Listen (M5 → M6) starts listening: `router.replace` to M6 with
   `play: "1"`. Once M6 is ready, it starts the chapter at the step-4 point,
   once, as its own Play would. It then clears the flag
   (`router.setParams`), so a re-render never starts it again. If the
   chapter is locked, has no narration or is unavailable, M6 shows that
   state and plays nothing. Another chapter that was playing is recorded,
   flushed and replaced, exactly as Play does.
6. Read instead (M6 → M5), in the ready state:
   - On the loaded chapter: pause (which records and flushes), then
     `router.replace` to M5. Reading instead means the audio stops: two
     surfaces recording one chapter would fight over `last_mode`.
   - On a chapter that isn't loaded: navigate only. Never pause a different
     chapter's playback.
   - M5 then restores through `textRestoreOffset()` as it already does.
7. Entering the reader any other way (M4, the chapter list) never stops
   playback, and the reader's chapter and the player's may differ: listening
   to chapter 4 while reading chapter 7 is supported. Each surface records
   only its own chapter.
8. Say when the place is an estimate or a fallback (AGENTS.md: the handoff
   reports which basis it used). Whenever a screen opens at a place mapped
   from the other mode, whether by handoff or any other way in:
   - M6 shows it for 4 seconds in the "Shared Bookmark" slot under the
     scrubber: "Near where you were reading" (estimate), or "From the start of
     the chapter" (chapter start). Then the slot returns to what step 11 of
     prompt 18 shows.
   - M5 shows it for 4 seconds in the toolbar's position-label slot: "Near
     where you were listening", or "From the start of the chapter".
   - Same styles as the slot's own text. No new element, no layout shift, no
     toast. Screen readers hear it (`AccessibilityInfo.announceForAccessibility`).
   - Nothing shows when the screen restores from its own mode.
9. A handoff with nowhere to go is disabled, not a round trip to an empty
   state:
   - M5's Listen is disabled when the chapter has no narration (`has_audio`
     not true), with the label "Listen. This chapter has no narration yet."
     This applies to both toolbars.
   - M6's Read instead is disabled when the chapter has no text (`has_text`
     false), with the label "Read instead. This chapter has no text yet."
   - M5's no-text caption "You can listen to it instead." shows only when the
     chapter has narration. Otherwise the message stands alone.
   - Disabled needs `Button` fixed first. Its disabled and pressed opacity is
     a `style` function beside a `className`, which this NativeWind drops on
     device (AGENTS.md § Style Exception Rules), so a disabled Button looks
     enabled today. Keep its className. Track pressed with
     `onPressIn`/`onPressOut`, chaining any the caller passes, and give
     `style` a plain object. Change nothing else in `Button`. The other
     Pressables with the same bug stay for prompt 26.
10. M4's Listen resumes like M4's Read: it opens the chapter Read resumes
    (`resumeTargetOptions()`) when that chapter has narration and isn't
    locked; otherwise the book's first narrated chapter, as now. Listen in
    the car, open M4 at home, tap Listen: it must not restart chapter 1.
11. `last_mode` follows the surface in use, through the writer only. M6
    writes `audio` once it plays; M5 writes `text` once it records its first
    place, which its restore scroll produces. Confirm the restore records.
    If it does not, record the restored offset once the restore lands, and
    say which.
12. Back after a handoff: M4 → M5 → Listen → M6 → Read instead → M5, then
    Android back, lands on M4. Never on an earlier handoff, never out of the
    app. `router.replace` in both directions is what guarantees it.
13. Prove attribution with tests. The writer's own tests already prove each
    write sends only its side and each chapter keeps its own row. Add:
    - `lib/audio/__tests__/player.test.ts` with `expo-audio` mocked (a fake
      player that emits `playbackStatusUpdate`). Playing chapter 4 records
      audio positions against chapter 4 only, while the test records text for
      chapter 7. A pause flushes. Chapter 7's text and chapter 4's audio both
      survive in the session slice and in the upserts.
    - `rules.ts`: the restore point from a text-written position (mapped), with
      no duration (chapter start), with no text length (audio side), and near
      the end.
14. Teardown on both screens: the notice timer and any handoff state go with
    the unmount. The player, its listener, the sleep timer and the lock
    screen stay. State what you tore down and what you left running.

Do not:
- write your own parity upsert, persist a position to AsyncStorage, or pass
  one through params or a module global.
- await the network before navigating.
- call `expo-audio` from a screen, or seek outside `lib/audio`.
- stop playback on entering the reader, except Read instead on the loaded
  chapter.
- push instead of replace between M5 and M6.
- change any other visual detail, string or colour in M5 or M6, or use the
  gradient outside M6.
- fix the style-function bug outside `Button` (prompt 26 owns the rest).
- render a paywall (prompt 22), or build downloads (24), Library (21) or
  Profile (25).

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:
- the step 1 restatement and any gap
- which basis each direction produced in your checks, and the notice copy
- whether M5's restore records its place (step 11)
- the step 14 teardown inventory
- the device checklist below. BlueStacks allows screenshots over adb but not
  input, so the owner runs it in Expo Go. Say which items you could run
  yourself:
  1. Read chapter 1 partway, tap Listen: it plays from about the same place,
     and the notice shows.
  2. Listen on, tap Read instead: audio pauses, the reader opens at about the
     audio's place, and the notice shows.
  3. Read on, tap Listen again: it starts from the new reading place, not
     where the audio paused.
  4. Listen with no connection: M6's offline state. Nothing hangs.
  5. Tap Listen within a second of scrolling: the place is the one scrolled to.
  6. Listen to one chapter while reading another: neither position moves the
     other.
  7. Back after several handoffs lands on M4.
  8. Force-quit right after a handoff and reopen: both screens resume from the
     server row.
  9. On a chapter without narration, Listen is dimmed and does nothing.
