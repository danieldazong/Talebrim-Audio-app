// The app's one audio player — AGENTS.md § Audio Rules, prompt 18.
// No React, no hooks, no JSX (AGENTS.md § lib/).
//
// One `createAudioPlayer()`, made the first time anything plays and released
// only at sign-out. It outlives M6, which is what keeps the mini player, the
// lock screen and background playback working with the screen closed. Never
// `useAudioPlayer()`: it releases its player when the component unmounts.
//
// ONE `playbackStatusUpdate` listener, here, never in a component. It records
// the LOADED chapter's position through `lib/parity` (never the one on screen),
// flushes on every pause, recovers from an expired URL, autoplays the next
// chapter and checks the sleep timer, with M6 closed and the app in the
// background. Screens read the same status from it through
// `subscribeAudio()` and `getAudioSnapshot()` (`hooks/use-audio.ts`), so M6 and
// the mini player can never disagree.
import { isRunningInExpoGo } from "expo";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from "expo-audio";
import { AppState, Platform } from "react-native";

import { resolveChapter, resolveNextChapter, type LoadedChapter } from "@/lib/audio/resolve";
import {
  chooseDuration,
  playbackStatusOf,
  sleepTimerDue,
  type LoadPhase,
  type PlaybackStatus,
} from "@/lib/audio/rules";
import { flush, recordPosition } from "@/lib/parity/writer";
import { chapterAudioSourceOptions, type ChapterAudioSource } from "@/lib/queries/audio";
import { queryClient } from "@/lib/query-client";
import { usePlaybackStore } from "@/store/playback-store";

export type { LoadedChapter } from "@/lib/audio/resolve";

export type AudioSnapshot = {
  /** The loaded chapter; null until something plays, and after sign-out. */
  chapter: LoadedChapter | null;
  phase: LoadPhase;
  /** The player's latest status for the loaded chapter; null while a load starts. */
  status: AudioStatus | null;
  /** Where the current load is headed, in milliseconds: what the scrubber shows while it loads. */
  targetMs: number;
};

/** How often the player reports while playing: the scrubber's tick and the parity writer's input. */
const STATUS_INTERVAL_MS = 500;
/** How long a load may take to report loaded before it counts as failed. */
const LOAD_TIMEOUT_MS = 30_000;
/** How long the button stays Buffering after Play before it shows the player's own state. */
const PLAY_START_TIMEOUT_MS = 5_000;
/** How far a seek may land from where it was sent before it is sent again. */
const SEEK_TOLERANCE_SECONDS = 1.5;
/**
 * Android's ExoPlayer holds a seek sent while it loads and starts buffering
 * from there. AVPlayer can drop one sent before the item is ready, so iOS
 * seeks after the load.
 */
const SEEK_WHILE_LOADING = Platform.OS === "android";
/** How far through a chapter the next one's URL is minted. */
const PREFETCH_NEXT_AT = 0.9;
/**
 * How far a paused player's position must move (a lock-screen skip) before
 * the listener records it. Less is the same place reported again.
 */
const PAUSED_MOVE_MS = 1_000;
/**
 * An error with less progress than this since the last recovery is the file
 * or the network, not an expired URL: the chapter fails instead of
 * reloading in a loop.
 */
const RECOVERY_PROGRESS_MS = 2_000;

/**
 * Expo Go's own manifest has no `AudioControlsService`: the config plugin
 * adds it only to a build made from this project. Binding it there always
 * fails and logs an error on every load, so Expo Go skips the lock screen.
 * The development build has it (AGENTS.md § Deferred setup).
 */
const LOCK_SCREEN_AVAILABLE = !isRunningInExpoGo();

const EMPTY: AudioSnapshot = { chapter: null, phase: "ready", status: null, targetMs: 0 };

let player: AudioPlayer | null = null;
let subscriptions: { remove: () => void }[] = [];
let audioMode: Promise<void> | null = null;
let snapshot: AudioSnapshot = EMPTY;
const listeners = new Set<() => void>();
const advanceListeners = new Set<(fromChapterId: string, toChapterId: string) => void>();

