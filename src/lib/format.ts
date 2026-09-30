// Pure formatting helpers. No React, no hooks, no JSX — AGENTS.md § lib/.

const DURATION_UNKNOWN = "Duration unknown";

/**
 * A calendar date in the reader's locale, day, short month and year ("21 Sept
 * 2026", "Sep 21, 2026"). Null for a string that isn't a date.
 */
export function formatDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Formats a duration in seconds as `h:mm:ss` / `m:ss`.
 *
 * `null` means UNKNOWN, not zero — a chapter can have audio in storage with
 * no duration ever measured (AGENTS.md Data Contract). This is the ONLY
 * place duration is formatted; never print "00:00" for a null value.
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return DURATION_UNKNOWN;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function unit(count: number, name: string): string {
  return `${count} ${name}${count === 1 ? "" : "s"}`;
}

/**
 * Formats a duration in seconds for a screen reader — "4 minutes 15 seconds",
 * "1 hour 2 minutes" — where `formatDuration()`'s "4:15" would be read out
 * as a time of day. Same null contract: `null` is UNKNOWN, never zero.
 */
export function formatDurationSpoken(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return DURATION_UNKNOWN;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts = [
    hours > 0 ? unit(hours, "hour") : null,
    minutes > 0 ? unit(minutes, "minute") : null,
    secs > 0 || totalSeconds === 0 ? unit(secs, "second") : null,
  ].filter((part) => part !== null);
  return parts.join(" ");
}

/**
 * Formats a duration in seconds as a compact rounded summary — `18h`, `45m`
 * — for totals like M3's hero card ("Audio Parity"), never for a scrub bar
 * or a chapter row (those use `formatDuration()`'s `h:mm:ss` instead).
 *
 * Same null contract as `formatDuration()`: `null` is UNKNOWN, never `0h`.
 */
export function formatDurationCompact(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) {
    return DURATION_UNKNOWN;
  }

  const hours = Math.round(seconds / 3600);
  if (hours >= 1) {
    return `${hours}h`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}m`;
}

/**
 * A playback rate as M6 prints it: "1.0", "1.25", "2.0" — always at least one
 * decimal, as the frame shows "1.0x". The caller adds the "x" or "times".
 */
export function formatSpeed(speed: number): string {
  return Number.isInteger(speed) ? speed.toFixed(1) : String(speed);
}

const KB = 1000;
const MB = 1000 * 1000;
const GB = 1000 * 1000 * 1000;

/**
 * A size on disk, in the decimal units Android's own storage screens use:
 * "350 KB", "4.8 MB", "48 MB", "1.2 GB".
 */
export function formatBytes(bytes: number): string {
  const value = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (value >= GB) return `${(value / GB).toFixed(1)} GB`;
  if (value >= MB) {
    const megabytes = value / MB;
    return megabytes < 9.95 ? `${megabytes.toFixed(1)} MB` : `${Math.round(megabytes)} MB`;
  }
  return `${Math.max(value > 0 ? 1 : 0, Math.round(value / KB))} KB`;
}

/** `formatBytes()` for a screen reader: "48 megabytes", where "MB" reads badly aloud. */
export function formatBytesSpoken(bytes: number): string {
  return formatBytes(bytes).replace(/ KB$/, " kilobytes").replace(/ MB$/, " megabytes").replace(/ GB$/, " gigabytes");
}
