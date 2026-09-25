Read AGENTS.md first and follow it strictly. Do only what is on this page.

> Written 2026-09-25 from the owner's decision (AGENTS.md § Decisions —
> 2026-09-25, "Retention and revenue"). Not yet reviewed against the code:
> review it before building, as every prompt is. The number is 23a so that
> no existing prompt's number changes.
>
> BEFORE THIS PROMPT: AGENTS.md § Deferred setup must be done. Remote push
> notifications need the development build: Expo Go cannot receive them on
> Android. STOP until it is.

When a new chapter of a book on a reader's My List is published, their phone
says so. Serial readers come back for new chapters, and this brings them back
at the moment one appears. It is opt-in, and only ever about books the reader
saved. It also gives the bell on Discover, which does nothing yet, a purpose.

Owner, before this prompt:
1. Push credentials for Android: a Firebase project, and its FCM V1 service
   account key uploaded to EAS (`eas credentials`). Expo's push service sends
   through it. The steps are confirmed against Expo's docs at build time.
2. A yes to the migration (step 5) and to the trigger that sends (step 6)
   before `supabase db push`. The trigger watches `chapters`, a table the
   dashboard owns, so it would be the third sanctioned change there, after
   the catalog broadcast triggers and the audio policy. Record it in both
   repos' AGENTS.md.

1. Install `expo-notifications` (approved by the owner on 2026-09-25) with
   `npx expo install`, with its config plugin and an Android notification
   channel, "New chapters". Check the installed surface in `node_modules`
   before writing code, and report its version.
2. **Ask once, at the right moment.** The first time a reader taps
   "+ My List" on M4 and the add succeeds, a small sheet asks "Get notified
   when new chapters come out?" with "Notify me" and "Not now". Only "Notify
   me" shows the system's permission dialog (Android 13+ and iOS). "Not now"
   is remembered, and the app never asks on its own again. M11 (prompt 25)
   gets a "New chapter alerts" switch to turn it on later. Never at launch,
   never on a cold start.
3. **One permission.** The deferred setup decides whether playback controls
   need the Android notification permission (§ Deferred setup, step 9). If
   the reader has already granted it, don't ask again.
4. **The push token.** Get it with `getExpoPushTokenAsync()` and the EAS
   project id. Store it (step 5), register it again when it changes, and
   delete it at sign-out, before `clearUserScopedState()`, so a phone never
   receives the previous account's alerts.
5. **Migration**, in the dashboard repo, with § Phase 2's discipline:
   - `push_tokens`: id, `user_id` text defaulting to the caller's `sub`,
     `token` text unique, platform, `created_at`, `updated_at`. RLS: readers
     select, insert, update and delete their own rows only; `anon` nothing.
   - `notified_chapters`: `chapter_id` primary key (cascading with the
     chapter), `notified_at`. Written only by the server, so a chapter is
     announced once.
6. **Sending, on the server.** When a chapter in a published book first
   becomes readable (it has text or narration), a Supabase Edge Function
   finds the readers with that book in `library_items`, then their tokens,
   and sends through Expo's push API in batches of 100. The service-role key
   and any Expo access token live only in the function's secrets, never in
   the app (AGENTS.md rule 1). Settle at review how the function is called:
   a database webhook on `chapters`, or a trigger through `pg_net`. A chapter
   in a draft book notifies no one.
7. **Bundle and limit.** Several chapters of one book within 10 minutes send
   one notification ("3 new chapters of Eternal Eclipse"). Recommended, to
   settle at review: at most one notification per book per reader per day,
   since too many drive readers to turn them off or uninstall.
8. **Copy and tap.** "New chapter of {book title}", then "Chapter {n}:
   {chapter title}". Tapping it opens M4 for that book, where Read and Listen
   resume, through the notification response listener and `router.push`. It
   works from a cold start too.
9. **Dead tokens.** When Expo's push receipts report `DeviceNotRegistered`,
   the function deletes that token.
10. **The bell on Discover.** Recommended: it opens the "New chapter alerts"
    setting until an inbox of past alerts is wanted. Settle at review.
11. **Analytics** (prompt 21a): `notify_prompt_shown`,
    `notify_prompt_accepted`, `notify_prompt_declined`, and
    `notification_opened` with book_id.

Do not: ask for permission at launch, or more than once on the app's own
initiative; notify about a book that isn't on the reader's My List; send
promotional or marketing notifications; put the service-role key or an Expo
access token in the app; notify a signed-out phone.

Finish by running `npm run typecheck`, `npm run lint` and `npm test`. Then, on
the development build, report:
- the permission flow, including "Not now" never asking again;
- a chapter published in the dashboard reaching a phone with that book on My
  List, and not reaching one without it;
- tapping the notification opening M4, from a cold start too;
- sign-out stopping the alerts.