/** The account the loaded chapter plays under: autoplay and a re-mint read as it. */
let userId: string | null = null;
/** Bumped by every load, recovery and release: an async step that finds it changed stops. */
let generation = 0;
/** Whether playback should run: what a load ends in, and what a recovery resumes. */
let wantsToPlay = false;
/** The listener's previous `playing`, to tell a pause from a tick. */
let lastPlaying = false;
/** The loaded chapter's latest position, in milliseconds. */
let positionMs = 0;
/** Where the last recovery resumed; null before one. */
let recoveredAt: number | null = null;
/** A load waiting on the player. Driven by the one listener, never by its own. */
let loadWaiter: (() => void) | null = null;
/** The error the player reported since the last `replace()`, so a load that wasn't waiting at that moment still sees it. */
let loadError: string | null = null;
/** The chapter whose next chapter's URL was minted ahead. */
let prefetchedAfter: string | null = null;
let sleepTimer: ReturnType<typeof setTimeout> | null = null;

function log(...args: unknown[]) {
  if (__DEV__) console.log("[audio]", ...args);
}

// --- Snapshot -----------------------------------------------------------

/** For `useSyncExternalStore`: called whenever the snapshot changes. */
export function subscribeAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAudioSnapshot(): AudioSnapshot {
  return snapshot;
}

/** The play button's state, for M6 and the mini player alike. */
export function getPlaybackStatus(): PlaybackStatus {
  return playbackStatusOf(snapshot.phase, snapshot.status);
}

/**
 * Called with the chapter autoplay moved from and the one it moved to, so an
 * M6 showing the finished chapter can follow. Returns the unsubscribe.
 */
export function onChapterAdvance(listener: (fromChapterId: string, toChapterId: string) => void): () => void {
  advanceListeners.add(listener);
  return () => {
    advanceListeners.delete(listener);
  };
}

function update(next: Partial<AudioSnapshot>) {
  const chapterChanged = next.chapter !== undefined && next.chapter !== snapshot.chapter;
  snapshot = { ...snapshot, ...next };
  // `currentChapterId` mirrors the loaded chapter, and only this sets it.
  if (chapterChanged) usePlaybackStore.getState().setCurrentChapterId(snapshot.chapter?.chapterId ?? null);
  for (const listener of listeners) listener();
}

// --- The player ---------------------------------------------------------

function ensurePlayer(): AudioPlayer {
  if (player !== null) return player;
  const created = createAudioPlayer(null, { updateInterval: STATUS_INTERVAL_MS });
  created.shouldCorrectPitch = true;
  subscriptions = [
    created.addListener("playbackStatusUpdate", onStatus),
    // JavaScript timers can run late in the background.
    AppState.addEventListener("change", (state) => {
      if (state === "active") checkSleepTimer();
    }),
  ];
  player = created;
  return created;
}

/** Once, before the first play. A failure is logged and tried again at the next load. */
function ensureAudioMode(): Promise<void> {
  audioMode ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    // Exclusive focus: other apps pause, a call pauses this one, and the
    // lock screen controls attach to this player.
    interruptionMode: "doNotMix",
  }).catch((error: unknown) => {
    audioMode = null;
    log("audio mode failed", error);
  });
  return audioMode;
}

/** "Chapter 12: The Moon Rises", or "Chapter 12" untitled — M6's chapter line. */
function chapterLine(chapter: LoadedChapter): string {
  return chapter.title ? `Chapter ${chapter.number}: ${chapter.title}` : `Chapter ${chapter.number}`;
}

/**
 * On every load. On Android this is also what keeps playback alive in the
 * background past about three minutes (the media playback service).
 */
function showOnLockScreen(target: AudioPlayer, chapter: LoadedChapter) {
  if (!LOCK_SCREEN_AVAILABLE) return;
  target.setActiveForLockScreen(
    true,
    {
      title: chapterLine(chapter),
      artist: chapter.author ?? undefined,
      albumTitle: chapter.bookTitle,
      artworkUrl: chapter.coverUrl ?? undefined,
    },
    { showSeekBackward: true, showSeekForward: true },
  );
}

/**
 * Resolves true once `ready()` holds, false after `timeoutMs`, and rejects on
 * a playback error. Checked now, and again on every status.
 */
