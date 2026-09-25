Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the mocked playback from prompt 17 with real audio. Do not change
M6's design, layout, colours or copy. If a real constraint forces a visual
change, STOP and ask me before implementing it.

Decided 2026-09-24 (AGENTS.md § Decisions — 2026-09-24, "Audio"):

- The `audio` bucket stays PRIVATE. The app signs its own URLs, and a storage
  policy checks entitlement on the server before it will sign one.
- Playback uses `expo-audio`, not `react-native-track-player`, which has had no
  release in a year. `expo-audio` ships with SDK 57.
- A development build (`expo-dev-client`, EAS, Android first). DEFERRED on
  2026-09-24 to the setup before prompt 22 (AGENTS.md § Deferred setup), with
  the audio storage policy. This prompt runs and is tested in Expo Go.

What exists (prompts 16–17). Build on it, not around it:

- M6 at `app/player/[chapterId].tsx`, its parts in `components/player/`, its
  data in `hooks/use-now-playing.ts` (a status union that waits through
  `waitFor()` in `lib/query-status.ts`).
- The mock, `hooks/use-shell-playback.ts`. The screen consumes only its shape:
  `status` (`paused | buffering | playing`), `elapsed` in seconds, `sleep`, and
  `togglePlay`, `seekTo`, `skipBy`, `setSleepTimer`.
- `lib/parity/writer.ts`: `recordPosition({ chapterId, bookId, mode, value })`
  and `flush()`. The root `useParitySync()` already flushes when the app
  leaves the foreground and adopts newer rows when it returns. `reconcile()`
  and `fromServerRow()` in `lib/parity/reconcile.ts`;
  `readingPositionByChapterOptions()`.
- The `playback` slice: `currentChapterId`, `isPlaying`, `speed`,
  `sleepTimerMinutes`. The mini player appears whenever `currentChapterId` is
  set, and today it is a static shell with placeholder art and copy.
- `chapterNeighboursOptions()`, `lockStateFor()`, `appSettingsOptions()`,
  `unlocksByUserOptions()`, `bookDetailOptions()`, `resolveCoverUrl()`.
- The dashboard's `audio_read` policy (migration
  `20260916000004_storage_buckets.sql`) lets ANY signed-in user read EVERY
  audio object. The policy that replaces it is part of the deferred setup.
  Until then the paywall is not enforced on audio, as it is not on text.

1. The library.
   - `npx expo install expo-audio`. Approved 2026-09-24. Nothing else. Not
     `expo-dev-client`: once it is installed, `npx expo start` opens
     development builds instead of Expo Go, and there is no build yet.
   - Add the plugin to `app.json`:
     `["expo-audio", { "enableBackgroundPlayback": true, "recordAudioAndroid": false, "microphonePermission": false }]`.
     By default the plugin adds the microphone permission. This app never
     records, and Google Play asks every app holding `RECORD_AUDIO` to justify
     it. Confirm with `npx expo config --type introspect` (or a prebuild you
     then delete) that `RECORD_AUDIO` is absent and that
     `FOREGROUND_SERVICE_MEDIA_PLAYBACK` and `AudioControlsService` are
     present. Never commit an `android/` or `ios/` folder.
   - Write the background, lock-screen and interruption code in full. Test
     everything Expo Go can run. The checks that need the development build
     are listed in AGENTS.md § Deferred setup: add any you find to that list
     instead of skipping them silently.
2. Check the API before writing against it. Open the installed `expo-audio`
   types in `node_modules` and confirm every function, property, event and
   option you will use. Report the version and the exact surface. Expected at
   57.0.5: `createAudioPlayer`, `useAudioPlayerStatus`, `setAudioModeAsync`
   (`playsInSilentMode`, `shouldPlayInBackground`, `interruptionMode`),
   `player.replace`, `play`, `pause`, `seekTo`, `setPlaybackRate`,
   `setActiveForLockScreen(active, metadata, options)`,
   `updateLockScreenMetadata`, `clearLockScreenControls`, `release`, the
   `playbackStatusUpdate` event, and `requestNotificationPermissionsAsync`.
3. The storage policy that enforces the paywall on audio is NOT in this
   prompt. It moved to the deferred setup (AGENTS.md § Deferred setup, which
   records its full specification), because proving it needs test accounts
   and a locked chapter with narration. Write no migration here. The app
   signs the same way before and after it lands. Build step 4's refusal
   handling anyway, because that is how the app will behave once it is in.
