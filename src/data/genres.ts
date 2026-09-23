// Genres — AGENTS.md § data/. A mirror of the admin dashboard's list
// (story-app-dashboad/src/data/genres.ts), because the dashboard is what
// writes `books.genres`:
//
// - `value` is the slug stored in that column (`dark_romance`). Filters and
//   saved onboarding picks use it, so it must match the dashboard exactly —
//   a value the dashboard cannot tag matches no book.
// - `label` is what a reader sees. Render stored values through
//   `genreLabel()` (lib/labels.ts), never raw.
//
// Keep the two files in step. M2 offers this whole list (decided 2026-09-23,
// replacing the eleven chips copied from the M2 design, three of which the
// dashboard cannot tag).
export const GENRES = [
  { value: "romance", label: "Romance" },
  { value: "werewolf", label: "Werewolf" },
  { value: "vampire", label: "Vampire" },
  { value: "fantasy", label: "Fantasy" },
  { value: "possessive_alpha", label: "Possessive Alpha" },
  { value: "billionaire", label: "Billionaire" },
  { value: "dark_romance", label: "Dark Romance" },
  { value: "paranormal", label: "Paranormal" },
  { value: "shifter", label: "Shifter" },
  { value: "enemies_to_lovers", label: "Enemies to Lovers" },
  { value: "sci_fi", label: "Sci-fi" },
  { value: "hfy", label: "HFY" },
] as const satisfies readonly { value: string; label: string }[];

export type Genre = (typeof GENRES)[number]["value"];