function waitFor(gen: number, ready: () => boolean, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const settle = (finish: () => void) => {
      clearTimeout(timer);
      if (loadWaiter === check) loadWaiter = null;
      finish();
    };
    const check = () => {
      if (gen !== generation) settle(() => resolve(false));
      else if (loadError !== null) settle(() => reject(new Error(loadError ?? "playback error")));
      else if (ready()) settle(() => resolve(true));
    };
    const timer = setTimeout(() => settle(() => resolve(false)), timeoutMs);
    loadWaiter = check;
    check();
  });
}

/** Seeks, then reads where the player actually is, and sends it once more if it did not take. */
async function seekVerified(target: AudioPlayer, seconds: number) {
  await target.seekTo(seconds);
  if (Math.abs(target.currentTime - seconds) <= SEEK_TOLERANCE_SECONDS) return;
  log("seek did not take, sending again", { wanted: seconds, at: target.currentTime });
  await target.seekTo(seconds);
  if (Math.abs(target.currentTime - seconds) > SEEK_TOLERANCE_SECONDS) {
    log("seek still off", { wanted: seconds, at: target.currentTime });
  }
}

/**
 * The chapter's signed URL, from the cache while it is fresh. `fresh` signs a
 * new one (a re-mint). Offline with nothing fresh cached, the fetch waits
 * for a connection, and the phase says so meanwhile.
 */
async function fetchSource(account: string, chapterId: string, gen: number, fresh: boolean): Promise<ChapterAudioSource> {
  const options = chapterAudioSourceOptions(account, chapterId);
  const request = queryClient.fetchQuery(fresh ? { ...options, staleTime: 0 } : options);
  if (queryClient.getQueryState(options.queryKey)?.fetchStatus === "paused") update({ phase: "offline" });
  const source = await request;
  if (gen === generation && snapshot.phase === "offline") update({ phase: "loading" });
  return source;
}

/**
 * Signs (or reuses) the chapter's URL, `replace()`s it, seeks to `startMs`,
 * applies the speed and the lock screen, and plays if playback is wanted.
 * Any failure leaves the chapter loaded in the `failed` phase, where M6
 * offers Retry.
 *
 * On Android the seek and the play go out with the `replace()`, so the
 * player fetches from `startMs` and starts the moment it has enough. Waiting
 * for the load first would buffer the chapter's opening, then seek away and
 * buffer again: a second round trip to Storage before any sound. The place
 * is still checked once loaded, and sent again if the seek did not take.
 * iOS loads, seeks and checks, then plays.
 */
async function open(target: AudioPlayer, chapter: LoadedChapter, startMs: number, gen: number, fresh: boolean) {
  const startedAt = Date.now();
  try {
    if (userId === null) throw new Error("signed out");
    const [source] = await Promise.all([fetchSource(userId, chapter.chapterId, gen, fresh), ensureAudioMode()]);
    if (gen !== generation) return;
    if (source.kind !== "signed") throw new Error(`nothing to sign (${source.kind})`);

    loadError = null;
    target.replace({ uri: source.url });
    target.setPlaybackRate(usePlaybackStore.getState().speed, "high");
    if (SEEK_WHILE_LOADING) {
      if (startMs > 0) void target.seekTo(startMs / 1000);
      if (wantsToPlay) target.play();
    }

    if (!(await waitFor(gen, () => target.isLoaded, LOAD_TIMEOUT_MS))) {
      if (gen !== generation) return;
      throw new Error("load timed out");
    }
    if (gen !== generation) return;
    const loadedAt = Date.now();

    if (!SEEK_WHILE_LOADING) {
      if (startMs > 0) await seekVerified(target, startMs / 1000);
    } else if (startMs > 0 && target.currentTime + SEEK_TOLERANCE_SECONDS < startMs / 1000) {
      // Dropped after all: it would be playing from the chapter's start.
      log("seek sent while loading did not take, sending again", { wanted: startMs / 1000, at: target.currentTime });
      await seekVerified(target, startMs / 1000);
    }
    showOnLockScreen(target, chapter);
    if (gen !== generation) return;

    if (wantsToPlay) {
      if (!target.playing) target.play();
      // Buffering until it actually plays, so the button never flashes Play in between.
      await waitFor(gen, () => target.playing, PLAY_START_TIMEOUT_MS);
      if (gen !== generation) return;
    }
    log("chapter started", {
      chapterId: chapter.chapterId,
      loadedAfterMs: loadedAt - startedAt,
      readyAfterMs: Date.now() - startedAt,
    });
    positionMs = Math.round(target.currentTime * 1000);
    // Read now rather than waiting for the next event, which could still
    // carry the time from before the seek.
    update({ phase: "ready", status: target.currentStatus });
  } catch (error) {
    if (gen !== generation) return;
    log("load failed", chapter.chapterId, error);
    update({ phase: "failed" });
  }
}

