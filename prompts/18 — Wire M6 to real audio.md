Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the mock from prompt 18 with real playback. Do not change the
screen design, the layout, the colours or the navigation. If a real constraint
forces a visual change, STOP and ask me before implementing it.

1. BUILD PREREQUISITE, verify before anything else: `react-native-track-player`
   contains native code and does NOT run in Expo Go. This app needs a custom
   development build (https://docs.expo.dev/develop/development-builds/introduction/).
   Confirm whether one already exists for this project. If not, STOP and tell me —
   do not spend the prompt writing playback code that cannot be run.
2. Before writing lifecycle code, check the method signatures against the SDK
   ACTUALLY INSTALLED in this repo. Open the installed
   `react-native-track-player` types in `node_modules` and confirm every method,
   event and enum you intend to use exists at that version — the API changed
   meaningfully across recent majors, including the New Architecture work
   (https://github.com/doublesymmetry/react-native-track-player). Report the
   installed version and the exact surface you will call. Do not write against a
   signature you have not confirmed.
3. Register the playback service at the app's entry point, outside any component,
   and call `setupPlayer` exactly once behind a guard. Calling it twice, or from
   inside a screen, throws or leaves a zombie player — and because M6 is a pushed
   route the user will mount it repeatedly in one session. Declare capabilities
   for both the notification and the lock screen: play, pause, skip to next, skip
   to previous, seek, and the 15-second jump intervals.
4. AUDIO URL — this depends on the Phase 0 bucket decision, which is: the `audio`
   bucket stays PRIVATE. Mint a short-lived signed URL per playback from an Edge
   Function that checks entitlement server-side before signing
   (https://supabase.com/docs/reference/javascript/file-buckets-createsignedurl).
   Set `expiresIn` comfortably longer than the longest chapter so a session never
   dies mid-listen, and state the value you chose. A public bucket would let
   anyone holding a path bypass the paywall permanently, which defeats prompts 23
   and 24.
5. Edge Function gotcha, verify explicitly: Supabase's built-in JWT verification
   rejects Clerk third-party tokens, so the function must be deployed with
   verification disabled and verify the Clerk token itself in the handler
   (supabase/supabase#34988). Do the entitlement check inside the function using
   the caller's Clerk `sub` — free chapters within the live
   `free_chapters_at_start` from `app_settings`, a matching `unlocks` row, or an
   active subscription entitlement. Never trust a client-supplied claim of
   access. The service-role key lives only in the function's environment and
   never in the app bundle.
6. Handle signed-URL expiry as a real state: if a URL expires mid-session or a
   load fails with an auth error, re-mint transparently and resume at the current
   position without the user noticing. Do not surface a raw storage error.
7. Wire every control prompt 18 built: play/pause, back-15, forward-15, previous
   and next chapter, and the scrubber's seek. Keep the exact 15-second intervals.
   Drive the UI from the library's playback-state and progress hooks, and mirror
   the minimum into the prompt-08 `playback` slice — do not duplicate progress
   into Zustand on every tick, which re-renders the tree 10 times a second.
8. Background playback, lock-screen controls, and Bluetooth and headset controls
   must all work, including the pause-on-unplug behaviour users expect. Configure
   the iOS audio session category and the Android foreground service the installed
   version requires. Test with the app backgrounded and the screen locked — not
   just in the foreground.
9. Variable speed and the sleep timer, both already rendered in teal: wire speed
   through the library's rate API, and implement the timer so it fades or stops at
   zero and — critically — is TORN DOWN on unmount and on manual cancel. A leaked
   timer stops playback minutes later with no visible cause.
10. Autoplay the next chapter on completion, respecting the lock boundary: if the
    next chapter resolves to `locked` via `resolveChapterState()`, stop cleanly and
    leave a `// TODO(23)` for the paywall rather than skipping silently to a
    chapter the user has not unlocked, and rather than failing to load one.
11. Auto-bookmark on pause through the prompt-17 parity writer only — call its
    functions, do not write your own upsert. Fire on pause, chapter change, app
    backgrounding, the periodic interval, and unmount, and FLUSH rather than cancel
    on teardown. `last_mode` must be set to audio on every write from this screen.
12. TEARDOWN, both exit paths: a user-initiated stop and an unmount while
    playing. Remove every event listener you added, clear the sleep timer, flush
    the parity write, and decide deliberately whether playback continues when M6
    unmounts — it SHOULD continue, since the mini player from prompt 09 is the
    whole point, so do not stop the player on unmount; only remove the screen's
    subscriptions. State what you tore down and what you deliberately left running.
13. Connection state as a four-value enum — idle, loading, playing, failed — plus
    buffering as distinct from paused, mapped onto the states prompt 18 already
    rendered. Wire the mini player's play/pause and progress to the same real
    state, so the two surfaces can never disagree.
14. Interruptions: an incoming call, another app taking audio focus, and loss of
    connectivity mid-stream. Each must pause or recover gracefully and none may
    lose the position.

Do not: make the `audio` bucket public, or embed a permanent storage URL
anywhere; put a service-role key, a Supabase JWT secret, or any secret in the
app bundle or an `EXPO_PUBLIC_` variable; write your own `reading_positions`
upsert; alter any table, policy or view; render a paywall or a purchase flow —
prompt 23 owns it; push `reader/[chapterId]` — prompt 20 owns the handoff; add a
queue, playlist, casting, equaliser or waveform; change any visual detail from
prompt 18; use the gradient outside M6; download audio for offline use — prompt
25 owns it as a separate mechanism.

Finish by running `npx tsc --noEmit`, then paste the installed version and API
surface from step 2, the `expiresIn` value from step 4, confirmation the Edge
Function verifies the Clerk token itself and checks entitlement server-side,
and test results for: lock-screen control while backgrounded, Bluetooth
pause/resume, an expired URL re-minting mid-session, sleep timer cancellation
leaving no leaked timer, autoplay stopping at a locked chapter, and playback
continuing when M6 is dismissed.
