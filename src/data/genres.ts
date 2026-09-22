// Single source for genre chips — AGENTS.md § data/. Not the system of
// record for a book's genres (that's `books.genres` / `books_catalog.genres`
// text[]); this is the fixed set of chips the UI offers for picking and
// filtering, and the exact strings expected to appear in that column.
//
// DEVIATION FROM AGENTS.md: the Screen Inventory's M2 spec names only seven
// genres (Romance, Werewolf, Vampire, Fantasy, Possessive, Billionaire,
// Dark). Expanded to eleven — adding Mafia, Royalty, Shifter, Forbidden and
// renaming Dark to "Dark Romance" — on explicit user instruction to match
// the M2 design reference exactly. Any book tagged with one of the four new
// values in `books.genres` will resolve; until then, filtering by those
// chips returns an empty catalogue (AGENTS.md's stated risk for an invented
// genre with no matching rows).
//
// NOTE: M3's home tab strip (AGENTS.md Screen Inventory) shows only six tabs
// — Discover, New, Werewolf, Romance, Vampire, Fantasy — against the eleven
// genres listed here. "New" isn't a genre at all (it's a recency filter),
// and most of these genres have no tab. That mismatch is an open product
// question, not a bug to reconcile in this file.

export const GENRES = [
  { value: "Romance", label: "Romance" },
  { value: "Werewolf", label: "Werewolf" },
  { value: "Vampire", label: "Vampire" },
  { value: "Fantasy", label: "Fantasy" },
  { value: "Billionaire", label: "Billionaire" },
  { value: "Possessive", label: "Possessive" },
  { value: "Dark Romance", label: "Dark Romance" },
  { value: "Mafia", label: "Mafia" },
  { value: "Royalty", label: "Royalty" },
  { value: "Shifter", label: "Shifter" },
  { value: "Forbidden", label: "Forbidden" },
] as const satisfies readonly { value: string; label: string }[];

export type Genre = (typeof GENRES)[number]["value"];
