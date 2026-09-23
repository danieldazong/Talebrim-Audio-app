// Row aliases for the per-reader tables — AGENTS.md Data Contract. Created by
// the Phase 2 migrations (prompt 13, in the dashboard repo) and derived from
// the generated `types/database.ts`; never redeclare these shapes by hand.
//
// Every row is scoped by RLS to the signed-in reader (`user_id` = their Clerk
// `sub`). An operator is a reader here too: `is_admin()` grants no view of
// anyone else's rows.
import type { Tables } from "@/types/database";

/**
 * One reading position per reader per chapter — the server copy of
 * read/listen parity. `text_offset` is a CHARACTER offset into `script_text`,
 * never pixels. `last_mode` says which side wrote last, so a mode switch maps
 * from it. `updated_at` is a server timestamp: last write wins against it,
 * never against the device clock.
 */
export type ReadingPositionRow = Tables<"reading_positions">;

/**
 * A permanent per-chapter grant (rewarded ad or one-off purchase). Readers
 * can read their own and never write: rows come from a server function after
 * the ad or purchase is verified. Subscriptions never write here.
 */
export type UnlockRow = Tables<"unlocks">;

/** A book on the reader's My List (M7), newest first by `created_at`. */
export type LibraryItemRow = Tables<"library_items">;
