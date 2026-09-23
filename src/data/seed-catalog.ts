// LOCAL UI MOCK DATA ONLY — NOT THE SYSTEM OF RECORD.
//
// AGENTS.md: "Supabase is the database... AsyncStorage is for local-only
// concerns... and is never the system of record." This file is the same
// idea applied to fixtures: it exists so screens can be built before real
// rows exist behind them.
//
// Rules (prompt 03 step 6 / "Do not" list):
// - Import this ONLY from a screen's explicit mock path (e.g. a dev-only
//   toggle or Storybook-style preview). Once a screen is wired to
//   `lib/queries/*` against real Supabase data, remove the import — do not
//   leave both live and never-taken.
// - Never written back. No INSERT/UPDATE against `books` or `chapters` may
//   be seeded from this file or derived from it.
// - If real catalog data is too thin to build a screen against, that is a
//   blocker to report (AGENTS.md Build order: "seed more content" is admin
//   dashboard work), not something this file should paper over.
import type { BookCatalogRow, ChapterCatalogRow } from "@/types/catalog";

export const seedBooks: BookCatalogRow[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Shadow of the Moon",
    author: "R. Ashworth",
    short_description: "A werewolf alpha's mate goes missing on the night of the blood moon.",
    synopsis:
      "When Lira vanishes during the pack's most dangerous night, Kael breaks every law of the Blackwood pack to find her — and uncovers a betrayal older than the moon itself.",
    genres: ["Werewolf", "Romance", "Dark Romance"],
    maturity: "mature_17",
    cover_path: "covers/shadow-of-the-moon.jpg",
    cover_width: 800,
    cover_height: 1200,
    default_chapter_access: "locked",
    chapter_count: 24,
    audio_count: 24,
    free_chapter_count: 3,
    total_duration_seconds: 43200,
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    title: "Eternal Eclipse",
    author: "M. Voss",
    short_description: "A vampire prince offers a mortal woman a bargain she cannot refuse.",
    synopsis:
      "Centuries alone taught Dorian patience. Then a human woman with nothing left to lose walks into his court demanding a trade he has never offered anyone — and he says yes.",
    genres: ["Vampire", "Romance", "Possessive"],
    maturity: "mature_17",
    cover_path: "covers/eternal-eclipse.jpg",
    cover_width: 800,
    cover_height: 1200,
    default_chapter_access: "locked",
    chapter_count: 18,
    audio_count: 0,
    free_chapter_count: 3,
    // A real "no chapter has a measured duration yet" case — never render
    // this as 00:00; use formatDuration() from lib/format.ts.
    total_duration_seconds: null,
    created_at: "2026-02-14T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    title: "Reign of Ashes",
    author: "T. Fairweather",
    short_description: "A fallen kingdom, a fire-born general, and a throne built on lies.",
    synopsis:
      "Ashira was born from the last ember of a burned dynasty. To reclaim her throne she must serve the general who lit the fire — and survive falling for him.",
    genres: ["Fantasy", "Billionaire"],
    maturity: "general",
    cover_path: "covers/reign-of-ashes.jpg",
    cover_width: 800,
    cover_height: 1200,
    default_chapter_access: "free",
    chapter_count: 31,
    audio_count: 12,
    free_chapter_count: 5,
    total_duration_seconds: 28800,
    created_at: "2025-11-02T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    title: "Whispers in the Mist",
    author: "Elara Vance",
    short_description: "A lone wanderer answers a forest that has been calling her by name.",
    synopsis:
      "Every villager who enters the mist forest returns changed, or does not return at all. Wren goes in anyway, chasing a voice only she can hear — and finds a court that has been waiting for her longer than she has been alive.",
    genres: ["Fantasy", "Dark Romance"],
    maturity: "mature_17",
    cover_path: "covers/whispers-in-the-mist.jpg",
    cover_width: 800,
    cover_height: 1200,
    default_chapter_access: "locked",
    chapter_count: 9,
    audio_count: 0,
    free_chapter_count: 3,
    total_duration_seconds: null,
    created_at: "2026-03-05T00:00:00Z",
    updated_at: "2026-08-15T00:00:00Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    title: "Crown of Thorned Vows",
    author: "N. Castellan",
    short_description: "An arranged royal marriage neither of them wanted, and neither can leave.",
    synopsis:
      "A treaty bride and a king with no interest in ruling. Neither is who the court thinks they are — and the wedding night is only the first lie they will have to keep together.",
    genres: ["Royalty", "Romance"],
    maturity: "general",
    // A real, expected null — resolves to the local placeholder, never a
    // broken image. Deliberately kept alongside the 4 mapped covers above so
    // the placeholder gap (step 7) still has a real row to exercise it.
    cover_path: null,
    cover_width: null,
    cover_height: null,
    default_chapter_access: "locked",
    chapter_count: 15,
    audio_count: 6,
    free_chapter_count: 3,
    total_duration_seconds: 19800,
    created_at: "2026-04-18T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
  },
];

export const seedChapters: ChapterCatalogRow[] = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    book_id: "00000000-0000-0000-0000-000000000001",
    number: 1,
    title: "The Blood Moon Rises",
    access: "free",
    has_text: true,
    has_audio: true,
    audio_duration_seconds: 780,
    audio_duration_source: "detected",
    created_at: "2026-01-10T00:00:00Z",
    updated_at: "2026-01-10T00:00:00Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    book_id: "00000000-0000-0000-0000-000000000001",
    number: 2,
    title: "Missing",
    access: "free",
    has_text: true,
    has_audio: true,
    audio_duration_seconds: 810,
    audio_duration_source: "detected",
    created_at: "2026-01-11T00:00:00Z",
    updated_at: "2026-01-11T00:00:00Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    book_id: "00000000-0000-0000-0000-000000000001",
    number: 3,
    title: "The Old Laws",
    access: "free",
    has_text: true,
    has_audio: true,
    audio_duration_seconds: 795,
    audio_duration_source: "detected",
    created_at: "2026-01-12T00:00:00Z",
    updated_at: "2026-01-12T00:00:00Z",
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    book_id: "00000000-0000-0000-0000-000000000001",
    number: 4,
    title: "What the Forest Knows",
    access: "locked",
    has_text: true,
    // A real "audio file exists but duration was never measured" case.
    has_audio: true,
    audio_duration_seconds: null,
    audio_duration_source: null,
    created_at: "2026-01-13T00:00:00Z",
    updated_at: "2026-01-13T00:00:00Z",
  },
];
