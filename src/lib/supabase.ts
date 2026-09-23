import { createClient } from "@supabase/supabase-js";

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
let pendingRefresh: Promise<string | null> | null = null;

/** Called once from the provider tree; never from feature code. */
export function setClerkTokenGetter(getToken: GetToken | null) {
  clerkGetToken = getToken;
}

/**
 * Clerk session tokens live 60 seconds. A cached token with less than this
 * left is replaced before use. This matters for Realtime above all: it closes
 * a private channel the moment the channel's token expires, and realtime-js
 * only re-sends the token every 25 seconds. With at least 30 seconds on every
 * token handed out, the channel's token can never lapse between re-sends.
 */
const MIN_TOKEN_LIFETIME_S = 30;

/** Seconds until a JWT's `exp`, or null if unreadable. Decoding only — the server verifies. */
function secondsUntilExpiry(jwt: string): number | null {
  const segment = jwt.split(".")[1];
  if (!segment) return null;
  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const { exp } = JSON.parse(atob(padded)) as { exp?: unknown };
    return typeof exp === "number" ? exp - Date.now() / 1000 : null;
  } catch {
    return null;
  }
}

async function freshClerkToken(getToken: GetToken): Promise<string | null> {
  const token = await getToken();
  if (token === null) return null;

  const remaining = secondsUntilExpiry(token);
  if (remaining === null || remaining >= MIN_TOKEN_LIFETIME_S) return token;

  // One forced refresh at a time, however many requests ask at once.
  pendingRefresh ??= getToken({ skipCache: true }).finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
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
      return freshClerkToken(clerkGetToken);
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

