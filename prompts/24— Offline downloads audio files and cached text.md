Read AGENTS.md first and follow it strictly. Do only what is on this page.

> **Reviewed 2026-09-28 against the code (prompts 21–23a are built),
> AGENTS.md, `material/` and the live database.** The review's calls are
> recorded in AGENTS.md § Decisions — 2026-09-28, "Downloads (prompt 24
> review)". The model is unchanged: offline copies, the way YouTube and Udemy
> work (§ Decisions — 2026-09-25, "Downloads"). What changed, and the calls
> the owner may want to flip:
> - **Preconditions narrowed** to what this prompt needs: the audio storage
>   policy (deferred setup step 8), a second reader account, and the
>   development build. Google sign-in and the Bluetooth checks don't block it.
> - **Storage permissions are blocked.** `expo-file-system` and `expo-image`
>   (its Glide library) each declare `READ_EXTERNAL_STORAGE`, and
>   `expo-file-system` also `WRITE_EXTERNAL_STORAGE`, up to Android 12. Both
>   are already linked (through `expo`), so the build carries them today:
>   `aapt dump permissions` on build `596d2398` lists both (`maxSdkVersion`
>   32), with `allowBackup` on, and the owner's phone runs Android 12.
>   `android.blockedPermissions` removes them (step 3).
> - **Exact sizes, from one view change.** The dashboard already records each
>   narration's size (`chapters.audio_size_bytes`, equal to the stored file
>   for all 8 on 2026-09-28). `chapters_catalog` gains it and the text's size,
>   so "Download all" states a real size and the disk check is exact.
>   *(Flip: no migration, and estimate from duration times a byte rate, as
>   the earlier draft did. Narration today runs 64 to 384 kbps, so that
>   estimate would be off by up to six times.)*
> - **Only a definite answer deletes a download.** An access check that
>   couldn't fetch every input leaves the download alone.
> - **A changed chapter is found by `updated_at`**, at every online check,
>   not only by a catalog broadcast the app may have missed while closed.
> - **M3 gets an offline state.** Today, offline with nothing cached,
>   Discover shows its skeleton forever: the paused query counts as loading.
>   "See your downloads" lives in that new state.
> - **M9's row sheet offers Listen.** In `material/5.png` the Downloaded
>   disc replaces the teal headphone, so without it a downloaded narrated
>   chapter would lose M9's Listen button. *(Flip: draw both.)*
> - **Analytics:** four events, ids and fixed words only. *(Flip: none.)*
> - **Sign-out's order is fixed:** the queue is stopped and the player
>   released before any file goes. Only `downloads/` is ever deleted:
>   PostHog keeps its event queue and opt-out as files at the root of
>   `Paths.document`.
> - **Frames:** `material/5.png` (M9) is right. Added `material/10.png`, M11's
>   "Downloads & offline storage" row, and `material/3.png`, M3.
> - **Fixed:** chapter text's cache key sits under `chapters`, so step 10
>   matches its prefix, not a root; the Profile placeholder's Downloads link
>   is real, not `__DEV__`; sign-out for check 6 is in `/health` until M11;
>   `allowBackup: false` doesn't stop Android 12+'s device-to-device transfer,
>   and the account tie covers that; autoplay offline never waits on a
>   paused query.

**BEFORE THIS PROMPT — STOP until all of these are true:**
1. AGENTS.md § Deferred setup, **step 8**: the audio storage policy is
   applied and proven with real HTTP requests. Until it is, any signed-in
   reader can sign any narration file, and step 6's "the storage policy is
   the real gate for audio" would be false. **Done 2026-09-28** (dashboard
   migration `20260928140000`; AGENTS.md § Decisions — 2026-09-28, "Audio
   storage policy"). Confirm it is still live before building:
   `npx supabase db query --linked -f supabase/verify/audio_read_policy.sql`
   in the dashboard repo, 20 checks.
2. **Step 5**: a second reader account on the development instance, not an
   admin. Step 8's proof and check 6 below need it. **Done 2026-09-28:**
   `talebrim.reader.b+clerk_test@example.com`, no role, signed in with the
   code `424242` (Clerk sends nothing to a `+clerk_test` address on a
   development instance). The other half of step 5 exists already: locked
   chapters with narration (Whispers In the Mist 4 and 5, Man of Ashes 001
   13), beside free ones with narration (checked 2026-09-28).
