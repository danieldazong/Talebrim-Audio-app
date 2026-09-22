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
