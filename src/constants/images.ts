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
