Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revision note, 2026-09-24 (prompt 18 review). Before this prompt's own
> review: the live mini player (step 10) and the Android notification
> permission (step 13) moved into prompt 18. Audio is `expo-audio`, not
> `react-native-track-player`, so step 7's seek advice must be rewritten.
> This prompt still cites the others one number too high. See AGENTS.md
> § Decisions — 2026-09-24, "Audio".

This connects two halves that were deliberately built independently: the reader
from prompts 15–16, the player from prompts 18–19, and the parity writer from
prompt 17. Update BOTH ends in this one prompt so they cannot drift. Do not
change either screen's design or layout.

1. Re-read the five-step parity algorithm in AGENTS.md and restate it again here
   before coding, alongside what prompt 17 actually implemented. This prompt is
   where the algorithm becomes visible to the user, so any gap between spec and
   implementation must surface now, not after release.
2. Replace the `// TODO(20)` in M5's "Listen" control and the `// TODO(20)` in
   M6's "Read instead" control. Both must be live in this prompt — shipping one
   direction is worse than shipping neither, because a user who hands off and
   cannot hand back is stranded.
3. Pass context through the ROUTE, not a side channel. Both directions navigate
   with the chapter id as the route param and read the position from the parity
   layer, never from a global variable, a module-level singleton or a param blob
   carrying a serialised position
   (https://docs.expo.dev/router/reference/url-parameters/). The route param is
   the only handoff payload.
4. Before navigating in either direction, FLUSH the pending parity write and let
   it settle — do not fire and forget, and do not cancel it. The whole handoff
   depends on the position being current at the moment of transition; a debounced
   write that is still pending means the destination resumes from a stale point.
   Use the flush from prompt 17 step 5.
5. Text → audio: read the current `text_offset`, convert with the pure function
   from prompt 17 step 8, and seek. If that function documented a fallback
   because the data has no alignment basis, the destination resumes at the
   chapter start in the new mode — and the UI must SAY so rather than silently
   dropping the listener somewhere arbitrary. State which behaviour is live.
6. Audio → text: read the current `audio_ms`, convert, and restore the scroll
   offset. Same honesty rule: if it falls back, say so in the UI.
7. Seek timing on the audio side: calling `seekTo` immediately after loading a
   track is unreliable — the seek is dropped if the track is not ready
   (doublesymmetry/react-native-track-player#1903). Wait for the track-ready or
   active-track-changed event before seeking, and verify the resulting position
   rather than assuming it took. Report how you confirmed it.
8. Write `last_mode` on every handoff, in the same parity write. That field is
   what lets Library and story detail resume in the correct surface, and a
   handoff that does not update it will send the user back to the wrong one.
9. Use `router.replace`, not `push`, when swapping between M5 and M6 for the same
   chapter. Pushing builds a stack where back-back-back walks the user through
   every handoff they made in a session
   (https://docs.expo.dev/router/basics/navigation/). Verify the Android hardware
   back button exits to the story detail screen, not into a handoff chain.
10. Make the mini player live. It now reflects real playback state from prompt
    19 — cover, chapter title, play/pause, progress — and tapping it opens M6 for
    the currently playing chapter. It must keep playing across tab changes, which
    is why prompt 09 mounted it in the tab layout rather than per screen. Confirm
    it survives navigating Discover → Library → Profile without a gap in audio.
11. Mini-player visibility still follows the prompt-09 route map exactly: present
    on M3, M7, M11; absent on M5 and M6. Absent on M5 specifically because the
    reader owns the screen — but audio must CONTINUE playing while reading. A user
    listening to chapter 4 while reading chapter 7 is a supported state, so do not
    stop playback on entering the reader and do not assume the reader's chapter and
    the player's chapter are the same one.
12. That divergence has a consequence: the parity writer must attribute each write
    to the chapter that produced it, not to "the current chapter". Audit prompt
    17's call sites and confirm a reading write cannot overwrite a listening
    position or vice versa. This is the most likely data-corruption bug in the
    whole app — prove it with a test.
13. ANDROID PERMISSION: a media foreground service needs a visible notification,
    and Android 13+ gates notifications behind the runtime `POST_NOTIFICATIONS`
    permission (https://developer.android.com/develop/ui/compose/notifications/notification-permission).
    Request it at a sensible moment — on first playback, not at launch — and handle
    denial gracefully: playback should still work, with lock-screen controls
    degraded, and the app must not crash or nag.
14. TEARDOWN on both exit paths, for both screens: user-initiated exit and
    unmount. Remove the handoff's listeners, flush the parity write, clear any
    transition state. Deliberately leave the player itself running, per prompt 19
    step 12. State what you tore down and what you left alive.
15. Tests to run and paste: read chapter 3, hand off to audio, confirm the
    position; listen on, hand back to text, confirm the position; hand off while
    offline; hand off with a pending debounced write; background the app mid-
    handoff; read one chapter while listening to another and confirm neither
    position is corrupted; force-quit after a handoff and reopen.

Do not: write your own parity upsert — call prompt 17's module only; persist the
position to AsyncStorage; pass a position through route params or a module
global; stop playback when entering the reader; assume the reader and player are
on the same chapter; push instead of replace between M5 and M6; change any
visual detail, string or colour in M5 or M6; use the gradient outside M6; render
a paywall — prompt 23 owns it; build downloads, Library or Profile.

Finish by running `npx tsc --noEmit`, then paste the algorithm restatement from
step 1, the live behaviour from steps 5 and 6 including any fallback, your seek
confirmation from step 7, the permission handling from step 13, the teardown
inventory from step 14, and all seven test results from step 15.
