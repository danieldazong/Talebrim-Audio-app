Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/11-library.png — ensure everything is as is
shown. This is the first screen where `library_items` and `reading_positions`
are read for real, and the first where the app writes on the user's behalf.

1. Replace the Library placeholder at `app/(tabs)/library.tsx`. It keeps the tab
   bar and the mini player, which the prompt-09 map lists as present on M7 —
   bottom padding must use the measured value so the last row is never hidden.
2. Segmented control as shown. If a segmented component is not already a
   dependency, build it from the prompt-02 primitives rather than adding a
   package; `@react-native-segmented-control/segmented-control` renders the iOS
   system control (https://docs.expo.dev/versions/latest/sdk/segmented-control/)
   which will not match the nocturnal design. Say what you chose. The segments
   filter in place and must not push a route or change the bottom tab.
3. "Continue reading" comes from `getResumeTarget()` — prompt 17 step 11 — not a
   new query. It returns the most recent position per book using the
   `(user_id, book_id, updated_at desc)` index, plus `last_mode`. The card's
   action must respect `last_mode`: a user who was listening resumes into M6, a
   user who was reading resumes into M5. Sending a listener back to the reader is
   the exact failure the parity work exists to prevent.
4. If there are no positions at all, the Continue section renders nothing —
   collapse it entirely rather than showing an empty card or a placeholder cover.
5. "My List" reads `library_items` for this user, ordered `created_at desc` per
   the prompt-14 decision. There is no `sort_order` column, so do not implement
   drag-to-reorder and do not add a sort control the design does not show. Join
   to `books_catalog` for the display fields — never to `books` — and select
   explicit columns.
6. Wire "Add to My List" for real, replacing the `// UNBACKED` local state left
   in M4 by prompt 13. Insert into `library_items` and rely on the
   `(user_id, book_id)` unique constraint for idempotency — use `upsert` with
   `onConflict` rather than checking first, so a double tap cannot create a
   duplicate or throw. Do not send `user_id`; the column defaults to the Clerk
   claim and RLS re-asserts it.
7. Removal deletes the row. Both add and remove use `useMutation` with an
   optimistic update and a rollback on failure
   (https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates),
   then invalidate ONLY the library keys — not the catalogue keys, which are
   unaffected and expensive to refetch on a ~450 ms floor. A toggle must feel
   instant; a spinner on a bookmark is a failure.
8. Update M4's button in this same prompt so the two ends cannot drift: it reads
   real membership, toggles through the same mutation module, and reflects the
   optimistic state. One mutation module, consumed by both screens — do not write
   a second insert path.
9. Grid layout with `FlatList` and `numColumns` (https://reactnative.dev/docs/flatlist),
   virtualised, with `keyExtractor` and a stable item height. Covers at 12dp via
   the `Cover` primitive through `expo-image`; null `cover_path` renders the local
   `cover-placeholder.png`. No remote placeholder service, no generated artwork,
   no hotlinked URL.
10. Downloads segment, if the design shows one: downloaded state is LOCAL DEVICE
    state, not a table, and prompt 25 owns it. Render the segment with an honest
    empty state and a `// TODO(25)` marker. Do not invent a downloads table and do
    not show a fake count.
11. Progress indicators on cards derive from `reading_positions` only. Do not
    compute a percentage you cannot support — if a chapter's duration or length is
    unknown, show position without a percentage rather than a fabricated bar.
    Duration always through `formatDuration()`; null renders the unknown label,
    never `00:00`.
12. The Continue card's resume action is the single ember element on this screen
    with an `ink #1A1420` label. Segment selection, the remove affordance and
    everything else is `muted` or outline. Teal is for the audio badge only.
13. Per-segment states, all surface-matched on `plum-deep` and all distinct: a
    genuinely empty My List with a written invitation to browse, distinct from a
    loading skeleton, distinct from an inline error with retry. An empty library
    is the default state for every new user, so it must look intentional rather
    than broken. No `Alert.alert`, no red toast.
14. Sign-out safety: after `clearUserScopedState()` runs, this screen must show
    the empty state for the next account, never the previous user's rows. The
    library keys are user-scoped per prompt 04 — verify it rather than assume it.
15. Accessibility: the remove action needs a label naming the book it removes,
    segments announce their selected state, 44dp minimum targets, and every card
    carries a meaningful label rather than "image".

Do not: write to `books`, `chapters`, `unlocks` or `reading_positions` from this
screen — only `library_items`; send `user_id` from the client; create, alter or
drop any table, column, index or policy; add drag-to-reorder, folders, tags,
custom collections or a sort control; invent a downloads table; implement the
actual download; render a paywall or a purchase flow; add a second ember
element; add a gradient, glow or shadow; use raw hex outside
`tailwind.config.js`; build Profile or the paywall.

Finish by running `npx tsc --noEmit`, then confirm: the Continue card respects
`last_mode` in both directions; a double tap on Add creates exactly one row;
removing and re-adding works without error; the optimistic toggle rolls back
cleanly when offline; and signing out then in as another account shows an empty
library.
