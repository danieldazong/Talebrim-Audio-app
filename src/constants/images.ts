// Centralized local image imports — AGENTS.md § Image Rule.
//
// Remote covers are Supabase Storage / CDN URLs held in the database and do
// NOT belong here. Render those with expo-image at a 2:3 ratio, always with
// a placeholder.

// NOTE: the directory on disk is `assets/Image/` (capital I, singular).
// AGENTS.md § Image Generation Rules names `assets/images/`; renaming is a
// separate change, not part of the design-system work.
import logo from "@/assets/Image/logo.png";
import eternalEclipse from "@/assets/Image/covers/eternal-eclipse.jpg";
import onboardingBanner from "@/assets/Image/covers/Onboarding-banner.png";
import reignOfAshes from "@/assets/Image/covers/reign-of-ashes.jpg";
import shadowOfTheMoon from "@/assets/Image/covers/shadow-of-the-moon.jpg";
import whispersInTheMist from "@/assets/Image/covers/whispers-in-the-mist.jpg";

export const images = {
  logo,
  onboardingBanner,
  covers: {
    eternalEclipse,
    reignOfAshes,
    shadowOfTheMoon,
    whispersInTheMist,
  },
} as const;

// STILL MISSING — required before the screens that need them are built.
// Deliberately not declared: a key pointing at a nonexistent file is a Metro
// resolution error at import time, not a soft failure. These come from the
// admin CMS or a designer — AGENTS.md § Image Generation Rules forbids
// generating them.
//   cover-placeholder.png   — every nullable books.cover_path renders this
//   auth-header.png         — M1 sign in / sign up

// `cover_path` in the DB (and in `data/seed-catalog.ts`) is a storage-style
// path like `covers/shadow-of-the-moon.jpg`, not a key into `images.covers`.
// This is a LOCAL-DEV-ONLY lookup for the 4 seed covers that happen to have
// a matching bundled asset — prompt 11 replaces this with real Supabase
// Storage / CDN URLs built from `app_settings.public_cdn_domain`, at which
// point this map is deleted, not extended.
const SEED_COVER_PATH_TO_ASSET: Record<string, (typeof images.covers)[keyof typeof images.covers]> = {
  "covers/eternal-eclipse.jpg": images.covers.eternalEclipse,
  "covers/reign-of-ashes.jpg": images.covers.reignOfAshes,
  "covers/shadow-of-the-moon.jpg": images.covers.shadowOfTheMoon,
  "covers/whispers-in-the-mist.jpg": images.covers.whispersInTheMist,
};

/**
 * Resolves a seed `cover_path` to its bundled local asset, or `null` when
 * the path is null/unmapped — callers render the flat placeholder box in
 * that case (see `components/ui/cover.tsx`), never a broken image.
 */
export function resolveSeedCoverAsset(coverPath: string | null) {
  if (coverPath === null) return null;
  return SEED_COVER_PATH_TO_ASSET[coverPath] ?? null;
}
