// Enum-to-label maps. No React, no hooks, no JSX — AGENTS.md § lib/.
import type { Enums } from "@/types/database";

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
