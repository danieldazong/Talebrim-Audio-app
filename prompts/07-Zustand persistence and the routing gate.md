Read AGENTS.md first and follow it strictly. Do only what is on this page.
This is the second half of the two-pass split for M1/M2: the screens exist, this
adds persistence and gating. Do not change any screen's design, copy or layout.

1. Install `zustand` and create `store/` with one store per concern, not one god
   store. Zustand owns transient and local-only state; TanStack owns server state.
   Nothing that lives in Postgres may be duplicated into a store.
2. Persist with the `persist` middleware and `createJSONStorage` over
   `@react-native-async-storage/async-storage`
   (https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data).
   Use `partialize` so ONLY local-only data is written to disk
   (https://zustand.docs.pmnd.rs/reference/middlewares/persist). Never persist a
   session token, a Clerk object, an email, or a verification code — those belong
   in `expo-secure-store` and AGENTS.md forbids AsyncStorage for them.
3. Slices to create now:
   `onboarding` — `hasCompletedOnboarding`, `selectedGenres` (persisted);
   `reader` — font size, theme, line spacing, Atkinson toggle (persisted);
   `playback` — current chapter, playing state, speed, sleep timer (NOT persisted,
   session only);
   `parity` — the in-session authoritative reading position (NOT persisted to
   disk; see step 8).
   Keep genre choices local: there is no profile table until Phase 2, so this
   store is the only home for them and prompt 14 does not change that by itself.
4. Handle async hydration explicitly. AsyncStorage rehydrates after first render,
   so gate on the store's hydration flag via `onRehydrateStorage` and keep the
   splash screen up until both Clerk's `isLoaded` and store hydration are true.
   Without this the gate reads `hasCompletedOnboarding: false` for one frame and
   flashes M2 at a returning user on every cold start.
5. Replace the `// TODO(08)` routing function from prompt 05 with the real
   three-way gate, composed with — not replacing — the Clerk auth gate from prompt
   06: not signed in → M1; signed in and `hasCompletedOnboarding === false` → M2;
   signed in and completed → M3. Implement it with Expo Router's protected routes
   (https://docs.expo.dev/router/advanced/protected/,
   https://docs.expo.dev/router/advanced/authentication/) rather than an imperative
   `router.replace` inside a `useEffect`. A completed user must never see M2 again,
   including after a force-quit or a reinstall-then-sign-in.
6. Wire M2's "Start Reading" to write `selectedGenres` and set
   `hasCompletedOnboarding: true`, and wire "Skip" to set the same flag with an
   empty array. Skip is a completed state — a user who skips is never shown M2
   again. Do not add validation or a minimum count; AGENTS.md sets none.
7. Complete `clearUserScopedState()` in `lib/session.ts` — fill the
   `// TODO(08)` left by prompt 06. It must clear the persisted Zustand slices AND
   the user-scoped TanStack cache, in that one function. Sign-out calls it. It must
   NOT clear device-level preferences that are not user-scoped if you decide any
   exist — state which keys you cleared and which you kept, and why.
8. Keep the parity position session-authoritative in Zustand for now. The
   `reading_positions` table does not exist until prompt 14, so there is no server
   copy to reconcile against and no last-write-wins comparison to make yet. Write
   the slice so a server sync can be added without changing its public API, and
   mark it `// SERVER COPY ADDED IN 14/17`. Do not persist it to AsyncStorage: a
   stale on-device position that later loses to the server is worse than none.
9. Add a development-only clear-storage button — visible only under `__DEV__`,
   on the temporary index route, not in any M-series screen. It must call the
   SAME `clearUserScopedState()` that sign-out calls, so the two paths cannot
   drift. Label it plainly and confirm the app returns to M1 afterwards.
10. Add a `version` and a `migrate` function to each persisted store from the
    start. Shipping without them means any future shape change silently hands a
    stale object to a component and crashes on a missing field.

Do not: create a `profiles` table, a migration, or any SQL; write genre choices
to Supabase; persist playback state, the parity position, or any server row to
AsyncStorage; put a token in AsyncStorage; duplicate `books_catalog` data into a
store; use Context or Redux alongside Zustand; change any visual detail of M1,
M2 or the verify screen; build M3, a tab bar or a mini player.

Finish by running `npx tsc --noEmit`, then confirm each of these by test: a cold
start with a completed flag goes straight to M3 with no M2 flash; force-quit and
relaunch preserves genres; Skip sets completion; sign-out then sign-in as a
different account shows neither the first account's genres nor its cached rows.
Paste the list of persisted keys and the list you deliberately left unpersisted.
