// Last write wins against the SERVER timestamp — AGENTS.md § Read/listen
// parity, step 3. Pure: no React, no hooks, no JSX (AGENTS.md § lib/).
//
// Device clocks never enter it: two devices with skewed clocks would fight,
// and the losing write would be the correct one. The only times compared are
// `reading_positions.updated_at` values, which a trigger sets on every write
// (dashboard migration 20260924190305).
import type { ReadingPosition } from "@/lib/queries/reading-position";
import type { ChapterParityPosition, ParitySourceMode } from "@/store/parity-store";

const SERVER_TIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(?:Z|([+-])(\d{2}):?(\d{2})?)$/;

/**
 * Microseconds since the epoch for a `timestamptz` as PostgREST returns it
 * ("2026-09-24T19:03:05.123456+00:00"), or NaN. Parsed by hand: `Date.parse`
 * keeps milliseconds at best, and engines differ on six fractional digits.
 */
export function serverTimeMicros(value: string): number {
  const match = SERVER_TIME.exec(value);
  if (!match) return Number.NaN;

  const [, year, month, day, hour, minute, second, fraction = "", sign, offsetHours = "0", offsetMinutes = "0"] =
    match;
  const utcMs = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second);
  const offsetMs = (sign === "-" ? -1 : 1) * (+offsetHours * 60 + +offsetMinutes) * 60_000;
  return (utcMs - offsetMs) * 1000 + Number(fraction.padEnd(6, "0"));
}

function toMode(lastMode: string): ParitySourceMode {
  // The table's check constraint allows exactly these two.
  return lastMode === "audio" ? "audio" : "text";
}

/** A server row as the session slice holds it: clean, and synced at the row's own time. */
export function fromServerRow(row: ReadingPosition): ChapterParityPosition {
  return {
    chapterId: row.chapter_id,
    textOffset: row.text_offset,
    audioMs: row.audio_ms,
    lastWrittenBy: toMode(row.last_mode),
    syncedAt: row.updated_at,
    dirty: false,
  };
}

/**
 * Which copy of one chapter's position to trust.
 *
 * - No server row → keep the session copy (if any).
 * - No session copy → adopt the server row.
 * - Session dirty → keep it. It is pushed next, lands last, and so is the
 *   newest by the server's clock.
 * - Session clean, and the server row is later than the time it last synced
 *   (or it never synced) → another device wrote since: adopt the server row.
 * - Otherwise keep the session copy.
 */
export function reconcile(
  session: ChapterParityPosition | undefined,
  server: ReadingPosition | null | undefined,
): "keep" | "adopt" {
  if (!server) return "keep";
  if (!session) return "adopt";
  if (session.dirty) return "keep";
  if (session.syncedAt === null) return "adopt";
  return serverTimeMicros(server.updated_at) > serverTimeMicros(session.syncedAt) ? "adopt" : "keep";
}
