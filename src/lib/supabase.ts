import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Module-level indirection so the client stays a plain singleton (no React)
// while still reaching Clerk's hook-provided getToken. AGENTS.md § lib/:
// "No React, no hooks, no JSX in lib/".
//
// Declared BEFORE createClient(): Supabase invokes `accessToken` during
// construction to seed its Realtime token, so a `let` declared below would
// still be in its temporal dead zone and throw.
type GetToken = () => Promise<string | null>;
let clerkGetToken: GetToken | null = null;

/** Called once from the provider tree; never from feature code. */
export function setClerkTokenGetter(getToken: GetToken | null) {
  clerkGetToken = getToken;
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
      return (await clerkGetToken()) ?? null;
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

