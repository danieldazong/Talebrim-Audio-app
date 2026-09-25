Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Revised 2026-09-25, at the owner's request, after the prompt 20 review.
> Downloads follow the offline-only model below, the way YouTube and Udemy
> work. It folds in the earlier notes: there is no Edge Function (prompt 18),
> and M9's "Download all" is added here, not wired up (prompt 20). Prompts
> 21–23 land before this one, so review this page against the code again
> before building it. Decisions are in AGENTS.md § Decisions — 2026-09-25,
> "Downloads". Features not yet built are named in markers, never numbered.
>
> BEFORE THIS PROMPT: AGENTS.md § Deferred setup must be done. `allowBackup`,
> the manifest check and the storage checks need the development build.

Design material: @material/5.png (M9's "Download all" and Downloaded disc).
The Downloads screen and the M9 row sheet have no frame: build them from
M9's rows and the existing sheets, and report them for design review.

## The model: offline copies, not files the reader owns

A download is a copy the app keeps so that a chapter plays and reads with no
connection. It is not a file saved to the phone:
- It lives in the app's private storage: never shared storage (Downloads,
  Music, the gallery), never the media library, and no storage or media
  permission.
- Only this app can play or show it. File names are opaque: the chapter id.
- It belongs to the signed-in account. Sign-out deletes every download.
- It stays usable only while the reader still has access. When online, the
  app checks again, and deletes a chapter the reader has lost. Offline, a
  download works for 30 days after its last check, then waits for a
  connection.
- It is kept out of phone backups, and goes when the app is uninstalled.
- It is not encrypted in this version. Android's app-private storage already
  keeps other apps and the reader out, short of a rooted phone. Encrypting
  would need a native player that decrypts as it plays, because `expo-audio`
  plays ordinary files. Revisit with a DRM decision if the business needs
  one.

A chapter's download is its narration, if it has one, and its text, if it
has one: two files in the same private folder. "Downloaded" means every part
the chapter has is on disk, so it is never true for one and false for the
other.

What exists. Build on it, not around it:
- `lib/audio/player.ts`, the one player, and `lib/audio/resolve.ts`
  (autoplay, previous, next).
- `chapterAudioSourceOptions()` (`lib/queries/audio.ts`) signs a narration
  URL for 6 hours under the reader's Clerk token. The storage policy from the
  deferred setup refuses a chapter the reader may not play.
- `chapterTextOptions()` reads one chapter's `script_text`. Today that text
  sits in the persisted TanStack cache: one AsyncStorage value, kept 24
  hours. AGENTS.md § Before production flags it: live chapters reach about
  315,000 characters, and on Android a value past about 2 MB can fail to
  restore.
- `hooks/use-now-playing.ts` (M6) and `hooks/use-chapter-reader.ts` (M5).
- M9 computes Downloaded through `chapterStateFor()`'s `isDownloaded`, always
  false, and leaves `// TODO(downloads)` where "Download all" goes.
- `lib/session.ts`'s `clearUserScopedState()` runs at sign-out.
- NetInfo already feeds TanStack's `onlineManager` (`lib/query-client.ts`).
- `expo-file-system` 57.0.7 is in `node_modules`, but only as a dependency
  of `expo`, not of this app. Its API:
  - `File`, `Directory` and `Paths`.
  - `File.downloadFileAsync(url, destination, { onProgress, signal })`
    reports progress and cancels, but cannot resume a download.
  - `Paths.availableDiskSpace`.
  The legacy API (`expo-file-system/legacy`) is the one with
  `createDownloadResumable`.

1. Dependency. Add `expo-file-system` with `npx expo install
   expo-file-system`. The owner approved it on 2026-09-25, and it is in
   AGENTS.md § Tech Stack. Use the new API only; never mix in the legacy
   one. Report the version.

2. Before writing code, check the narration against the standard decided on
   2026-09-25 (AGENTS.md § Decisions — 2026-09-25, "Narration format"): AAC
   in `.m4a`, mono, 64 kbps, with fast start, about 0.5 MB a minute. List
   every narrated chapter's `audio_path` extension and object size, with a
   read-only query from the dashboard repo, as that review did. If any WAV
   remains, report it before building: at about 2.8 MB a minute, a
   40-chapter book downloads as about 1.7 GB.

