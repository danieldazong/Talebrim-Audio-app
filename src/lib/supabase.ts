import { createClient } from "@supabase/supabase-js";

import { tokenIssuedAtMs, tokenNeedsReplacing } from "@/lib/token-age";
import type { Database } from "@/types/database";

// Module-level indirection so the client stays a plain singleton (no React)
// while still reaching Clerk's hook-provided getToken. AGENTS.md § lib/:
// "No React, no hooks, no JSX in lib/".
//
// Declared BEFORE createClient(): Supabase invokes `accessToken` during
// construction to seed its Realtime token, so a `let` declared below would
// still be in its temporal dead zone and throw.
type GetToken = (options?: { skipCache?: boolean }) => Promise<string | null>;
let clerkGetToken: GetToken | null = null;
let pendingRealtimeAuth: Promise<void> | null = null;
/** This phone's clock minus the server's, from the last token issued; null until one is. */
let clockOffsetMs: number | null = null;
let pendingIssue: Promise<string | null> | null = null;

/** Called once from the provider tree; never from feature code. */
export function setClerkTokenGetter(getToken: GetToken | null) {
  clerkGetToken = getToken;
}

/**
 * A token Clerk issues now (`skipCache`), which also refills Clerk's cache,
 * and what its `iat` says about this phone's clock. Requests made together
 * share one.
 */
function issueToken(): Promise<string | null> {
  pendingIssue ??= (async () => {
    const token = (await clerkGetToken?.({ skipCache: true })) ?? null;
    const issuedAt = token === null ? null : tokenIssuedAtMs(token);
    if (issuedAt !== null) clockOffsetMs = Date.now() - issuedAt;
    return token;
  })().finally(() => {
    pendingIssue = null;
  });
  return pendingIssue;
}

/**
 * The app's single Supabase client.
 *
 * Auth is Clerk's third-party integration: the `accessToken` callback hands
 * Supabase the live Clerk session token on every request, and RLS reads it as
 * `auth.jwt() ->> 'sub'`.
 *
 * Banned alternatives (AGENTS.md § Supabase Rules): `global.headers.
 * Authorization`, a Clerk JWT template, and a shared Supabase JWT secret.
 * Supabase deprecated that integration on 1 April 2025.
 *
 * Clerk owns the session, so this client neither persists nor auto-refreshes
 * one of its own.
 */
export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    accessToken: async () => {
      // Null only before AuthedQueryProvider first renders. A request sent
      // without a token gets an empty result from RLS, not an error.
      if (!clerkGetToken) return null;
      const cached = (await clerkGetToken()) ?? null;
      if (cached === null) return null;
      // Clerk's cached token can already be refused by the server, and in the
      // background nothing replaces it (`lib/token-age.ts`). Checked on every
      // request, by the server's clock, with no timer involved.
      return tokenNeedsReplacing(tokenIssuedAtMs(cached), clockOffsetMs, Date.now()) ? issueToken() : cached;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

/**
 * Hands Realtime a newly issued Clerk token instead of the cached one.
 *
 * Realtime closes a private channel the moment the token it holds expires.
 * Clerk tokens live 60 seconds, and a cached token can already be expired by
 * the server's clock: seen on Android 2026-09-23 as "Token has expired 1
 * seconds ago" straight after a refresh. A token issued now is good for 60
 * seconds on the server whatever the phone's clock says. `skipCache` also
 * refills Clerk's cache, so realtime-js's own heartbeat re-send, which goes
 * through the callback above, picks up the same new token.
 */
export function refreshRealtimeAuth(): Promise<void> {
  pendingRealtimeAuth ??= (async () => {
    const token = await issueToken();
    if (token) await supabase.realtime.setAuth(token);
  })().finally(() => {
    pendingRealtimeAuth = null;
  });
  return pendingRealtimeAuth;
}

