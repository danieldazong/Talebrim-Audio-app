Read AGENTS.md first and follow it strictly. Do only what is on this page.
This replaces the mock from prompt 05 with the real service. Do not change the
screen design, the layout, the copy or the navigation structure. If a real
constraint forces a visual change, STOP and ask me before implementing it.

1. Before writing lifecycle code, check the method signatures against the SDK
   actually installed in this repo — open the installed `@clerk/clerk-expo` (or
   `@clerk/expo`) types in `node_modules` and confirm the hook and method names
   exist at that version. Report the version and the exact hooks you will use. Do
   not write against a signature you have not confirmed.
2. Use the custom flow, not prebuilt UI and not the hosted web pages, per
   https://clerk.com/docs/guides/development/custom-flows/authentication/email-sms-otp
   The email OTP path is a variant of the phone OTP guide on that page; read it
   before coding.
3. Email code sign-in: call `signIn.create()` with the `email_code` strategy, then
   go straight to code entry. Do NOT also call `prepareFirstFactor()` — with
   `email_code`, `create()` already sends the code, and calling both sends two
   emails where the first is immediately invalidated, which reads to the user as a
   broken app (clerk/javascript#887). Then complete with
   `attemptFirstFactor()` and call `setActive()` on success.
4. Sign-up for a new email: create the sign-up, prepare the email-address
   verification, attempt it with the code, then `setActive()`. Route both paths
   through the SAME verify screen built in prompt 07-of-05 (`app/(auth)/verify.tsx`)
   — one screen, a flag for which flow it is. Never send two codes for one user
   action; if Clerk's "identifier exists" error comes back on sign-up, fall through
   to sign-in rather than surfacing a raw error.
5. Google and Apple: use the native Expo hooks from the installed SDK
   (https://docs.expo.dev/guides/using-clerk/ documents `useSignInWithGoogle()`
   and the Apple equivalent; Clerk shipped native Sign in with Apple for Expo on
   2025-11-13). Prefer native over a browser redirect. If the installed version
   lacks those hooks, use the OAuth custom flow
   (https://clerk.com/docs/guides/development/custom-flows/authentication/oauth-connections)
   and say which you used and why. Both providers must be enabled on the existing
   Talebrim Clerk application's development instance — the same app the dashboard
   uses. Do not create a new Clerk application.
6. Map every Clerk error into the inline states prompt 05 already built: invalid
   code, expired code, too many attempts, unverified identifier, network failure.
   Read the error's code, not its message string. Keep them inline and
   surface-matched — no `Alert.alert`, no red toast, no raw error object on screen.
   The resend affordance must be throttled with a visible countdown so a user
   cannot trigger Clerk's rate limit and land in a dead state.
7. Implement the auth gate in `app/_layout.tsx`: wait for `isLoaded` before
   deciding anything, keep the splash screen up until then, and never render a
   protected route for one frame while auth resolves. Unauthenticated goes to M1.
   Leave the first-time-versus-returning branch calling the single routing
   function from prompt 05 step 9, still with its `// TODO(08)` — prompt 08 owns
   the persisted flag and the three-way gate.
8. Sign-out must call Clerk's `signOut()` and then the one
   `clearUserScopedState()` from `lib/session.ts`, clearing the persisted
   TanStack cache and the persisted Zustand slices. Fill in the `// TODO(08)`
   marker only for the cache half; the store half stays a TODO. A sign-out that
   leaves a persisted cache behind shows the previous account's rows to the next
   user on this device.
9. After `setActive()`, confirm end to end that the session token reaches Postgres:
   run one `books_catalog` select as the signed-in user and log the row count and
   the decoded claims. If `role: authenticated` or the `metadata` claim is missing,
   reads fail or silently return zero rows — STOP and report it rather than
   loosening a policy or falling back to the anon key.
10. Verify the token cache is `expo-secure-store` via
    `@clerk/clerk-expo/token-cache` and nothing else. Do not hand-roll a cache and
    do not put a session token, a code, or an email in AsyncStorage.

Do not: add a password field, a password reset, a magic link, a phone option or a
third social provider — M1 is passwordless email code plus Google and Apple;
change any string, colour, spacing or component from prompt 05; use `<SignIn />`,
`<SignUp />`, `<AuthView />` or any prebuilt Clerk component; read, write or
expose `metadata.role` anywhere in the app; call the Clerk Backend API or use a
secret key from the app; build M2, M3 or a tab bar; query `books`, `chapters`, or
any admin-only view.

Finish by running `npx tsc --noEmit`, then paste the SDK version and hooks from
step 1, confirm exactly one email arrives per sign-in attempt and one per sign-up,
paste the row count and decoded claims from step 9, and confirm a sign-out
followed by a different sign-in shows no rows from the first account.

Next prompt: `07-genre-picker-ui.md`.
