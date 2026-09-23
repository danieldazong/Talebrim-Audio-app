// Enum-to-label maps. No React, no hooks, no JSX — AGENTS.md § lib/.
import { GENRES } from "@/data/genres";
import type { Enums } from "@/types/database";

const GENRE_LABELS = new Map<string, string>(GENRES.map((genre) => [genre.value, genre.label]));

/**
 * A `books.genres` value → display label: `dark_romance` → "Dark Romance".
 *
 * The column is free text, so a slug the app doesn't know yet is humanised
 * (`slow_burn` → "Slow Burn") instead of shown raw, and a value that is
 * already prose ("Dark Romance") passes through unchanged.
 */
export function genreLabel(value: string): string {
  return (
    GENRE_LABELS.get(value) ??
    value
      .split("_")
      .filter((word) => word.length > 0)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

/**
 * `maturity` enum → display label.
 *
 * The enum value `mature_17` displays as "Mature 18+" — deliberate split,
 * shared with the admin dashboard (AGENTS.md Data Contract). Do not rename
 * the enum and never render the raw value in UI copy.
 */
const MATURITY_LABELS: Record<Enums<"maturity">, string> = {
  general: "General",
  mature_17: "Mature 18+",
};

export function maturityLabel(maturity: Enums<"maturity">): string {
  return MATURITY_LABELS[maturity];
}

/** `book_status` enum → display label. Reader UI should rarely need this — every catalog read is already filtered to `published`. */
const BOOK_STATUS_LABELS: Record<Enums<"book_status">, string> = {
  draft: "Draft",
  published: "Published",
};

export function bookStatusLabel(status: Enums<"book_status">): string {
  return BOOK_STATUS_LABELS[status];
}
