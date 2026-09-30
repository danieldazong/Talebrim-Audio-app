// M2's answer, kept with the account as well as on the phone — added
// 2026-09-30. No React, no hooks, no JSX (AGENTS.md § lib/).
//
// The `onboarding` slice is per phone, and sign-out clears it, so the next
// account on the phone doesn't inherit these genres. On its own that made a
// reader who signed out and back in (or reinstalled, or changed phones) pick
// genres again. So the answer is also written to the reader's own Clerk
// `unsafeMetadata`, as `{ onboarding: { genres } }`: present means done,
// Skip included (no genres). A sign-in reads it back. It is not in the
// session token (that carries `public_metadata` only), so RLS never sees it.
import { GENRES, type Genre } from "@/data/genres";

const KNOWN: ReadonlySet<string> = new Set(GENRES.map((genre) => genre.value));

/**
 * The genres the account saved when it finished M2, or null when it never
 * did. `unsafeMetadata` is the reader's own to write, so it is read as
 * untrusted: anything but a list of known genre slugs is dropped.
 */
export function onboardingFromAccount(unsafeMetadata: unknown): Genre[] | null {
  if (typeof unsafeMetadata !== "object" || unsafeMetadata === null) return null;
  const onboarding = (unsafeMetadata as { onboarding?: unknown }).onboarding;
  if (typeof onboarding !== "object" || onboarding === null) return null;
  const genres = (onboarding as { genres?: unknown }).genres;
  if (!Array.isArray(genres)) return null;
  return genres.filter((genre): genre is Genre => typeof genre === "string" && KNOWN.has(genre));
}

/** The same genres, in any order. */
export function sameGenres(a: readonly Genre[], b: readonly Genre[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((genre) => set.has(genre));
}