/** Records where the loaded chapter is now, from the player itself rather than the last status. */
function recordLoaded() {
  const chapter = snapshot.chapter;
  if (player === null || chapter === null || snapshot.phase !== "ready" || !player.isLoaded) return;
  positionMs = Math.round(player.currentTime * 1000);
  recordPosition({ chapterId: chapter.chapterId, bookId: chapter.bookId, mode: "audio", value: positionMs });
}

/** Loads `chapter` at `startMs`, playing it when `play`. The chapter it replaces is recorded and flushed first. */
function load(chapter: LoadedChapter, startMs: number, play: boolean): Promise<void> {
  const target = ensurePlayer();
  recordLoaded();
  void flush();
  const gen = ++generation;
  // `replace()` keeps playing a player that was playing: the new chapter
  // starts on its own terms instead.
  target.pause();
  wantsToPlay = play;
  lastPlaying = false;
  positionMs = startMs;
  recoveredAt = null;
  prefetchedAfter = null;
  update({ chapter, phase: "loading", status: null, targetMs: startMs });
  return open(target, chapter, startMs, gen, false);
}

/**
 * An expired URL or a dropped stream: signs a new URL, reloads it and resumes
 * where it was, without the listener noticing. A second failure with no
 * progress in between is real, and the chapter fails.
 */
function recover(): Promise<void> {
  const chapter = snapshot.chapter;
  if (player === null || chapter === null) return Promise.resolve();
  void flush();
  if (recoveredAt !== null && positionMs - recoveredAt < RECOVERY_PROGRESS_MS) {
    generation += 1;
    update({ phase: "failed" });
    return Promise.resolve();
  }
  recoveredAt = positionMs;
  const gen = ++generation;
  lastPlaying = false;
  update({ phase: "loading", targetMs: positionMs });
  return open(player, chapter, positionMs, gen, true);
}

// --- The one listener ---------------------------------------------------

function onStatus(status: AudioStatus) {
  checkSleepTimer();
  if (status.error) loadError = status.error;
  update({ status });
  loadWaiter?.();

  const chapter = snapshot.chapter;
  if (chapter === null || snapshot.phase !== "ready") return;
  if (status.error) {
    void recover();
    return;
  }

  // Parity step 1, then the writer's debounce and ten-second maximum wait
  // are the interval. Always the LOADED chapter, never the one on screen.
  // Only while playing, at the pause, or when a paused place moves: a paused
  // player still reports now and then (buffering, state changes), and
  // recording the same place again would take `last_mode` back from the
  // reader after Read instead (prompt 19 step 4). The app's own seeks record
  // in `seekPlayback()`.
  if (status.isLoaded) {
    const ms = Math.round(status.currentTime * 1000);
    if (status.playing || lastPlaying || Math.abs(ms - positionMs) >= PAUSED_MOVE_MS) {
      positionMs = ms;
      recordPosition({ chapterId: chapter.chapterId, bookId: chapter.bookId, mode: "audio", value: positionMs });
    }
  }
  // Only a loaded or buffering player says what the listener wants. An idle
  // one has stopped on an error, which a recovery resumes.
  if (status.isLoaded || status.isBuffering) wantsToPlay = status.playing;
  // A pause from anywhere (the app, the lock screen, a call, another app
  // taking audio focus) sends the position now.
  if (lastPlaying && !status.playing) void flush();
  lastPlaying = status.playing;

  if (status.didJustFinish) void advance(chapter);
  else prefetchNext(chapter, status);
}

