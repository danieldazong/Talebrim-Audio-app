// Pure formatting helpers. No React, no hooks, no JSX — AGENTS.md § lib/.

const DURATION_UNKNOWN = "Duration unknown";

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
