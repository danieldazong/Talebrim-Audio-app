// How old a Clerk session token is by the server's clock, worked out without
// trusting the phone's clock (2026-10-02). Pure: no React, no network.
// Tested in `lib/__tests__/token-age.test.ts`; used by `lib/supabase.ts`.
//
// Clerk's tokens live 60 seconds on the server. Clerk keeps one cached, judges
// its expiry by the phone's clock, and replaces it on a timer. Both failed on
// the owner's phone, whose clock ran a minute slow: a token the server had
// refused for 50 seconds still looked valid, and React Native runs no timers
// while the app is in the background on Android, so no replacement came.
// Autoplay with the screen off then stalled on a refused request.

/** Clerk's tokens live 60 seconds; past this age by the server's clock, one is replaced before it is sent. */
export const TOKEN_MAX_AGE_MS = 40_000;

/** When the token was issued (its `iat` claim), in milliseconds; null for anything unreadable. */
export function tokenIssuedAtMs(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const issuedAt = (claims as { iat?: unknown } | null)?.iat;
    return typeof issuedAt === "number" && Number.isFinite(issuedAt) ? issuedAt * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Whether a cached token must be replaced before it is sent. `clockOffsetMs`
 * is this phone's clock minus the server's, learned from a token just issued
 * (`issuedAtMs` against the phone's clock at that moment); null until one has
 * been. Without it, or without an issue time, the answer is yes.
 */
export function tokenNeedsReplacing(issuedAtMs: number | null, clockOffsetMs: number | null, nowMs: number): boolean {
  if (issuedAtMs === null || clockOffsetMs === null) return true;
  return nowMs - clockOffsetMs - issuedAtMs > TOKEN_MAX_AGE_MS;
}