4. The signed source: `chapterAudioSourceOptions(chapterId)` in
   `lib/queries/audio.ts`, with its own key in `lib/query-keys.ts`.
   - It reads `audio_path` from `chapters` by id. That is the SECOND
     sanctioned direct read of `chapters` (the first is
     `chapterTextOptions()`), on the same terms: only after `chapters_catalog`
     returned the chapter, and never for one that resolves to locked. Then
     `supabase.storage.from("audio").createSignedUrl(path, SIGNED_URL_TTL_SECONDS)`
     under the reader's own Clerk token. No Edge Function, and no service-role
     key anywhere.
   - `SIGNED_URL_TTL_SECONDS` is 6 hours, longer than any chapter at 0.75x.
     Step 7's re-mint covers the rest. Give the query a `staleTime` one hour
     shorter, so a cached URL is never handed out close to its expiry.
   - A signed URL is a bearer credential. Never persist it: exclude its key
     from the persisted cache (the persister's
     `dehydrateOptions.shouldDehydrateQuery`).
   - A null `audio_path` (the row changed after `has_audio` was read) means
     not available. When Storage refuses (a 400 "Object not found"), refetch
     the settings and unlocks once. If the lock rule now says locked, show
     Locked; otherwise show Not available. Never show a raw storage error.
5. One player for the whole app, in `lib/audio/` (no React).
   - Create it once with `createAudioPlayer()`, the first time anything plays.
     Never use `useAudioPlayer()`, which releases the player on unmount. The
     player outlives M6, which is what keeps the mini player and the lock
     screen working. Call `setAudioModeAsync({ playsInSilentMode: true,
shouldPlayInBackground: true, interruptionMode: "doNotMix" })` once,
     before the first play.
   - It knows which chapter is loaded: the id, book id, duration and
     lock-screen metadata. `currentChapterId` in the `playback` slice mirrors
     it. This is the first code allowed to set it, and the mini player appears
     from then on.
   - Loading a chapter: `replace()` with the signed URL, then wait for
     `isLoaded` before seeking, because a seek before load can be dropped.
     Seek to the restore point, apply the speed, then play. Check the resulting
     position rather than assuming the seek took.
   - The restore point: reconcile the session copy and the server row as M5
     does (`reconcile()`, `fromServerRow()`), and take the AUDIO side
     (`audio_ms`).
     - No audio position: start from the beginning.
     - Within 5 seconds of the end: start from the beginning, so a finished
       chapter replays instead of ending at once.
     - Mapping a newer TEXT position into audio needs the chapter's text
       length, so it belongs to the handoff (prompt 19). Leave
       `// TODO(handoff)` where it goes.
   - The lock screen, on every load:
     `setActiveForLockScreen(true, { title: "Chapter n: title", artist: author, albumTitle: book title, artworkUrl: cover URL }, { showSeekBackward: true, showSeekForward: true })`.
     On Android this is also what keeps background playback alive past about
     three minutes. If the types show the skip interval, report it. If it is
     not 15 seconds and cannot be set, report that; do not build a native
     module. `expo-audio` offers no next/previous-chapter buttons on the lock
     screen. That was accepted on 2026-09-24.
6. Positions go through `lib/parity` only. Use ONE `playbackStatusUpdate`
   listener in `lib/audio/`, never in a component, so it records with M6
   closed and the app in the background.
   - While playing, call `recordPosition({ chapterId, bookId, mode: "audio", value: ms })`
     for the LOADED chapter, never the one on screen. The writer's debounce and
     ten-second maximum wait are the interval; add no timer of your own.
   - Call `flush()` on pause, and before loading another chapter.
     `useParitySync()` already flushes when the app goes to the background.
     Never write your own upsert, and never cancel a write.
7. Expiry and failures. A load error or an auth failure mid-listen re-mints
   the URL (`refetch` the source), `replace()`s it and resumes at the current
   position, without the user noticing. Only when the re-mint fails does M6
   show its Failed state ("We couldn't load this chapter." with Retry).
   Offline with nothing cached shows Offline. No raw errors, no alerts.
8. M6 on the real player. Replace `hooks/use-shell-playback.ts` with
   `hooks/use-audio-playback.ts`, returning the SAME shape, and delete the
   shell. The screen and its components change only where step 11 says.
   - Status comes from `useAudioPlayerStatus(player)`: `buffering` while
     loading or while `isBuffering`, `playing` while `playing`, otherwise
     `paused`. Never copy progress into Zustand on every tick.
   - `useNowPlaying` gains the signed source as a needed query, after the lock
     check, only when the chapter on screen is not the loaded one. It shows the
     skeleton while the URL is minted, and step 4's states when that fails.
     Opening M6 for the loaded chapter (from the mini player) never re-signs.
   - M6 never changes what is playing until its own Play is pressed.
     - For a chapter that isn't loaded, the scrubber shows its restore point,
       and a seek or skip before Play moves where Play starts.
     - Play then flushes the old chapter, loads this one and plays.
   - Duration: the catalog's measured `audio_duration_seconds`. When that is
     unknown, use the player's `duration` once it is finite and above zero.
     Otherwise it stays "Duration unknown".
   - Previous and next on the loaded chapter are real track changes. Load the
     neighbour at its restore point, keep playing if it was playing, and
     `router.replace` M6 to it. On a chapter that isn't loaded they only
     navigate, as now.
