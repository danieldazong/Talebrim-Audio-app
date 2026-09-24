import { useEffect, useReducer } from "react";

// SHELL — wired in prompt 18. Local state standing in for the audio player:
// playing, buffering, elapsed and the sleep timer. Nothing here loads audio,
// records a position or touches the `playback` slice's `currentChapterId` or
// `isPlaying` (the mini player would show a track that isn't playing).

/** How long the shell shows Buffering after Play. */
const BUFFERING_MS = 700;
const TICK_MS = 1000;

export type ShellPlaybackStatus = "paused" | "buffering" | "playing";

export type SleepTimer = {
  /** The option chosen in the sheet. */
  minutes: number;
  secondsLeft: number;
};

type ShellState = {
  status: ShellPlaybackStatus;
  elapsed: number;
  sleep: SleepTimer | null;
};

type ShellAction =
  | { type: "toggle"; duration: number | null }
  | { type: "buffered" }
  | { type: "tick"; seconds: number; duration: number | null }
  | { type: "seek"; to: number; duration: number | null }
  | { type: "skip"; by: number; duration: number | null }
  | { type: "sleep"; minutes: number | null }
  | { type: "sleepTick" };

const INITIAL_STATE: ShellState = { status: "paused", elapsed: 0, sleep: null };

/** Never before the start; never past the end when there is one. */
function clampElapsed(seconds: number, duration: number | null): number {
  return Math.max(0, duration === null ? seconds : Math.min(seconds, duration));
}

function atEnd(elapsed: number, duration: number | null): boolean {
  return duration !== null && elapsed >= duration;
}

function reducer(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case "toggle":
      if (state.status !== "paused") return { ...state, status: "paused" };
      // Play at the end starts the chapter again.
      return {
        ...state,
        status: "buffering",
        elapsed: atEnd(state.elapsed, action.duration) ? 0 : state.elapsed,
      };
    case "buffered":
      return state.status === "buffering" ? { ...state, status: "playing" } : state;
    case "tick": {
      if (state.status !== "playing") return state;
      const elapsed = clampElapsed(state.elapsed + action.seconds, action.duration);
      return { ...state, elapsed, status: atEnd(elapsed, action.duration) ? "paused" : "playing" };
    }
    case "seek":
      return { ...state, elapsed: clampElapsed(action.to, action.duration) };
    case "skip":
      return { ...state, elapsed: clampElapsed(state.elapsed + action.by, action.duration) };
    case "sleep":
      return {
        ...state,
        sleep: action.minutes === null ? null : { minutes: action.minutes, secondsLeft: action.minutes * 60 },
      };
    case "sleepTick": {
      if (state.sleep === null) return state;
      const secondsLeft = state.sleep.secondsLeft - 1;
      // At zero the timer ends and pauses, as the real one will.
      if (secondsLeft <= 0) return { ...state, sleep: null, status: "paused" };
      return { ...state, sleep: { ...state.sleep, secondsLeft } };
    }
  }
}

/**
 * The mocked player for M6's shell (prompt 17 step 10). Elapsed advances once
 * a second while playing, at `speed`, and stops at the end. With an unknown
 * duration it has no end and keeps counting.
 */
export function useShellPlayback(durationSeconds: number | null, speed: number) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const { status } = state;
  const sleepSet = state.sleep !== null;

  useEffect(() => {
    if (status !== "buffering") return;
    const timer = setTimeout(() => dispatch({ type: "buffered" }), BUFFERING_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status !== "playing") return;
    const timer = setInterval(
      () => dispatch({ type: "tick", seconds: speed, duration: durationSeconds }),
      TICK_MS,
    );
    return () => clearInterval(timer);
  }, [status, speed, durationSeconds]);

  // Wall-clock, whether or not anything plays.
  useEffect(() => {
    if (!sleepSet) return;
    const timer = setInterval(() => dispatch({ type: "sleepTick" }), TICK_MS);
    return () => clearInterval(timer);
  }, [sleepSet]);

  return {
    status,
    elapsed: state.elapsed,
    sleep: state.sleep,
    togglePlay: () => dispatch({ type: "toggle", duration: durationSeconds }),
    seekTo: (seconds: number) => dispatch({ type: "seek", to: seconds, duration: durationSeconds }),
    skipBy: (seconds: number) => dispatch({ type: "skip", by: seconds, duration: durationSeconds }),
    setSleepTimer: (minutes: number | null) => dispatch({ type: "sleep", minutes }),
  };
}
