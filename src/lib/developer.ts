// Who may see the development tools. No React, no hooks, no JSX (AGENTS.md
// § lib/). Tested in `lib/__tests__/developer.test.ts`.
//
// The owner's call, 2026-10-02 (AGENTS.md Decisions — 2026-10-02,
// "Development tools belong to the owner's account"): M11's "Development"
// group, its health-probe link and the health screen belong to the owner's own
// account and to no other, so every other account sees the app a reader will
// see. Development builds only: `__DEV__` is false in a store build, where
// nobody is a developer.
//
// A UI gate, never security. It grants nothing on the server (the account has
// no `metadata.role`, AGENTS.md rule 4), and what it shows only changes what
// this phone draws. RLS stays the enforcement boundary.

/**
 * The owner's own reader account: `EXPO_PUBLIC_DEVELOPER_EMAIL` in
 * `.env.local`, never written in this repo, which is public. Unset or blank,
 * nobody is a developer. Metro reads it when it starts (`npx expo start -c`).
 */
const DEVELOPER_EMAIL = (process.env.EXPO_PUBLIC_DEVELOPER_EMAIL ?? "").trim().toLowerCase();

/**
 * Whether an account is the owner's, from its primary email and whether Clerk
 * verified that address. An exact match, ignoring case and surrounding
 * spaces: a "+tag" or a different dot placement names another Clerk account.
 * False for everyone in a store build.
 */
export function isDeveloperAccount(email: string | null | undefined, verified: boolean): boolean {
  if (!__DEV__ || !verified || !email || !DEVELOPER_EMAIL) return false;
  return email.trim().toLowerCase() === DEVELOPER_EMAIL;
}