/** Mints the next chapter's URL ahead, once, 90% through. Never for a locked chapter. */
function prefetchNext(chapter: LoadedChapter, status: AudioStatus) {
  if (prefetchedAfter === chapter.chapterId || userId === null) return;
  const duration = chooseDuration(chapter.durationSeconds, status.duration);
  if (duration === null || status.currentTime < duration * PREFETCH_NEXT_AT) return;

  prefetchedAfter = chapter.chapterId;
  const account = userId;
  const gen = generation;
  resolveNextChapter(account, chapter)
    .then((next) => {
      if (gen !== generation || next?.kind !== "playable") return;
      void queryClient.prefetchQuery(chapterAudioSourceOptions(account, next.chapter.chapterId));
    })
    .catch((error: unknown) => log("next chapter prefetch failed", error));
}

/**
 * Autoplay, on `didJustFinish`: the end is already recorded, so it is
 * flushed, then the next chapter plays at its restore point if it is
 * unlocked and narrated. A locked one, one without narration, or the end of
 * the book stops cleanly.
 */
async function advance(finished: LoadedChapter) {
  const gen = generation;
  await flush();
  if (gen !== generation || userId === null) return;

  let next;
  try {
    next = await resolveNextChapter(userId, finished);
  } catch (error) {
    log("autoplay stopped: next chapter unresolved", error);
    return;
  }
  if (gen !== generation || next === null) return;
  if (next.kind === "locked") {
    // TODO(paywall): M5a opens here, for the next chapter.
    return;
  }
  if (next.kind !== "playable") return;

  const loading = load(next.chapter, next.startMs, true);
  for (const listener of advanceListeners) listener(finished.chapterId, next.chapter.chapterId);
  await loading;
}

// --- Controls -----------------------------------------------------------

/**
 * M6's Play for a chapter that isn't loaded: records and flushes the old
 * chapter, loads this one at `startMs`, and plays it.
 */
export function playChapter(account: string, chapter: LoadedChapter, startMs: number): void {
  userId = account;
  void load(chapter, startMs, true);
}

/**
 * Previous or next on the loaded chapter: a real track change. The
 * neighbour loads at its restore point and keeps playing if this was. One
 * that can't play (locked, no narration, gone) pauses this one instead;
 * M6 shows the neighbour's state.
 */
export async function skipToChapter(chapterId: string): Promise<void> {
  if (userId === null || snapshot.chapter === null) return;
  const gen = generation;
  const resume = wantsToPlay;
  try {
    const verdict = await resolveChapter(userId, chapterId);
    if (gen !== generation) return;
    if (verdict.kind === "playable") await load(verdict.chapter, verdict.startMs, resume);
    else pausePlayback();
  } catch (error) {
    log("chapter change failed", chapterId, error);
    if (gen === generation) pausePlayback();
  }
}

export function pausePlayback(): void {
  if (player === null) return;
  wantsToPlay = false;
  player.pause();
  recordLoaded();
  void flush();
}

/** Play or pause the loaded chapter. From the failed state it retries the load instead. */
export function togglePlayback(): void {
  const target = player;
  const chapter = snapshot.chapter;
  if (target === null || chapter === null) return;
  if (snapshot.phase === "failed") {
    retryLoaded();
    return;
  }
  if (getPlaybackStatus() !== "paused") {
    pausePlayback();
    return;
  }
  if (snapshot.phase !== "ready") {
    // Waiting for a connection: play once it loads.
    wantsToPlay = true;
    return;
  }
  // Play at the end starts the chapter again.
  const duration = chooseDuration(chapter.durationSeconds, snapshot.status?.duration);
  if (duration !== null && target.currentTime >= duration - 0.5) void target.seekTo(0);
  wantsToPlay = true;
  target.play();
}

/** M6's Retry on the loaded chapter: a new URL, and the load again from where it stopped. */
export function retryLoaded(): void {
  recoveredAt = null;
  void recover();
}

/**
 * Seeks the loaded chapter, clamped to the chapter, and records the new
 * place: a seek is the listener choosing it, playing or paused.
 */
