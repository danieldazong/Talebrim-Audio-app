/// <reference types="jest" />

import { onlineManager } from "@tanstack/react-query";
import type { AudioStatus } from "expo-audio";

import {
  getAudioSnapshot,
  onStoppedBeforeLocked,
  pausePlayback,
  playChapter,
  playLoadedFrom,
  recheckLoaded,
  releaseAudio,
  type LoadedChapter,
} from "@/lib/audio/player";
import { checkChapter, resolveNextChapter } from "@/lib/audio/resolve";
import { clearParityQueue, recordPosition, setParityUser } from "@/lib/parity/writer";
import { queryClient } from "@/lib/query-client";
import { useParityStore } from "@/store/parity-store";

// Attribution across the handoff (prompt 19 step 13): the player records the
// LOADED chapter's audio side only, whatever else records meanwhile.

/**
 * A fake `expo-audio` player. Like the native one, it reports through its
 * `playbackStatusUpdate` listener after the call that changed it, never
 * during it.
 */
class MockPlayer {
  isLoaded = false;
  playing = false;
  currentTime = 0;
  shouldCorrectPitch = false;
  private listeners: ((status: AudioStatus) => void)[] = [];

  get currentStatus(): AudioStatus {
    return {
      id: "player",
      currentTime: this.currentTime,
      playbackState: this.isLoaded ? "ready" : "idle",
      timeControlStatus: this.playing ? "playing" : "paused",
      reasonForWaitingToPlay: "",
      mute: false,
      duration: 600,
      playing: this.playing,
      loop: false,
      didJustFinish: false,
      isBuffering: false,
      isLoaded: this.isLoaded,
      playbackRate: 1,
      shouldCorrectPitch: true,
      isLive: false,
      currentOffsetFromLive: null,
      error: null,
    };
  }

  addListener(_event: string, listener: (status: AudioStatus) => void) {
    this.listeners.push(listener);
    return { remove: () => undefined };
  }

  /** A status report, as native sends one. */
  emit() {
    const status = this.currentStatus;
    setTimeout(() => {
      for (const listener of this.listeners) listener(status);
    }, 0);
  }

  replace() {
    this.isLoaded = false;
    this.playing = false;
    setTimeout(() => {
      this.isLoaded = true;
      this.emit();
    }, 0);
  }

  seekTo(seconds: number) {
    this.currentTime = seconds;
    this.emit();
    return Promise.resolve();
  }

  play() {
    this.playing = true;
    this.emit();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.emit();
  }

  /** Playing on to `seconds`: the periodic report. */
  progressTo(seconds: number) {
    this.currentTime = seconds;
    this.emit();
  }

  /** The end of the chapter: the one report with `didJustFinish`. */
  finish() {
    this.playing = false;
    this.currentTime = 600;
    const status = { ...this.currentStatus, didJustFinish: true };
    setTimeout(() => {
      for (const listener of this.listeners) listener(status);
    }, 0);
  }

  setPlaybackRate() {}
  setActiveForLockScreen() {}
  clearLockScreenControls() {}
  remove() {}
  release() {}
}

let mockPlayer: MockPlayer | null = null;

jest.mock("expo-audio", () => ({
  createAudioPlayer: () => {
    mockPlayer = new MockPlayer();
    return mockPlayer;
  },
  setAudioModeAsync: () => Promise.resolve(),
}));

// Expo Go: no lock-screen service to bind.
jest.mock("expo", () => ({ isRunningInExpoGo: () => true }));

// A signed URL for any chapter, without Storage.
jest.mock("@/lib/queries/audio", () => ({
  chapterAudioSourceOptions: (userId: string, chapterId: string) => ({
    queryKey: ["audio", "source", userId, chapterId],
    queryFn: () => Promise.resolve({ kind: "signed", url: `https://storage.test/${chapterId}.wav` }),
  }),
}));

// Nothing downloaded: every chapter signs a URL (downloads have their own
// tests in `lib/downloads/__tests__/`).
jest.mock("@/lib/downloads/local", () => ({
  downloadFor: () => null,
  localAudioUri: () => null,
}));

// Autoplay's neighbour lookups are not under test: the end of the book,
// unless a test says otherwise.
jest.mock("@/lib/audio/resolve", () => ({
  checkChapter: jest.fn(),
  resolveChapter: jest.fn(),
  resolveNextChapter: jest.fn(() => Promise.resolve(null)),
}));

