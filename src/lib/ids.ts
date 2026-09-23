// Route-param validation. No React, no hooks, no JSX — AGENTS.md § lib/.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True for a well-formed UUID. Check a route param with this before querying
 * by it: PostgREST answers a malformed uuid with an error, not zero rows, so
 * a stale or hand-typed deep link would otherwise show a retry that can
 * never succeed.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
