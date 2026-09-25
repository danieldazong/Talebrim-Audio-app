Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revision note, 2026-09-24 (prompt 18 review). There is no Edge Function:
> a download signs with `chapterAudioSourceOptions()` (prompt 18), under
> the storage policy that checks entitlement. Rewrite step 3 at this
> prompt's review. See AGENTS.md § Decisions — 2026-09-24, "Audio".
>
> Revision note, 2026-09-25 (prompt 20 review). M9 does not render "Download
> all": nothing stood behind it, so it is left at `// TODO(downloads)`. Step
> 11 adds it, from `material/5.png`, rather than wiring an inert button. M9's
> Downloaded state is computed through `chapterStateFor()`'s
> `isDownloaded` flag, which is always false until then. Markers in the code
> read `TODO(downloads)`, not `TODO(25)`. See AGENTS.md § Decisions —
> 2026-09-25, "M9".

AUDIO DOWNLOAD AND TEXT CACHING ARE TWO SEPARATE MECHANISMS. Do not build one
abstraction over both — audio is a file on disk, text is a persisted query
entry, and conflating them produces a "downloaded" state that is true for one
and false for the other.

1. Before writing code, check the installed `expo-file-system` API surface. SDK
   54 introduced a new object-based API (`File`, `Directory`, `Paths`) alongside
   the legacy one (https://docs.expo.dev/versions/latest/sdk/filesystem/,
   https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/). Open it in
   `node_modules`, confirm which API this version exposes, and use one
   consistently. Report the version and the API you chose. Do not mix them.
2. AUDIO — store files under a dedicated app directory, never the cache
   directory, since the OS may purge a cache at will and a purged download is
   the bug users report as "it deleted my book". Exclude the directory from
   iCloud/iTunes backup
   (https://developer.apple.com/documentation/foundation/urlresourcekey/isexcludedfrombackupkey)
   — audiobook files are re-downloadable and Apple rejects apps that bloat
   backups with regenerable data.
3. Signed URLs and downloads: the `audio` bucket is PRIVATE per prompt 19, so a
   download must mint a signed URL from the same Edge Function, which checks
   entitlement server-side before signing. Expiry does not affect the stored
   file — the download fetches once and the bytes are yours — but it does mean a
   long or resumed download can outlive its URL, so re-mint on an auth failure
   and continue rather than failing the whole download.
4. Do not download a chapter the user is not entitled to. Resolve with
   `resolveChapterState()` first: free within the live `free_chapters_at_start`,
   an `unlocks` row, or an active RevenueCat entitlement. The server check in the
   Edge Function is the real gate; the client check exists so the UI never offers
   an action that will be refused.
5. DOWNLOADED IS LOCAL DEVICE STATE, NOT A TABLE. Keep the index of what is on
   disk in the prompt-08 Zustand store, persisted to AsyncStorage — paths, sizes,
   chapter ids and a completion flag. Do not create a downloads table, do not add
   a column anywhere, and do not sync it across devices. Prompt 14's schema is
   final for this phase.
6. Reconcile the index against the filesystem on app start. A file can vanish —
   an OS purge, a restore to a new device, a manual clear — and an index claiming
   a file that is not there produces a chapter that says "downloaded" and then
   fails to play. Verify existence, prune stale entries, and report what you
   pruned in development.
7. Download lifecycle: queue, in progress with real percentage, paused, complete,
   failed, and cancelled. Use a resumable download so a dropped connection does
   not restart from zero
   (https://docs.expo.dev/versions/latest/sdk/filesystem-legacy/ documents
   `createDownloadResumable`; confirm the equivalent in the API you chose).
   Persist enough state that an interrupted download can resume after an app
   restart, or fail cleanly — do not leave a half-written file that looks
   complete.
8. Do NOT add a background-download library. True background downloading needs
   native session work and is out of scope; downloads run while the app is
   foregrounded, and must pause and resume gracefully on backgrounding rather
   than silently dying. State this limitation in your summary so the UI copy can
   be honest about it.
9. TEXT CACHING is entirely separate: it is the TanStack persisted cache from
   prompt 03 plus the long `staleTime`/`gcTime` from prompt 16. To make a book
   readable offline, prefetch its chapters' `script_text` into that cache — one
   chapter at a time, bounded, with a cap. Never prefetch a 200-chapter serial in
   one pass, and never write chapter text to the filesystem as a parallel store.
   Confirm the persister's `maxAge` is long enough that cached text survives to
   be useful.
10. Never cache or download locked text. Prompt 16 step 9 gates the query itself
    for exactly this reason: locked text written to a persisted cache on disk is a
    paywall bypass that outlives the session.
11. Wire the affordances left inert by earlier prompts: the "Downloaded" row
    state in M9 (prompt 21 step 6, marked `// TODO(25)`), "Download all" in M9
    (step 9), and the Downloads segment in Library (prompt 22 step 10). Replace
    every `// TODO(25)` marker and list what you replaced. "Download all" must
    queue sequentially with a visible aggregate progress and a cancel — it must
    not fire 200 parallel requests.
12. Deletion: per chapter, per book, and a clear-all. Deleting must remove the
    file, update the index, and free the space immediately. Show real sizes from
    the filesystem, never an estimate. Confirm deletion for a destructive
    clear-all, but not for a single chapter.
13. Storage pressure: handle a failed write from a full disk with a clear message
    rather than a crash, and never leave a partial file behind after a failure.
14. Offline playback path: when a chapter has a local file, the prompt-19 player
    must load from disk and never touch the network or mint a URL. Verify in
    airplane mode that a downloaded chapter plays and a non-downloaded one fails
    with a clear offline message, not a spinner.
15. Visual rules: download controls are `muted` or outline — the download button
    is never the screen's ember element. Progress indicators are exempt from the
    one-ember rule. No gradient, no raw hex outside `tailwind.config.js`.
16. States and accessibility: every download state announced rather than conveyed
    by icon alone, progress announced as a percentage, 44dp targets, and a delete
    action labelled with what it deletes. No `Alert.alert` except the one
    destructive clear-all confirmation.

Do not: create a downloads table, column, view or policy; sync download state
across devices; store audio in the cache directory or an iCloud-backed location;
download or cache locked content; write chapter text to the filesystem; add a
background-download library or a native background session; download in parallel
batches; mix the legacy and new `expo-file-system` APIs; change the player's
visual design; alter any table; build the accessibility or copy pass — prompts
27 and 28 own those.

Finish by running `npx tsc --noEmit`, then paste the `expo-file-system` version
and API from step 1, the storage directory and backup-exclusion proof from step
2, the list of `// TODO(25)` markers replaced, and airplane-mode test results
for: a downloaded chapter playing from disk, a downloaded chapter's text opening
offline, a non-downloaded chapter failing clearly, and an interrupted download
resuming.
