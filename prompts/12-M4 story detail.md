Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/07-story-detail.png — ensure everything is as is
shown. This screen ships with its real queries in one prompt; only the per-user
states are mocked, and prompt 14 plus prompt 17 replace them.

1. Replace the `book/[id]` placeholder from prompt 09. Pushed stack route outside
   the tab group, receiving only the book id from the route param — no data passed
   through params. Follow the prompt-09 mini-player map; if M4 is absent from it,
   render no mini player and report the route as unspecified.
2. Two queries, both through the prompt-04 key factory, both on views only:
   the book row from `books_catalog`, and the chapter preview rows from
   `chapters_catalog` filtered by book id. Never touch `books`, `chapters`, or
   the admin-only `chapters_list` / `chapters_needing_attention`. Select explicit
   columns and limit the preview rows — the full list is M9's job in prompt 21.
3. Use `.maybeSingle()` for the book row, not `.single()`
   (https://supabase.com/docs/reference/javascript/v1/maybesingle). `.single()`
   throws on zero rows, so a book that is unpublished or RLS-invisible to this
   reader would surface as an error screen when the correct rendering is a
   "story not available" state. Handle null data as its own state.
4. Header block: cover at 12dp via `Cover`, title in Fraunces 600, author,
   genre chips, and the metadata row. Every metadata value comes from the view's
   pre-computed columns — `chapter_count`, `audio_count`, `free_chapter_count`,
   `total_duration_seconds` — never counted client-side from the preview rows,
   which are limited and would give a wrong total.
5. Duration through `formatDuration()` only. Null `total_duration_seconds`
   renders the unknown label — never `00:00`, never a hidden row. Null
   `cover_path` renders the local `cover-placeholder.png` from
   `constants/images.ts`. No remote placeholder service, no generated artwork,
   no hotlinked image.
6. Maturity label comes from `lib/labels.ts` (prompt 04): the enum value
   `mature_17` displays as "Mature 18+". Never render the raw enum value. If the
   design shows a different string, report the difference and render the mapped
   label.
7. Primary action is the single ember element on this screen — the "Read" or
   "Read or Listen" pill with an `ink #1A1420` label. Secondary actions (Listen if
   separate, Add to My List, Share) are outline or text variants. "Add to My List"
   has no backing table until prompt 14: render it, keep its state in local
   component state, mark it `// UNBACKED — prompt 14 adds library_items`, and do
   not write anywhere. If you implement Share, use React Native's built-in
   `Share` (https://reactnative.dev/docs/share) rather than adding a dependency,
   and only if the design shows it.
8. Synopsis with a truncation and an expand affordance. Use `numberOfLines` plus
   `onTextLayout` to decide whether the affordance is needed at all
   (https://reactnative.dev/docs/text) — do not always show "more", and do not add
   a read-more library.
9. Chapter preview rows show number, title, a teal headphone badge when
   `has_audio`, and a lock affordance when locked. Locked is the ONLY per-user
   state derivable today: compute it with `resolveChapterState()` from prompt 04,
   using the chapter's `access` value and the live `free_chapters_at_start` from
   `app_settings`. Read that setting at runtime — do not hardcode 3 and do not
   trust the migration default. The other three states (unlocked, downloaded,
   reading) are unbacked; do not render them here.
10. A "See all chapters" affordance pushes `chapters/[bookId]` (M9), which is
    still a placeholder until prompt 21. Keep the push; it is correct now and the
    screen fills in later.
11. Tapping a free chapter pushes `reader/[chapterId]` (M5) and, where the design
    shows a listen path, `player/[chapterId]` (M6) — both still placeholders until
    prompts 15 and 18. Tapping a locked chapter must NOT navigate: it opens the
    paywall in prompt 23, so for now it is a no-op with a
    `// TODO(23)` marker. Do not let a locked chapter open the reader.
12. States, all surface-matched on `plum-deep`: loading skeletons shaped like the
    real header and rows; not-found from step 3 as its own screen state with a way
    back; error inline with retry. No `Alert.alert`, no red toast, no spinner on a
    blank screen.
13. If the design shows a collapsing or parallax header, implement it with the
    `Animated` value exception the AGENTS.md style table permits and keep it
    subtle. If it does not, use a plain scroll view — do not invent motion.
14. `accessibilityRole` and a label on everything interactive, 44dp minimum touch
    targets, and an accessible label on each locked row that says it is locked
    rather than conveying it by icon alone.

Do not: fetch `script_text` on this screen — it is fetched per chapter only when
the reader opens, and serials run 85–200 chapters; INSERT, UPDATE or DELETE
anything, including a "My List" row or a view count; create a migration, table or
RLS policy — prompt 14 owns all schema work; invent a rating, review count,
reader count or trending rank, none of which have a backing column; render
unlocked, downloaded or reading states; add a second ember element; add a
gradient, glow, blur or shadow — the one permitted gradient belongs to M6; use
raw hex outside `tailwind.config.js`; build M9, M5, M6 or the paywall.

Finish by running `npx tsc --noEmit`, then paste the live `free_chapters_at_start`
value you read, confirm the metadata row uses view-computed counts rather than
client-side counts, confirm a locked chapter does not navigate, and describe the
not-found state from step 3.
