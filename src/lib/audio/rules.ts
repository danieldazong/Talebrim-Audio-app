// The pure rules of playback — prompt 18. No React, no hooks, no JSX
// (AGENTS.md § lib/), and no `expo-audio`, so each rule is unit-tested
// without a native module.
import { textOffsetToAudioMs, type RestorePoint } from "@/lib/parity/convert";
import { fromServerRow, reconcile } from "@/lib/parity/reconcile";
import type { ReadingPosition } from "@/lib/queries/reading-position";
import type { ChapterParityPosition } from "@/store/parity-store";

/** What M6's play button and the mini player show. */
export type PlaybackStatus = "paused" | "buffering" | "playing";

/**
 * Where `lib/audio/player.ts` is with the loaded chapter: loading it (or
 * reloading it after a failure), ready to play or playing, waiting for a
 * connection, or failed after a re-mint failed.
 */
export type LoadPhase = "loading" | "ready" | "offline" | "failed";

/** The player flags the status reads. */
export type PlayerFlags = {
  isLoaded: boolean;
  isBuffering: boolean;
  playing: boolean;
};

/** A saved position this close to the end restarts the chapter, so a finished chapter replays instead of ending at once. */
export const REPLAY_WITHIN_MS = 5_000;

/**
 * The play button's state. Buffering while the chapter loads or the player
 * rebuffers, playing while it plays, and paused otherwise — including when a
 * load failed or waits for a connection, where the screen shows its own state.
 */
export function playbackStatusOf(phase: LoadPhase, flags: PlayerFlags | null): PlaybackStatus {
  if (phase === "failed" || phase === "offline") return "paused";
  if (phase === "loading" || flags === null) return "buffering";
  if (flags.isBuffering) return "buffering";
  return flags.playing ? "playing" : "paused";
}

/**
 * The newer of the session copy and the server row, by last-write-wins
 * against the server's clock (`lib/parity/reconcile.ts`) — what M5 restores
 * from too.
 */
export function newerPosition(
  session: ChapterParityPosition | undefined,
  server: ReadingPosition | null | undefined,
): ChapterParityPosition | undefined {
  if (server && reconcile(session, server) === "adopt") return fromServerRow(server);
  return session;
}

/** What a chapter offers to map a reading place against. */
export type AudioTimeline = {
  /** `audio_duration_seconds`; null when it was never measured. */
  durationSeconds: number | null;
  /** `script_text.length`; null when the text isn't at hand (not cached, offline, failed). */
  textLength: number | null;
};

/**
 * Where a chapter starts playing, in milliseconds, from the side that wrote
 * last (prompt 19 step 4):
 *
 * - Reading wrote last: its text offset, mapped into the narration
 *   (`textOffsetToAudioMs()`), or the chapter start without a duration to
 *   map with. Without the text's length it can't be mapped, and the audio
 *   side stands instead, else the chapter start.
 * - Listening wrote last: its audio position.
 *
 * Either way, a place within `REPLAY_WITHIN_MS` of the end, or past it,
 * starts the chapter again. With an unknown duration there is no end to
 * measure against, so the place stands.
 */
export function audioRestoreMs(position: ChapterParityPosition | undefined, timeline: AudioTimeline): RestorePoint {
  const duration = knownSeconds(timeline.durationSeconds);
  const replays = (ms: number) => duration !== null && ms >= duration * 1000 - REPLAY_WITHIN_MS;

  if (position?.lastWrittenBy === "text" && position.textOffset !== null) {
    if (timeline.textLength !== null) {
      const { value, basis } = textOffsetToAudioMs(position.textOffset, {
        textLength: timeline.textLength,
        durationSeconds: duration,
      });
      return replays(value) ? { value: 0, mapped: "chapter-start" } : { value, mapped: basis };
    }
    // Nothing to map with: the older listening place, else the start.
    if (position.audioMs === null) return { value: 0, mapped: "chapter-start" };
  }

  const ms = position?.audioMs ?? null;
  if (ms === null || !Number.isFinite(ms) || ms <= 0 || replays(ms)) return { value: 0, mapped: null };
  return { value: Math.round(ms), mapped: null };
}

/** A duration worth showing: finite and above zero. A zero is a failed measurement, never a length. */
function knownSeconds(seconds: number | null | undefined): number | null {
  return seconds !== null && seconds !== undefined && Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/**
 * The chapter's length: the catalog's measured `audio_duration_seconds`,
 * else the player's own once it is known, else null ("Duration unknown").
 */
export function chooseDuration(catalogSeconds: number | null, playerSeconds: number | null | undefined): number | null {
  return knownSeconds(catalogSeconds) ?? knownSeconds(playerSeconds);
}

/** True once a sleep timer ending at `endsAt` (epoch ms) has run out. */
export function sleepTimerDue(endsAt: number | null, now: number): boolean {
  return endsAt !== null && now >= endsAt;
}

/** Whole seconds left on a sleep timer, never below zero. */
export function sleepSecondsLeft(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