// Supabase stubbed at the one call the writer makes:
// from("reading_positions").upsert(row, options).select(columns).single()
const mockUpsert = jest.fn();
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      upsert: (row: Record<string, unknown>, options: unknown) => ({
        select: () => ({ single: () => mockUpsert(table, row, options) }),
      }),
    }),
  },
}));

// Analytics is not under test here (`lib/__tests__/analytics.test.ts`).
jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));

// The real client pulls in NetInfo's native module; these need only a cache.
jest.mock("@/lib/query-client", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const USER = "user_a";
const SERVER_TIME = "2026-09-25T10:00:00.000001+00:00";

const CHAPTER_4: LoadedChapter = {
  chapterId: "chapter-4",
  bookId: "book-1",
  number: 4,
  title: null,
  bookTitle: "Book",
  author: null,
  coverUrl: null,
  durationSeconds: 600,
};

function position(chapterId: string) {
  return useParityStore.getState().getPosition(chapterId);
}

/** The rows sent for one chapter, in order. */
function upsertsFor(chapterId: string): Record<string, unknown>[] {
  return mockUpsert.mock.calls
    .map(([, row]) => row as Record<string, unknown>)
    .filter((row) => row.chapter_id === chapterId);
}

/** Lets pending reports, loads and requests run, well short of the writer's two-second debounce. */
async function settle() {
  await jest.advanceTimersByTimeAsync(100);
}

function player(): MockPlayer {
  if (mockPlayer === null) throw new Error("nothing has played");
  return mockPlayer;
}

/** Chapter 4 loaded and playing from its start. */
async function playChapter4() {
  playChapter(USER, CHAPTER_4, 0);
  await settle();
  expect(getAudioSnapshot()).toMatchObject({ chapter: CHAPTER_4, phase: "ready" });
}

beforeEach(() => {
  jest.useFakeTimers();
  // The player's and the writer's development logs.
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockUpsert.mockReset();
  mockUpsert.mockImplementation(async (_table: string, row: Record<string, unknown>) => ({
    data: { id: "row", audio_ms: null, text_offset: null, ...row, updated_at: SERVER_TIME },
    error: null,
  }));
  clearParityQueue();
  useParityStore.getState().clear();
  queryClient.clear();
  onlineManager.setOnline(true);
  setParityUser(USER);
});

afterEach(() => {
  releaseAudio();
  mockPlayer = null;
  jest.useRealTimers();
});

it("records chapter 4's audio side only, while chapter 7's text records beside it, and a pause flushes both", async () => {
  await playChapter4();

  player().progressTo(12.5);
  await settle();
  // The reader, open on another chapter.
  recordPosition({ chapterId: "chapter-7", bookId: "book-1", mode: "text", value: 420 });
  player().progressTo(30);
  await settle();

  expect(position("chapter-4")).toMatchObject({ audioMs: 30_000, textOffset: null, lastWrittenBy: "audio" });
  expect(position("chapter-7")).toMatchObject({ textOffset: 420, audioMs: null, lastWrittenBy: "text" });
  // Nothing sent yet: the debounce has not passed.
  expect(mockUpsert).not.toHaveBeenCalled();

  // Paused from outside the app (the lock screen, a call): sent now.
  player().pause();
  await settle();

  expect(upsertsFor("chapter-4")).toEqual([
    { chapter_id: "chapter-4", book_id: "book-1", last_mode: "audio", audio_ms: 30_000 },
  ]);
  expect(upsertsFor("chapter-7")).toEqual([
    { chapter_id: "chapter-7", book_id: "book-1", last_mode: "text", text_offset: 420 },
  ]);
  expect(position("chapter-4")).toMatchObject({ audioMs: 30_000, textOffset: null, dirty: false });
  expect(position("chapter-7")).toMatchObject({ textOffset: 420, audioMs: null, dirty: false });
});

it("records and flushes on Read instead's pause, and a paused player never takes the place back from the reader", async () => {
  await playChapter4();
  player().progressTo(40);
  await settle();

  // Read instead: the pause records where the listener was, and sends it.
  pausePlayback();
  await settle();
  expect(upsertsFor("chapter-4")).toEqual([
    { chapter_id: "chapter-4", book_id: "book-1", last_mode: "audio", audio_ms: 40_000 },
  ]);

  // The reader opens and reads on.
  recordPosition({ chapterId: "chapter-4", bookId: "book-1", mode: "text", value: 1_234 });
  // A paused player still reports (buffering, state changes): the same place.
  player().emit();
  await settle();
  expect(position("chapter-4")).toMatchObject({ lastWrittenBy: "text", textOffset: 1_234, audioMs: 40_000 });

  // A skip from the lock screen while paused moves the place: that records.
  player().seekTo(50);
  await settle();
  expect(position("chapter-4")).toMatchObject({ lastWrittenBy: "audio", audioMs: 50_000, textOffset: 1_234 });
});

it("plays a paused chapter from the reading place, and records it as listening", async () => {
  await playChapter4();
  player().progressTo(40);
  await settle();
  pausePlayback();
  await settle();
  recordPosition({ chapterId: "chapter-4", bookId: "book-1", mode: "text", value: 1_234 });

  // M6's Play, with the reading place mapped into the narration.
  playLoadedFrom(90_000);
  await settle();

  expect(player()).toMatchObject({ playing: true, currentTime: 90 });
  expect(position("chapter-4")).toMatchObject({ lastWrittenBy: "audio", audioMs: 90_000, textOffset: 1_234 });
});

it("stops at the end before a locked chapter and reports it, for M6 to open M5a", async () => {
  jest.mocked(resolveNextChapter).mockResolvedValueOnce({ kind: "locked", chapterId: "chapter-5" });
  const stopped = jest.fn();
  const unsubscribe = onStoppedBeforeLocked(stopped);
  try {
    await playChapter4();
    player().finish();
    await settle();

    expect(stopped).toHaveBeenCalledTimes(1);
    expect(stopped).toHaveBeenCalledWith("chapter-4", "chapter-5");
    // Nothing else loads: the finished chapter stays, paused at its end.
    expect(getAudioSnapshot().chapter).toEqual(CHAPTER_4);
    expect(player().playing).toBe(false);
  } finally {
    unsubscribe();
  }
});

describe("a chapter the owner locks while it is loaded (2026-09-30)", () => {
  const LOCKED = { kind: "locked", chapterId: "chapter-4" } as const;

  it("stops: paused, its place recorded and sent, then unloaded, so the mini player lets it go", async () => {
    jest.mocked(checkChapter).mockResolvedValueOnce(LOCKED);
    await playChapter4();
    player().progressTo(40);
    await settle();

    await recheckLoaded({ bookIds: ["book-1"], chapterIds: ["chapter-4"] });
    await settle();

    expect(checkChapter).toHaveBeenCalledWith(USER, "chapter-4");
    expect(getAudioSnapshot().chapter).toBeNull();
    expect(upsertsFor("chapter-4").at(-1)).toMatchObject({ audio_ms: 40_000, last_mode: "audio" });
  });

  it("checks after a catch-up with no scope too", async () => {
    jest.mocked(checkChapter).mockResolvedValueOnce(LOCKED);
    await playChapter4();
    await recheckLoaded(null);
    expect(getAudioSnapshot().chapter).toBeNull();
  });

  it("plays on for a change elsewhere, a chapter still playable, a failed check, or offline", async () => {
    await playChapter4();
    const checks = jest.mocked(checkChapter);
    checks.mockClear();

    // Another chapter of the book changed: nothing to check.
    await recheckLoaded({ bookIds: ["book-1"], chapterIds: ["chapter-7"] });
    expect(checks).not.toHaveBeenCalled();

    // Its title changed, and it is still this reader's to play.
    checks.mockResolvedValueOnce({ kind: "playable" } as Awaited<ReturnType<typeof checkChapter>>);
    await recheckLoaded({ bookIds: ["book-1"], chapterIds: ["chapter-4"] });

    // No definite answer changes nothing.
    checks.mockRejectedValueOnce(new Error("offline mid-check"));
    await recheckLoaded({ bookIds: ["book-1"], chapterIds: ["chapter-4"] });

    onlineManager.setOnline(false);
    await recheckLoaded({ bookIds: ["book-1"], chapterIds: ["chapter-4"] });
    expect(checks).toHaveBeenCalledTimes(2);

    expect(getAudioSnapshot().chapter).toEqual(CHAPTER_4);
    expect(player().playing).toBe(true);
  });
});
