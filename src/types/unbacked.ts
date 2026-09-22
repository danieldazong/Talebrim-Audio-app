// UNBACKED: no table until prompt 14
//
// Hand-declared because there is nothing to generate from — `npm run
// types:gen` reads the live schema, and these tables do not exist in it.
// Prompt 14 owns the migration; do not create one here (AGENTS.md Data
// Contract: "these are the first migrations to write, and they belong to
// this app rather than the dashboard").
//
// Every hook consuming these must be an obvious stub — throw, return a
// fixed "not implemented" state, or similar — never a silent no-op that
// looks like working code.

// UNBACKED: no table until prompt 14
/**
 * Chapter-scoped read/listen parity position. AGENTS.md § State Management
 * Rules, read/listen parity steps 2–4: audio milliseconds AND text
 * character offset, plus which mode wrote it last, resolved last-write-wins
 * against the SERVER timestamp (never the device clock).
 */
export interface ReadingPositionRow {
  id: string;
  user_id: string; // auth.jwt() ->> 'sub', text — never uuid
  chapter_id: string;
  audio_position_ms: number | null;
  text_character_offset: number | null;
  last_written_by: "audio" | "text";
  updated_at: string; // server timestamp — authoritative for conflict resolution
}

// UNBACKED: no table until prompt 14
/**
 * A rewarded-ad (or other) unlock. AGENTS.md Phase 2 lists open product
 * questions this schema must answer first: does an unlock expire, and does
 * it belong to the user or to the (user, chapter) pair with a count. Shape
 * here is a placeholder, not a decision.
 */
export interface UnlockRow {
  id: string;
  user_id: string;
  chapter_id: string;
  created_at: string;
  expires_at: string | null;
}

// UNBACKED: no table until prompt 14
/**
 * A `My List` (M7) membership. AGENTS.md Phase 2: open question whether
 * this stores explicit order or is sorted by recency — shape here is a
 * placeholder, not a decision.
 */
export interface LibraryItemRow {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
}