3. Storage. One folder, `downloads/`, under `Paths.document`: app-private
   and persistent. Never `Paths.cache`, which the OS may purge, and a purged
   download is the bug readers report as "it deleted my book".
   - Audio is `<chapterId>.<ext>` and text is `<chapterId>.txt`. Each is
     written under a temporary name and renamed once complete, so a partial
     file never looks complete.
   - Android: set `android.allowBackup: false` in `app.json`, so Auto
     Backup never copies downloads, or anything else the app stores, to the
     reader's Google account. Nothing kept on the device needs restoring:
     the account's data is on the server, and SecureStore's keys don't
     survive a restore anyway. It needs a rebuild of the development build.
   - iOS is out of scope until the owner confirms it (AGENTS.md § Important
     Constraints). If it is built, exclude the folder from iCloud backup.
   - Prove the built Android manifest holds no storage or media permission.

4. The index: a Zustand store, `store/downloads-store.ts`, persisted to
   AsyncStorage with `version` and `migrate` from its first commit
   (AGENTS.md § store/).
   - Per chapter, it holds:
     - the account and the book
     - each file and its real size
     - `verifiedAt`, when access was last confirmed online
     - what M5 and M6 need to open the chapter with no network and nothing
       cached: the chapter's number, title, `has_text`, `has_audio` and
       duration, and the book's title, author and cover path
   - No table, no column, and no sync across devices. It is cleared at
     sign-out, with the files (step 10).
   - Reconcile it on app start. An entry whose file is missing is pruned; a
     file no entry lists is deleted. Report what you pruned in `__DEV__`.

5. What may be downloaded: only a chapter the reader can open now, resolved
   through `chapterStateFor()` against fresh settings, unlocks and the
   subscription entitlement. Never a Locked one.
   - The storage policy is the real gate for audio: it will not sign a
     locked chapter. For text, this check is the only gate, the same gap
     AGENTS.md § Before production records.
   - A refused signing means the reader has lost access: drop the chapter
     from the queue, and don't retry it.

6. Downloading.
   - Audio: sign with `chapterAudioSourceOptions()`, then download with
     `File.downloadFileAsync()`, using `onProgress` and an `AbortSignal`. If
     a URL expires mid-queue, sign it again and carry on.
   - Text: through `chapterTextOptions()`'s query, on its sanctioned-read
     terms, written to `<chapterId>.txt`.
   - One chapter at a time, in one queue, and never in parallel.
   - Foreground only: no background-download library. Leaving the app aborts
     the chapter in flight, and returning continues the queue from it. The
     new API can't resume a file, so that chapter starts over, but chapters
     already done stay done. Say so in the summary, so the copy stays honest.
   - Each chapter is queued, downloading (with a real percentage), done,
     failed (with the reason) or cancelled.
   - Check `Paths.availableDiskSpace` before writing. A full disk fails that
     chapter with a clear message, leaves no partial file, and stops the
     queue.

7. Keeping access honest, the YouTube rule.
   - Online, check every downloaded chapter against fresh settings, unlocks,
     the entitlement and `chapters_catalog`. Do it at app start and on return
     to the foreground (at most once a day), and before opening a download.
     If access still holds, update `verifiedAt`. If the chapter is locked
     now, unpublished or deleted, delete its files and its entry.
   - Offline, a download plays and reads for 30 days after its `verifiedAt`.
     Past that, M5 and M6 show "Connect to the internet to keep this chapter
     offline" instead of opening it, and the next online check either
     restores it or deletes it.
   - The owner settled 30 days on 2026-09-25, as Spotify does. Keep it in
     one constant.

8. Opening a download.
   - The player and M6 load a downloaded chapter from its file (`replace({
     uri })`) and never sign a URL or touch the network. `useNowPlaying`
     doesn't wait for the signed-URL query for it, and `resolve.ts` uses the
     file too.
   - M5 reads a downloaded chapter's text from its file, with no network
     wait. A query that has to run offline needs `networkMode: "always"`, or
     the read happens outside the query.
   - After a cold start with no network and nothing cached (the cache is
     gone after 24 hours), M5 and M6 open a downloaded chapter from the
     index's metadata. The download's `verifiedAt`, within its 30 days,
     stands in for the lock check.
   - Online, the file is still what plays and reads. When catalog sync
     reports the chapter changed, download its text again, and its audio if
     the narration changed, rather than keep a stale copy.
   - Parity is unchanged: positions still record through `lib/parity`, and
     wait in its queue while offline.

9. Chapter text leaves the persisted cache. Downloads now give text its own
   storage, so `shouldPersistQuery()` drops `chapters.text` too, which closes
   the ~2 MB risk. Recently read text stays in memory for the session, and
   offline reading is what downloads are for. Update that entry in AGENTS.md
   § Before production.

