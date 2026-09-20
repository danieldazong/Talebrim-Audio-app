Read AGENTS.md first and follow it strictly. Do only what is on this page.
Design material: @prompt_material/06-search.png — ensure everything is as is
shown. This screen ships with its real query in one prompt: there is no mocked
pass, because the whole screen is the query.

1. Replace the `search` placeholder from prompt 09. It is a pushed stack route
   outside the tab group. AGENTS.md's mini-player map does not list M8 — follow
   the prompt-09 map exactly and, if M8 is absent from it, render no mini player
   and report that the route is unspecified rather than guessing.
2. Layout as shown: a back affordance, a search `TextInput` with a clear button,
   and a results list. The input autofocuses on mount so the keyboard is up
   immediately. Set `autoCapitalize="none"`, `autoCorrect={false}`,
   `returnKeyType="search"`, and `keyboardDismissMode="on-drag"` on the list.
3. Debounce the query at 300ms and cancel in flight work on unmount. Do not fire
   a request per keystroke — with the ~450 ms floor on this instance size a
   per-keystroke query queues up behind itself and results arrive out of order.
   `useDeferredValue` alone is not sufficient for a network search; debounce the
   value that feeds the query key.
4. Query `books_catalog` only, through the prompt-04 key factory with the search
   term as a key segment so results cache per term. Never query `books`,
   `chapters`, or any admin-only view. Select explicit columns and always
   `.limit()` the result set.
5. Match on title and author with a case-insensitive OR filter — chained filters
   are ANDed, so an OR requires the `or()` form with multiple `ilike` clauses
   (https://supabase.com/docs/reference/javascript/using-filters). Before writing
   it, check which columns actually exist on the view in `types/database.ts`;
   do not assume an `author` column is present.
6. Escape the user's input before interpolating it into the `or()` string. A
   term containing a comma, a parenthesis or a `%` will otherwise break PostgREST's
   filter syntax or silently widen the match. State how you escaped it.
7. `ilike` with a leading wildcard cannot use a B-tree index. Run
   `EXPLAIN ANALYZE` on your final query and paste the plan. If it sequentially
   scans and the timing is poor, report it and recommend either a `pg_trgm` GIN
   index (https://www.postgresql.org/docs/current/pgtrgm.html) or Postgres full
   text search (https://supabase.com/docs/guides/database/full-text-search) —
   but do NOT create the extension, the index or a `tsvector` column yourself.
   Schema changes are not in scope for this prompt; recommend and stop.
8. Four distinct states, all surface-matched on `plum-deep`, none of them
   identical to another:
   idle — no term entered yet, showing whatever the design specifies (recent or
   suggested); empty term is not "no results";
   loading — skeleton rows sized to the real result row, not a centred spinner;
   no results — a written message naming the term the user typed, distinct from
   idle and distinct from an error;
   error — inline with a retry, no `Alert.alert`, no red toast.
   AGENTS.md calls out that M8's no-results state must be distinct; make that
   visibly true.
9. Result rows use the prompt-02 `Cover` and `Badge` primitives: cover at 12dp,
   title, author, a teal headphone badge when the title has audio, and duration
   via `formatDuration()` only — null renders the unknown label, never `00:00`.
   Null `cover_path` renders the local `cover-placeholder.png`. No remote
   placeholder service, no generated artwork, no hotlinked image.
10. Virtualise the results list with `FlatList` (or FlashList if already a
    dependency) with `keyExtractor` and a stable row height. Rows push
    `book/[id]`. No infinite scroll in this prompt unless the design shows it —
    if you add pagination, use `placeholderData: keepPreviousData` so the list
    does not blank between pages.
11. Full-row touch targets of at least 44dp, `accessibilityRole` and a label on
    every interactive element, and an accessible label on the clear button that
    says what it clears.
12. No ember element is required here. If the design shows one, it is the single
    one; the back affordance and the clear button stay `muted` or outline.

Do not: write to any table, log a search term to the database, or build a
search-history table — there is none, and if you keep recent searches, keep them
in the prompt-08 Zustand store as local-only state; create an extension, index,
`tsvector` column, view or migration; fetch `script_text` here; query base tables
or admin-only views; add a genre filter, a sort control or facets that the design
does not show; add a gradient, glow, blur or shadow; use raw hex outside
`tailwind.config.js`; build M4, Library or Profile.

Finish by running `npx tsc --noEmit`, then paste the `EXPLAIN ANALYZE` plan and
timing from step 7 with your index recommendation, the escaping approach from
step 6, the columns you confirmed in step 5, and screenshots or descriptions of
all four states from step 8 showing idle and no-results are visibly different.
