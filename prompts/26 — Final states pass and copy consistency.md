Read AGENTS.md first and follow it strictly. Do only what is on this page. This
is a PASS over screens that already exist, not new features. Change no layout,
no navigation, no colour token and no data query. If a fix requires a structural
change, list it and ask me before making it.

1. Audit every screen — M1, M2, M3, M4, M5, M5a, M6, M7, M8, M9, M10, M11 —
   against five states: loading, empty, no-results, offline and error. Produce a
   matrix of screen against state before changing anything, marking each cell as
   present, missing, or not applicable with a reason. Paste the matrix. Then fix
   the gaps. The matrix is the deliverable as much as the fixes are.
2. Every state must be SURFACE-MATCHED. An error inside the reader renders on
   the reader's ACTIVE theme, including the cream one; an error on M6 renders on
   the gradient. A state that renders on the wrong background is the tell that it
   was bolted on.
3. Loading means skeletons SHAPED LIKE THE REAL CONTENT — cover-sized blocks,
   text-line-sized bars, row-sized rows — never a centred spinner on a blank
   screen. Reuse one skeleton primitive rather than reimplementing per screen.
4. Empty, no-results and error must be VISIBLY DIFFERENT from each other on
   every screen. An empty library is the default state of a new account and must
   look intentional; M8's no-results must name the term the user typed and must
   not look like an empty search field; a failed request must offer a retry. If
   any two look alike, that is a bug.
5. Offline is its own state, not an error. Install
   `@react-native-community/netinfo` if it is not present and wire it into
   TanStack's `onlineManager` as the React Native docs specify
   (https://tanstack.com/query/latest/docs/framework/react/react-native) — without
   it, the client does not know it is offline and queries fail as generic errors.
   Then distinguish: offline with a warm cache reads normally, and must not show
   an offline banner over content that works; offline with a cold cache shows the
   offline state; a downloaded chapter plays and opens offline per prompt 25.
6. Add a root error boundary with a branded fallback and a way to recover
   (https://docs.expo.dev/router/error-handling/), plus the unmatched-route
   screen. A white React error screen in production is the worst possible
   outcome. Do not add Sentry, Bugsnag or any crash-reporting SDK — AGENTS.md
   does not specify one and it needs your sign-off.
7. Ban these across the whole app, and grep to prove it: `Alert.alert` anywhere
   except the two destructive confirmations in prompt 26; any red toast; a raw
   error message, error code or stack trace shown to a user; the strings "null",
   "undefined", "NaN" or "[object Object]" rendered anywhere; and `00:00` for an
   unknown duration. Paste the grep results.
8. COPY AND VOICE. Talebrim's register is premium and nocturnal — warm, adult,
   never neon, girlish, saccharine or jokey. Fix the exact strings AGENTS.md
   specifies: "Pick up where you left off" on M1 and "What you love to read" on
   M2. Where AGENTS.md specifies no string, do not invent marketing language:
   write plain, honest copy and FLAG it in a list for my review. Consolidate all
   user-facing strings into one module as you go, so a future copy pass is one
   file rather than twelve.
9. NAMING, applied everywhere a user can see: the product is "talebrim",
   lowercase, never "Talebrim Books". The UI says "Story" and "Stories"; "book"
   survives only in code, schema and query keys. `maturity` value `mature_17`
   displays as "Mature 18+". Grep for "NovelNow", "Halaud", "lingua" and any
   other placeholder name left in from the design materials, and report anything
   you find.
10. Re-check every conflict earlier prompts were told to surface rather than
    resolve, and list the current status of each: the 17+ versus 18+ legal line on
    M1; the missing wordmark asset; the six tab-strip entries against seven
    genres; the eleven chips and "Pick 3 or more" against seven genres and no
    stated minimum; the undefined third onboarding step; the omitted "#1 Trending"
    badge; M9's inverted sort default; M6's "AUDIO SYNC ACTIVE" label and
    undefined hamburger; M8's unspecified mini-player visibility; and the missing
    legal URLs and support address. Do not resolve them — report which are still
    open.
11. Verify the app-wide invariants hold after all the above, and paste evidence:
    exactly one ember element per screen, with nav active state, progress bars and
    active-tab underlines exempt; the gradient on M6 and nowhere else; teal only
    on audio badges and M6's speed and sleep controls; `danger` only on M11's
    destructive rows; no raw hex outside `tailwind.config.js`; no white text on
    ember; Literata only in the reader body; no remote or generated imagery
    anywhere.
12. Confirm no locked content is reachable: no locked chapter navigates to the
    reader or player from M4, M9 or autoplay; no locked `script_text` query runs;
    no locked audio downloads. Test each path.

Do not: add a feature, screen, route or dependency beyond netinfo; change a
layout, token, query or navigation structure; add analytics, crash reporting or
A/B tooling; invent marketing, legal or support copy; resolve any of the step-10
conflicts on your own; alter any table, policy or view; touch the accessibility
work — prompt 28 owns it.

Finish by running `npx tsc --noEmit`, then paste the state matrix from step 1
before and after, the grep results from steps 7 and 9, the flagged-copy list from
step 8, the open-conflict status from step 10, the invariant evidence from step
11, and the locked-content test results from step 12.