3. The development build with prompt 23a (EAS build `596d2398`, 2026-09-28)
   is installed on the owner's phone. This prompt adds a native module and
   changes `app.json`, so it needs one more build after it. **Still open.**
4. **Owner:** a yes to step 4's view migration before `supabase db push`.
   **Given 2026-09-28**, with the rest of this review; still show the
   migration before pushing it.
5. **Owner, not blocking the code:** the two WAV narrations converted to the
   `.m4a` standard (step 2), or a yes to downloading them as they are.
   **Converted 2026-09-28**, waiting for the owner to upload them in the
   dashboard: `C:\Users\PC\Desktop\talebrim-narration\` (AGENTS.md
   § Decisions — 2026-09-25, "Narration format").

Not needed: deferred setup steps 3 and 7 (Google sign-in) and the Bluetooth
checks in step 9.

Design material:
- @material/5.png — M9: "Download all", teal with a download icon, at the
  right of the sort bar; and the Downloaded row's teal disc, which replaces
  the headphone.
- @material/10.png — M11's "Downloads & offline storage" row, in the Reading
  group. Prompt 25 wires it; its label is the Downloads screen's name.
- @material/3.png — M3, for the surface its offline state sits on.

The Downloads screen, the M9 row sheet and M3's offline state have no frame:
build them from M9's rows, the existing sheets and M5's offline state, and
report them for design review.

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
  Android 12 and newer can still copy app data to a new phone in a
  device-to-device transfer, whatever `allowBackup` says; the copy is
  harmless, because the index names its account and another account's
  index is deleted on start (step 11).
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
  (autoplay, previous, next). The player signs through
  `chapterAudioSourceOptions()` and re-mints an expired URL; `resolve.ts`
  fetches the chapter, its book, the settings, the unlocks and the
  entitlement through TanStack, which pauses every one of them offline.
- `chapterAudioSourceOptions()` (`lib/queries/audio.ts`) reads
  `chapters.audio_path` (the second sanctioned direct read of `chapters`)
  and signs it for 6 hours under the reader's Clerk token. It returns
  `signed`, `unavailable` or `refused` (Storage's "Object not found").
- `chapterTextOptions()` (`lib/queries/chapters.ts`) reads one chapter's
  `script_text`, under `queryKeys.chapters.text(id)`: `["chapters", "text",
  id]`. That text sits in the persisted TanStack cache, one AsyncStorage
  value kept 24 hours. AGENTS.md § Before production flags it: a live
  chapter reached 314,950 characters on 2026-09-28, and on Android a value
  past about 2 MB can fail to restore.
- `shouldPersistQuery()` (`lib/query-client.ts`) drops keys by their root
  (`NEVER_PERSISTED`: signed URLs, billing).
- The lock rule: `chapterStateFor()` and `lockStateFor()` (`types/states.ts`)
  take the settings, the unlocks and `isSubscribed` (prompt 22). An input
  not yet known is "can't tell yet", never locked. Billing is off until
  RevenueCat is set up, so every reader is "not subscribed" for now.
- M9: `buildChapterRows()` (`lib/chapter-list.ts`) passes `isDownloaded:
  false` with a `TODO(downloads)`; the Downloaded state and its teal disc
  (`components/chapters/chapter-row.tsx`) are drawn already. Locked beats
  everything, then Reading Now, then Downloaded, then Unlocked
  (`resolveChapterState()`). `chapter-list-header.tsx`'s sort bar has
  `TODO(downloads)` where "Download all" goes. The bottom bar is prompt 22's
  `AdFreeBar`.
- `hooks/use-now-playing.ts` (M6) and `hooks/use-chapter-reader.ts` (M5)
  resolve their states through `waitFor()` (`lib/query-status.ts`), where a
  paused query means offline.
- M3 (`app/(tabs)/index.tsx`) has skeleton, error and empty states, and no
  offline state.
- `lib/session.ts`'s `clearUserScopedState()` runs at sign-out. It calls
  `releaseAudio()` first.
- NetInfo feeds TanStack's `onlineManager` (`lib/query-client.ts`).
  `hooks/use-is-foreground.ts` says whether the app is in front.
- `hooks/use-catalog-sync.ts` and `lib/catalog-sync.ts` receive the
  dashboard's `{ book_ids, chapter_ids }` broadcasts (`chapter_ids` null
  means too many to list).
- The reader settings sheet and M6's options sheet are React Native `Modal`s
  sliding up on `raised`: the pattern for M9's row sheet.
  `components/ui/sheet.tsx` is the frame for sheet routes (M5a, alerts).
- `lib/analytics.ts`'s `track()`, with every event typed in
  `AnalyticsEvents`.
- PostHog keeps its event queue and the analytics opt-out as files at the
  root of `Paths.document` (`.posthog-rn.json`, `.posthog-rn-logs.json`).
- The Profile tab is a placeholder with a `__DEV__`-only link to `/health`,
  and the only sign-out is `/health`'s, until M11 (prompt 25).
- `expo-file-system` 57.0.7 is in `node_modules` and already linked into
  the build, but only as a dependency of `expo`. Its new API:
  - `File`, `Directory` and `Paths`.
  - `File.downloadFileAsync(url, destination, { onProgress, signal })`
    reports progress and cancels (an aborted signal rejects with
    `AbortError`), but cannot resume a download.
  - `Paths.availableDiskSpace`.
  The legacy API (`expo-file-system/legacy`) is the one with
  `createDownloadResumable`.

1. **Dependency.** Add `expo-file-system` with `npx expo install
   expo-file-system`, which makes it a direct dependency. The owner approved
   it on 2026-09-25 (AGENTS.md § Tech Stack). Then rewrite the lock with
   `npx npm@11.12.1 install --package-lock-only` (§ Decisions — 2026-09-25,
   "Development build"). Use the new API only; never mix in the legacy one.
   Report the version.

2. **The narration, before writing code.** Check it against the standard
   (AGENTS.md § Decisions — 2026-09-25, "Narration format"): AAC in `.m4a`,
   mono, 64 kbps, fast start, about 0.5 MB a minute. List every narrated
   chapter's extension, `audio_size_bytes`, the stored object's size and its
   kbps, with a read-only query from the dashboard repo. On 2026-09-28: six
   `.m4a` at about 195 kbps, and two WAV at 384 kbps, Eternal Eclipse 1
   (29 MB) and Man of Ashes 001 1 (31 MB). Both were converted the same
   day (5.3 and 5.6 MB, in `C:\Users\PC\Desktop\talebrim-narration\`) and
   wait for the owner to upload them in the dashboard; once uploaded, their
   `audio_path` ends in `.m4a`. If any WAV remains, report it before
   building: at 2.8 MB a minute, a 40-chapter book is about 1.7 GB.

3. **Storage.** One folder, `downloads/`, under `Paths.document`:
   app-private and persistent. Never `Paths.cache`, which the OS may purge:
   a purged download is the bug readers report as "it deleted my book".
   - Audio is `<chapterId>.<ext>` (the stored file's extension) and text is
     `<chapterId>.txt`. Each is written under a temporary name and renamed
     once complete, so a partial file never looks complete.
   - Nothing else is ever written, renamed or deleted in `Paths.document`:
     PostHog's files sit at its root.
   - `app.json`:
     - `android.allowBackup: false`, so Auto Backup never copies downloads,
       or anything else the app stores, to the reader's Google account.
       Nothing kept on the device needs restoring: the account's data is on
       the server, and SecureStore's keys don't survive a restore anyway.
     - `android.blockedPermissions: ["android.permission.READ_EXTERNAL_STORAGE",
       "android.permission.WRITE_EXTERNAL_STORAGE"]`, removing what
       `expo-file-system` and Glide declare. The app never reads or writes
       shared storage.
   - iOS is out of scope until the owner confirms it (AGENTS.md § Important
     Constraints). If it is built, exclude the folder from iCloud backup.
   - Prove it on the built APK: `aapt dump permissions` (Android SDK
     build-tools, `%LOCALAPPDATA%\Android\Sdk\build-tools\36.0.0\aapt.exe`)
     lists no storage or media permission, and `aapt dump xmltree <apk>
     AndroidManifest.xml` shows `allowBackup` false. Before, on build
     `596d2398`: both storage permissions (`maxSdkVersion` 32) and
     `allowBackup` true. Report the after list.

4. **Exact sizes: one view migration**, in the dashboard repo, with § Phase
   2's discipline (additive, regenerate both repos' types and diff them, the
   dashboard's three gates, `reader_tables_rls.sql` and
   `new_chapter_alerts_rls.sql`), after the owner's yes.
   - `chapters_catalog`, this app's own view (migration `20260920000001`),
     gains two columns at its end: `audio_size_bytes` (the dashboard's
     recorded size) and `text_bytes` (`octet_length(script_text)`, the text
     file's size). `create or replace view` may only append columns; restate
     `with (security_invoker = on)` and prove it held (`pg_class.reloptions`).
   - No other change: no new policy, and nothing on `books` or `chapters`.
     M4's and M9's queries keep their explicit columns.
   - A chapter whose `audio_size_bytes` is null (none on 2026-09-28) counts
     its duration at 64 kbps, and the confirmation then says "about".

5. **The index**: a Zustand store, `store/downloads-store.ts`, persisted to
   AsyncStorage with `version` and `migrate` from its first commit
   (AGENTS.md § store/).
   - Per chapter, it holds:
     - the account and the book
     - each file, its extension and its real size on disk
     - `verifiedAt`, when access was last confirmed online
     - the chapter's `updated_at` and the `audio_path` it was downloaded
       from, to notice a change (step 8). Never a signed URL.
     - what M5 and M6 need to open the chapter with no network and nothing
       cached: the chapter's number, title, `has_text`, `has_audio` and
       duration, and the book's title, author and cover path
   - No table, no column, and no sync across devices. It is cleared at
     sign-out, with the files (step 11).
   - Not on the hydration gate, as the `notifications` slice isn't (AGENTS.md
     § store/). Whatever decides "downloaded or not" (M5, M6, M9, the
     Downloads screen, the player's resolve) waits for it to rehydrate, so a
     cold start offline never shows a downloaded chapter as missing.
   - Reconcile it on app start. An entry whose file is missing is pruned; a
     file no entry lists is deleted. Report what you pruned in `__DEV__`.

6. **What may be downloaded**: only a chapter the reader can open now,
   resolved through `chapterStateFor()` against fresh settings, unlocks and
   the entitlement. Never a Locked one, and never while any of those is
   "can't tell yet".
   - Once step 8 of the deferred setup is live, the storage policy is the
     real gate for audio: it will not sign a locked chapter. For text, this
     check is the only gate, the same gap AGENTS.md § Before production
     records.
   - A `refused` signing drops the chapter from the queue, with its reason,
     and it isn't retried. Known gap until the entitlement mirror (prompt
     22a): the policy doesn't know subscribers, so a subscriber's locked
     chapter can't be downloaded yet. It fails as refused, and deletes
     nothing already downloaded.

7. **Downloading.**
   - Audio: sign with `chapterAudioSourceOptions()`, then download with
     `File.downloadFileAsync()`, using `onProgress` and an `AbortSignal`. If
     a URL expires mid-queue, sign it again and carry on.
   - Text: through `chapterTextOptions()`'s query, on its sanctioned-read
     terms, written to `<chapterId>.txt`.
   - One chapter at a time, in one queue, and never in parallel.
   - Foreground only: no background-download library. Leaving the app
     (`useIsForeground()`) aborts the chapter in flight, and returning
     continues the queue from it. Going offline pauses the queue the same
     way, and reconnecting resumes it (`onlineManager`). The new API can't
     resume a file, so that chapter starts over, but chapters already done
     stay done. Say so in the summary, so the copy stays honest.
   - Each chapter is queued, downloading (with a real percentage), done,
     failed (with the reason) or cancelled.
   - Before each chapter, check `Paths.availableDiskSpace` against its exact
     size (step 4) plus a margin. A full disk fails that chapter with a
     clear message, leaves no partial file, and stops the queue.

8. **Keeping access honest, the YouTube rule.**
   - Online, check every downloaded chapter against fresh settings, unlocks,
     the entitlement and `chapters_catalog` (one query for all of them). Do
     it at app start and on return to the foreground (at most once a day),
     and before opening a download.
   - **Only a definite answer changes anything.** Every input fetched fresh,
     and the lock rule says open: update `verifiedAt`. Every input fetched
     fresh, and the chapter is locked now, or gone from `chapters_catalog`
     (unpublished or deleted): delete its files and its entry. Anything
     else (a failed fetch, an entitlement not yet known, offline) changes
     nothing.
   - A chapter whose `updated_at` moved since its download gets its text
     again. Its `audio_path` is read again, on the sanctioned terms, and its
     narration downloaded again only if the path changed (the dashboard
     writes a new path for every replacement). A catalog broadcast that
     names a downloaded chapter, or `chapter_ids: null` for its book, runs
     this check for it at once, instead of waiting for the next one.
   - Offline, a download plays and reads for 30 days after its `verifiedAt`.
     Past that, M5 and M6 show "Connect to the internet to keep this chapter
     offline" instead of opening it, and the next online check either
     restores it or deletes it.
   - The owner settled 30 days on 2026-09-25, as Spotify does. Keep it in
     one constant.

9. **Opening a download.**
   - The player and M6 load a downloaded chapter from its file (`replace({
     uri })`) and never sign a URL, re-mint or touch the network for it.
     `useNowPlaying` doesn't wait for the signed-URL query for it.
   - `resolve.ts`, offline, resolves a downloaded chapter from the index,
     never from a paused query. Autoplay offline moves to the book's next
     downloaded chapter by number, if there is one, and otherwise stops at
     the end of the chapter, as at the end of a book: it never waits.
   - M5 reads a downloaded chapter's text from its file, with no network
     wait. A query that has to run offline needs `networkMode: "always"`, or
     the read happens outside the query.
   - After a cold start with no network and nothing cached, M5 and M6 open a
     downloaded chapter from the index's metadata. The download's
     `verifiedAt`, within its 30 days, stands in for the lock check.
   - Online, the file is still what plays and reads.
   - Parity is unchanged: positions still record through `lib/parity`, and
     wait in its queue while offline.

10. **Chapter text leaves the persisted cache.** Downloads now give text its
    own storage, so `shouldPersistQuery()` drops every key under
    `queryKeys.chapters.textAll()`. It is nested under `chapters`, so match
    that prefix; `NEVER_PERSISTED`'s roots can't express it, and the rest of
    `chapters` stays persisted. That closes the ~2 MB risk. Recently read
    text stays in memory for the session, and offline reading is what
    downloads are for. Update that entry in AGENTS.md § Before production.

11. **Sign-out deletes every download**, in `clearUserScopedState()`, in this
    order: stop the queue and abort the chapter in flight; `releaseAudio()`
    (already first), so no downloaded chapter is loaded when its file goes;
    then delete `downloads/` and the index. Never `Paths.document` itself.
    On app start, an index written under another account, or `downloads/`
    files with no index, are deleted the same way, which covers a sign-out
    that crashed halfway and a device-to-device copy.

12. **Where readers download and manage downloads.**
    - M9's "Download all", teal with its download icon as the frame draws
      it, at the `TODO(downloads)` in the sort bar. It downloads every
      chapter the reader can open that isn't downloaded yet.
      - Before it starts, it confirms the chapter count and the size from
        step 4 ("12 chapters, 48 MB").
      - On mobile data (NetInfo), the confirmation says so.
      - While it runs, the same slot shows "12 of 41" and Cancel.
      - With nothing left to download, it is disabled and reads "All
        downloaded".
    - M9's rows:
      - Downloaded shows the teal disc (prompt 20's state, now real:
        `isDownloaded` from the index). Reading Now still wins.
      - A row in the queue shows, in the same slot, its percentage while it
        downloads and "Queued" before, in `muted`.
      - Long-pressing an openable row opens a small `raised` sheet, on the
        reader settings sheet's `Modal` pattern: "Listen" when the chapter
        has narration (the frame's disc takes the headphone's place), then
        "Download chapter" or "Remove download". Screen readers get the same
        actions as accessibility actions, and the disc, a sibling button
        (never one inside the row's), opens the same sheet. The owner settled
        long-press on 2026-09-25: no frame has a per-chapter download button,
        so don't add one. A Locked row has no sheet: its tap opens M5a, as
        now.
      - Removing one chapter needs no confirmation.
    - The Downloads screen, `app/downloads.tsx`, a pushed route registered
      in the root navigator's signed-in guard, lists the downloaded books
      from the index, with no network needed.
      - Each book shows its cover (from `expo-image`'s cache, or the flat
        placeholder offline: covers are never downloaded), its chapters and
        its real size on disk. A chapter past its 30 days says "Connect to
        keep offline".
      - A chapter opens in M5 or M6.
      - The total on disk, and the phone's free space.
      - A book can be removed, and "Remove all downloads" takes the one
        confirmation.
      - M11's "Downloads & offline storage" row opens it (prompt 25). Until
        M11 is built, the Profile placeholder gets a plain "Downloads" button
        to it, in every build, not only `__DEV__`.
    - M3 gains an offline state: the tab's query paused with nothing cached
      (today that shows the skeleton forever). It says the reader is
      offline, and offers an outlined "See your downloads" whenever
      anything is downloaded. The hero's "Read or Listen" stays the screen's
      one ember action; offline, there is none.
    - M7 (Library) gets no downloads segment: its frame shows Books and
      Audiobooks only.

13. **Analytics** (prompt 21a), in `AnalyticsEvents`, ids and fixed words
    only:
    - `download_requested`: `book_id`, `chapters` (a count) and `from`
      (`download_all` or `row`).
    - `download_failed`: `kind` (`disk_full`, `refused`, `network`,
      `other`).
    - `download_removed`: `scope` (`chapter`, `book` or `all`).
    - `offline_chapter_opened`: `mode` (`text` or `audio`), when M5 or M6
      opens a download with no network.

14. **Look and accessibility.**
    - Download controls are teal or `muted`, never ember. Progress bars are
      exempt from the one-ember rule.
    - No gradient. Tokens only: raw hex lives in `src/global.css`'s `@theme`
      block.
    - Every state is said in words, progress as a percentage.
    - 44dp targets, and each remove action is labelled with what it removes.
    - `Alert` only for "Remove all downloads" and Download all's size
      confirmation.

15. **Tests**, with `expo-file-system` mocked as `player.test.ts` mocks
    `expo-audio`:
    - reconciling the index, and deleting another account's
    - the access check: still allowed, lost, unpublished, and a failed
      input that deletes nothing
    - a changed `updated_at`, and a changed `audio_path`
    - the 30-day window
    - the size from step 4, and its 64 kbps fallback
    - a full disk leaving no partial file
    - sign-out's order, and that nothing outside `downloads/` is touched
    - chapter text never persisted, and the rest of `chapters` still is
    - M9's rows with `isDownloaded` and the queue's states
      (`lib/__tests__/chapter-list.test.ts`)

Do not:
- write, rename or delete anything in `Paths.document` outside `downloads/`,
  use shared storage or the media library, or request a storage or media
  permission.
- keep a download after sign-out, or open one more than 30 days after it was
  last verified.
- download a Locked chapter, retry a refused one, or delete a download on
  anything but a definite answer.
- keep a signed URL in the index or anywhere on disk.
- download covers, or new chapters by themselves (a new-chapter alert opens
  M4; it downloads nothing).
- create a downloads table, column or policy, change any view but
  `chapters_catalog` as step 4 says, or sync downloads across devices.
- add a background-download library, download in parallel, or mix the
  legacy and new `expo-file-system` APIs.
- encrypt files in this version, or add a DRM library.
- persist chapter text in the TanStack cache.
- change M5's or M6's design beyond the offline notice in step 8, or alter
  any table.
- build the copy or accessibility passes (prompts 26 and 27).

Finish by running `npm run typecheck`, `npm run lint` and `npm test` here,
and the dashboard's three gates and both RLS verifications there. Record the
build in both repos' AGENTS.md. Then report:
- the `expo-file-system` version, and the narration's formats and sizes
  (step 2)
- the storage folder, the built APK's permissions before and after, and
  `allowBackup`
- every `TODO(downloads)` you replaced
- the device checklist below, run on a development build made after this
  prompt. Say which items you could run yourself.
  1. Download all on a book: the size confirmation, the progress, then every
     openable row shows Downloaded.
  2. In airplane mode, a downloaded chapter plays and reads, and autoplay
     moves to the next downloaded chapter. One that isn't downloaded shows
     the offline state, not a spinner.
  3. Force-quit in airplane mode and reopen: M3 shows its offline state with
     "See your downloads", and Profile → Downloads opens a downloaded
     chapter.
  4. Leave the app mid-download and come back: the queue continues, the
     interrupted chapter restarts, and no half-written file is left behind.
  5. Check the phone's Files and Music apps: the downloads appear nowhere
     outside Talebrim. The permission list from step 3 has no storage
     permission.
  6. Sign out (Profile → "DEV: Open health probe" → Sign out, until M11),
     then sign in as the second reader
     (`talebrim.reader.b+clerk_test@example.com`, code `424242`): there
     are no downloads.
  7. Remove one chapter, one book, then everything: the Downloads screen
     shows the space freed each time.
  8. Lose access: in the dashboard, set a chapter past the free ones
     (Whispers In the Mist 4) to free, download it, set it back to locked,
     then reopen the app online: its download is gone. Chapters 1 to 3 are
     free by position whatever their access says, so they can't show this.