export function seekPlayback(seconds: number): void {
  const chapter = snapshot.chapter;
  if (player === null || chapter === null || snapshot.phase !== "ready") return;
  const duration = chooseDuration(chapter.durationSeconds, snapshot.status?.duration);
  const to = Math.max(0, duration === null ? seconds : Math.min(seconds, duration));
  positionMs = Math.round(to * 1000);
  void player.seekTo(to);
  recordPosition({ chapterId: chapter.chapterId, bookId: chapter.bookId, mode: "audio", value: positionMs });
}

/**
 * M6's Play on the loaded chapter when reading has moved its place since it
 * paused (prompt 19 step 4): plays from `ms`, the reading place mapped into
 * the narration, not from where the audio paused.
 */
export function playLoadedFrom(ms: number): void {
  if (player === null || snapshot.chapter === null || snapshot.phase !== "ready") {
    togglePlayback();
    return;
  }
  seekPlayback(ms / 1000);
  wantsToPlay = true;
  player.play();
}

export function skipPlayback(deltaSeconds: number): void {
  if (player === null) return;
  seekPlayback(player.currentTime + deltaSeconds);
}

/** The `playback` slice stays the source; the player follows it now and after every load. */
export function setPlaybackSpeed(speed: number): void {
  usePlaybackStore.getState().setSpeed(speed);
  // Pitch-corrected: `shouldCorrectPitch` is set on creation.
  player?.setPlaybackRate(speed, "high");
}

// --- Sleep timer ----------------------------------------------------------

/** Runs `checkSleepTimer()` at the end time. A timer that fires early reschedules itself. */
function scheduleSleepCheck(endsAt: number) {
  if (sleepTimer !== null) clearTimeout(sleepTimer);
  sleepTimer = setTimeout(
    () => {
      sleepTimer = null;
      checkSleepTimer();
      const pending = usePlaybackStore.getState().sleepTimerEndsAt;
      if (pending !== null) scheduleSleepCheck(pending);
    },
    Math.max(0, endsAt - Date.now()),
  );
}

/**
 * Starts the sleep timer for `minutes`, or turns it off with null. It lives
 * here, not in a screen, so it keeps running when M6 closes. Only Off,
 * reaching the end and sign-out clear it.
 */
export function setSleepTimer(minutes: number | null): void {
  if (sleepTimer !== null) clearTimeout(sleepTimer);
  sleepTimer = null;
  if (minutes === null) {
    usePlaybackStore.getState().setSleepTimer(null);
    return;
  }
  const endsAt = Date.now() + minutes * 60_000;
  usePlaybackStore.getState().setSleepTimer({ endsAt, length: minutes });
  scheduleSleepCheck(endsAt);
}

/** Pauses playback once the sleep timer's end has passed. Also run on every status and on return to the foreground. */
function checkSleepTimer() {
  if (!sleepTimerDue(usePlaybackStore.getState().sleepTimerEndsAt, Date.now())) return;
  setSleepTimer(null);
  pausePlayback();
}

// --- Sign-out -------------------------------------------------------------

/**
 * Sign-out, before its parity flush: pauses, and records where the listener
 * was, so that flush sends it under this account.
 */
export function stopForSignOut(): void {
  pausePlayback();
}

/**
 * Sign-out, from `clearUserScopedState()`: the next account never hears or
 * sees this one's chapter. In order: pause, clear the lock screen, the sleep
 * timer and `currentChapterId`, then release the player. The next play makes
 * a new one.
 */
export function releaseAudio(): void {
  generation += 1;
  loadWaiter = null;
  loadError = null;
  const released = player;
  player = null;

  if (released !== null) {
    released.pause();
    released.clearLockScreenControls();
  }
  setSleepTimer(null);
  userId = null;
  wantsToPlay = false;
  lastPlaying = false;
  positionMs = 0;
  recoveredAt = null;
  prefetchedAfter = null;
  update(EMPTY);

  for (const subscription of subscriptions) subscription.remove();
  subscriptions = [];
  if (released !== null) {
    // Out of the module's own registry first: Android's release leaves it
    // there, where audio focus changes would still reach it.
    released.remove();
    released.release();
  }
}