9. Speed and the sleep timer live in `lib/audio/`, not in a component, so both
   outlive M6.
   - Speed: `setPlaybackRate(speed)` with pitch correction, applied on change
     and after every load. `playback.speed` stays the source.
   - Sleep timer: store its END time (`sleepTimerEndsAt` in the `playback`
     slice, replacing `sleepTimerMinutes`), plus one module timer that pauses
     playback at the end.
     - Also check the end time on every status update and on return to the
       foreground, because JavaScript timers can run late in the background.
     - It keeps running when M6 closes. Only Off, reaching the end and sign-out
       clear it, never an unmount.
     - At zero it pauses. A short fade is optional.
     - M6's "28 min" label reads from it.
10. Autoplay the next chapter on `didJustFinish`. Record the end, flush, then
    resolve the next chapter with `chapterNeighboursOptions()` and
    `lockStateFor()`, from the cache or a fetch.
    - Unlocked with audio: load it at its restore point and play. If M6 is
      showing the finished chapter, `router.replace` it along.
    - Locked: stop cleanly, and leave `// TODO(paywall)` where M5a opens.
    - No audio, or the last chapter: stop.
    - Mint the next chapter's URL ahead, once playback is 90% through. Never
      mint one for a locked chapter.
11. Make the two labels truthful (prompt 17 rendered them as static copy):
    - "AUDIO SYNC ACTIVE" shows only while M6's chapter is the loaded one,
      because only then is its position recording through `lib/parity`. It is
      hidden otherwise, and the header's layout stays the same.
    - "Shared Bookmark" shows only when this chapter has a saved position, in
      the session or on the server. It is hidden before the first one.
      Remove the `STATIC` markers.
12. The mini player goes live here, not in prompt 19. Dismissing M6 leaves
    audio playing, and a placeholder track in the mini player would lie.
    - Its data comes through a hook; components don't fetch.
    - It shows the loaded chapter's real cover (`resolveCoverUrl()`, or a flat
      `surface` box when there is none). Never the local art in
      `constants/images.ts`.
    - It shows "{book} · Ch. {n}" and the author.
    - Play/pause reads the same player status as M6, so the two can never
      disagree.
    - A tap opens M6 for the loaded chapter (`router.push`).
    - No progress line: its frame draws none.
    - Remove `isPlaying` from the `playback` slice once nothing reads it, so
      there is one source of truth.
13. The Android notification permission is decided on a device, in the
    deferred setup. Do not request `POST_NOTIFICATIONS` in this prompt.
14. Interruptions: a phone call, another app taking audio focus, Bluetooth
    disconnecting or headphones being unplugged, and connectivity lost
    mid-stream. Each one pauses or recovers, and none loses the position (the
    pause flushes it). Test the ones Expo Go can. Report which ones
    `expo-audio` handles itself and which you handled.
15. Teardown.
    - M6 unmounting removes only its own subscriptions. The player, the status
      listener, the sleep timer and the lock-screen controls stay, because the
      mini player and background playback run on them.
    - Sign-out (`clearUserScopedState()`) does, in order:
      - pause, then record and flush the position (the parity sign-out flush
        then sends it)
      - clear the lock screen, the sleep timer and `currentChapterId`
      - `release()` the player

      The next account never hears or sees the last one's chapter.
      State what you tore down and what you deliberately left running.

16. Unit tests under `__tests__/` for the pure parts: the status mapping; the
    restore point (no position, near the end, a text-only row); the sleep
    timer's end check; and the choice of duration.

Do not:

- make the `audio` bucket public, sign through an Edge Function, or put a
  service-role key, a Supabase JWT secret or any secret in the app or an
  `EXPO_PUBLIC_` variable.
- persist a signed URL, or add a cache-busting parameter of your own to one.
- write to `reading_positions` except through `lib/parity`, or record a
  position against any chapter but the one that played it.
- install `react-native-track-player`, or any other audio, slider or sheet
  library.
- keep the microphone permission.
- add a queue or playlist UI, casting, an equaliser or a waveform.
- render a paywall or a purchase flow, or check a subscription. The paywall
  prompt owns those.
- open the reader from "Read instead". The handoff (prompt 19) owns it, in
  both directions at once.
- download audio for offline use. The downloads prompt (24) owns it.
- install `expo-dev-client`, add `eas.json`, set `android.package`, or write
  the storage policy. The deferred setup owns them.
- change M6's design, M5, or any gradient.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:

- the installed `expo-audio` version and the surface from step 2
- the TTL from step 4
- step 1's manifest check
- the teardown inventory from step 15
- results in Expo Go, for each of:
  - play, pause, seek, the skips and speed
  - an expired URL re-minting mid-listen (in `__DEV__`, sign for 60 seconds
    to force it)
  - cancelling the sleep timer leaves no timer running
  - autoplay stopping at a locked chapter, if the data has a free chapter
    with audio followed by a locked one
  - playback continuing with M6 dismissed, and the mini player live
  - sign-out stopping playback
- anything you added to AGENTS.md § Deferred setup's device checks