10. Sign-out deletes every download: the files, the folder, the index and the
    queue, in `clearUserScopedState()`, before another account can sign in.
    On app start, an index written under another account is deleted the same
    way, which covers a sign-out that crashed halfway.

11. Where readers download and manage downloads.
    - M9's "Download all", teal as the frame draws it, downloads every
      chapter the reader can open that isn't downloaded yet.
      - Before it starts, it confirms the chapter count and an approximate
        size ("about 1.2 GB"). The size is the chapters' durations times
        the byte rate of a chapter already downloaded, or, with none yet, of
        one HEAD request on the first chapter's signed URL.
      - On mobile data (NetInfo), the confirmation says so.
      - While it runs, the same slot shows "12 of 41" and Cancel.
      - With nothing left to download, it is disabled and reads "All
        downloaded".
    - M9's rows:
      - Downloaded shows the teal disc (prompt 20's state, now real).
      - Long-pressing an openable row opens a small `raised` sheet with
        "Download chapter" or "Remove download". Screen readers get the same
        two as accessibility actions, and the disc opens the same sheet. The
        owner settled long-press on 2026-09-25: no frame has a per-chapter
        download button, so don't add one.
      - Removing one chapter needs no confirmation.
    - A Downloads screen, `app/downloads.tsx`, lists the downloaded books
      from the index, with no network needed.
      - Each book shows its chapters and its real size on disk.
      - A chapter opens in M5 or M6.
      - A book can be removed, and "Remove all downloads" takes the one
        confirmation.
      - M11's "Downloads & offline storage" row opens it (prompt 25). Until
        M11 is built, the Profile placeholder links to it, as it does to
        `/health`.
    - M3's offline state gains "See your downloads" whenever anything is
      downloaded, so a reader who is offline can find them.
    - M7 (Library) gets no downloads segment: its frame shows Books and
      Audiobooks only.

12. Look and accessibility.
    - Download controls are teal or `muted`, never ember. Progress bars are
      exempt from the one-ember rule.
    - No gradient. Tokens only: raw hex lives in `src/global.css`'s `@theme`
      block.
    - Every state is said in words, progress as a percentage.
    - 44dp targets, and each remove action is labelled with what it removes.
    - `Alert` only for "Remove all downloads" and Download all's size
      confirmation.

13. Tests, with `expo-file-system` mocked as `player.test.ts` mocks
    `expo-audio`:
    - reconciling the index
    - the access check: still allowed, lost, and unpublished
    - the 30-day window
    - the size estimate
    - a full disk leaving no partial file
    - sign-out clearing the files, the index and the queue

Do not:
- write outside `Paths.document`'s `downloads/`, use shared storage or the
  media library, or request a storage or media permission.
- keep a download after sign-out, or open one more than 30 days after it was
  last verified.
- download a Locked chapter, or retry a refused one.
- create a downloads table, column, view or policy, or sync downloads across
  devices.
- add a background-download library, download in parallel, or mix the legacy
  and new `expo-file-system` APIs.
- encrypt files in this version, or add a DRM library.
- persist chapter text in the TanStack cache.
- change M5's or M6's design beyond the offline notice in step 7, or alter
  any table.
- build the copy or accessibility passes (prompts 26 and 27).

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then
report:
- the `expo-file-system` version, and the narration format and byte rate
  (step 2)
- the storage folder, the built manifest's permissions, and `allowBackup`
- every `TODO(downloads)` you replaced
- the device checklist below, run on the development build. Say which items
  you could run yourself.
  1. Download all on a book: the size confirmation, the progress, then every
     openable row shows Downloaded.
  2. In airplane mode, a downloaded chapter plays and reads. One that isn't
     downloaded shows the offline state, not a spinner.
  3. Force-quit in airplane mode and reopen: Profile → Downloads opens a
     downloaded chapter, and M3's offline state links there.
  4. Leave the app mid-download and come back: the queue continues, the
     interrupted chapter restarts, and no half-written file is left behind.
  5. Check the phone's Files and Music apps: the downloads appear nowhere
     outside Talebrim.
  6. Sign out, then sign in as the second reader: there are no downloads.
  7. Remove one chapter, one book, then everything: the Downloads screen
     shows the space freed each time.
  8. In the dashboard, lock a downloaded chapter that is past the free ones,
     then reopen the app online: its download is gone.
