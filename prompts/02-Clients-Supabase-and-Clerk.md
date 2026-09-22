Read AGENTS.md first and follow it strictly. Do only what is on this page. No UI.

1. Before installing, run `cat package.json` and report the installed `expo` SDK
   major. Then install with `npx expo install` (not plain npm) so native versions
   match the SDK: `@supabase/supabase-js`, `@clerk/clerk-expo`, `expo-secure-store`.
   Confirm the Clerk package name against
   https://clerk.com/docs/expo/getting-started/quickstart — the docs reference
   `@clerk/expo` v3 in places. If the current package is `@clerk/expo`, use that
   and say so; do not install both.
2. This app joins the EXISTING Talebrim Clerk application — the same one the admin
   dashboard uses, on the development instance. Do not create a new Clerk
   application: a second app issues a different `sub` namespace and every
   per-user row join in Phase 2 would break. Add this client as a Native
   application inside that app and enable the Native API on the Native
   applications page, per the quickstart above. Note in your summary that enabling
   the Native API is a deliberate dashboard-level change and that it bypasses the
   browser CAPTCHA.
3. Create `.env.local` plus a committed `.env.example` holding only
   `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and
   `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
   (https://docs.expo.dev/guides/environment-variables/). Add `.env.local` to
   `.gitignore`. The `EXPO_PUBLIC_` prefix inlines a value into the bundle, so
   nothing else goes in there — never the service-role key, never a RevenueCat
   secret key.
4. Wrap the app in `ClerkProvider` in `app/_layout.tsx` with the SecureStore token
   cache from `@clerk/clerk-expo/token-cache`. Do not hand-roll a cache and do not
   put a session token in AsyncStorage — AGENTS.md forbids it and SecureStore is
   the only acceptable store.
5. Create `lib/supabase.ts` exporting one client built with the `accessToken`
   option, which must call Clerk's `getToken()` and return its result. Follow
   https://supabase.com/docs/guides/auth/third-party/clerk and
   https://clerk.com/docs/guides/development/integrations/databases/supabase.
   The deprecated patterns are banned: no `global.headers.Authorization`, no
   Clerk JWT template, no shared Supabase JWT secret — Supabase deprecated that
   integration on 1 April 2025. Do not persist or auto-refresh a Supabase session;
   Clerk owns the session.
6. Verify the session token actually carries what RLS reads. The Clerk session
   token must contain the `role` claim set to `authenticated`, or every read fails
   the third-party integration, and it must contain
   `{ "metadata": "{{user.public_metadata}}" }` exactly as the dashboard
   configures it, or the reader's RLS reads silently return zero rows. Print the
   decoded claim set once in development and confirm both. If either is absent,
   STOP and report it — do not work around it by loosening a policy.
7. Add `lib/query-client.ts`: install `@tanstack/react-query` plus
   `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`
   and `@react-native-async-storage/async-storage`, and wire persistence per
   https://tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister.
   This is a correctness requirement, not an optimisation: the database's ~450 ms
   floor on a trivial query means an unpersisted cache shows an empty app on every
   cold start. Set a `staleTime` above zero, and namespace the persisted cache key
   by Clerk user id so one account never reads another's cached rows.
8. Add `lib/session.ts` exporting a single `clearUserScopedState()` that removes
   the persisted Query cache and the persisted Zustand slices. Sign-out in prompt
   06 and the dev clear-storage button in prompt 08 must both call this one
   function. Leave a `// TODO(08)` where the Zustand keys will be added.
9. Add an npm script `types:gen` running `supabase gen types typescript`
   (https://supabase.com/docs/guides/api/rest/generating-types) writing to
   `types/database.ts`, and generate it once now. That file is machine-generated:
   never hand-edit it. Prompt 04 derives row types from it.
10. Prove the wiring with a temporary `app/health.tsx` route: show Clerk's
    `isLoaded`/`isSignedIn`, the decoded claims from step 6, and a single
    `select('id').limit(1)` against `books_catalog` with its round-trip time. Link
    it from `app/index.tsx`. Mark it scaffolding for prompt 09.

Do not: build M1, M2 or any sign-in UI — prompt 05 owns the shell and prompt 06
the real flow; use `<SignIn />`, `<SignUp />` or any Clerk prebuilt component, or
the hosted web sign-in, since M1 is a custom flow; query the `books` or `chapters`
base tables, or the admin-only `chapters_list` / `chapters_needing_attention`
views; read or expose `metadata.role` anywhere in the app; add a service-role key,
an Edge Function, Zustand, track-player, RevenueCat or an ads SDK; touch
`tailwind.config.js` or `global.css`.

Finish by running `npx tsc --noEmit`, then paste the installed Clerk package name
and version, the decoded claim set with both checks from step 6 marked pass/fail,
the measured latency from step 10, and confirm `types/database.ts` generated
without errors.
