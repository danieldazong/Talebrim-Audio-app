/// <reference types="jest" />

import { onlineManager } from "@tanstack/react-query";
import { AppState, Platform, type AppStateStatus, type NativeEventSubscription } from "react-native";

import { releaseAudio } from "@/lib/audio/player";
import {
  prepareDownloads,
  reconcileDownloads,
  removeAllDownloads,
  startDownloads,
  verifyDownloads,
} from "@/lib/downloads/manage";
import { cancelBookDownloads, getDownloadQueue, stopDownloads } from "@/lib/downloads/queue";
import { queryClient } from "@/lib/query-client";
import { clearUserScopedState } from "@/lib/session";
import { useDownloadsStore, type DownloadEntry } from "@/store/downloads-store";

// Offline downloads end to end (prompt 24 step 15): the queue, the online
// access check, reconciling on start and sign-out, against an in-memory
// `expo-file-system`, as `player.test.ts` fakes `expo-audio`. Supabase and
// RevenueCat are stubbed at the calls the queries make.

// --- A fake file system --------------------------------------------------

/** Every file on the fake disk, by URI, with its contents. Every test string is ASCII, so its length is its size in bytes. */
const mockDisk = new Map<string, string>();
const mockFs = {
  freeBytes: 10_000_000_000,
  /** While set, a download writes half its bytes and waits: released, paused, or failed by the test. */
  hold: null as null | { release: () => void; fail: (error: Error) => void },
  holding: false,
  /** Every download task started, in order, with the byte it started from (a Range request's start). */
  tasks: [] as { state: string; from: number }[],
  /** URLs downloaded, in order. */
  downloads: [] as string[],
  /** When set, a resumed download fails, as a server refusing the Range would. */
  failResume: false,
};

jest.mock("expo-file-system", () => {
  const partsToUri = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === "string" ? part : (part as { uri: string }).uri))
      .join("/");

  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = partsToUri(parts);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    get exists() {
      return mockDisk.has(this.uri);
    }
    get size() {
      return (mockDisk.get(this.uri) ?? "").length;
    }
    write(content: string) {
      mockDisk.set(this.uri, content);
    }
    delete() {
      if (!mockDisk.delete(this.uri)) throw new Error("no such file");
    }
    moveSync(target: MockFile) {
      const content = mockDisk.get(this.uri);
      if (content === undefined) throw new Error("no such file");
      mockDisk.delete(this.uri);
      mockDisk.set(target.uri, content);
      this.uri = target.uri;
    }
    text() {
      const content = mockDisk.get(this.uri);
      return content === undefined ? Promise.reject(new Error("no such file")) : Promise.resolve(content);
    }
    static createDownloadTask(url: string, destination: MockFile, options: MockTaskOptions) {
      return new MockDownloadTask(url, destination, options, 0);
    }
  }

  type MockTaskOptions = { onProgress?: (progress: { bytesWritten: number; totalBytes: number }) => void };

  // `DownloadTask` as Android runs it: a pause settles the promise with null
  // and leaves the bytes so far; a resume sends a Range from `resumeData` and
  // appends.
  class MockDownloadTask {
    state = "idle";
    private settle: ((file: MockFile | null) => void) | null = null;
    url: string;
    destination: MockFile;
    options: MockTaskOptions;
    from: number;
    constructor(url: string, destination: MockFile, options: MockTaskOptions, from: number) {
      this.url = url;
      this.destination = destination;
      this.options = options;
      this.from = from;
    }
    static fromSavable(saved: { url: string; fileUri: string; resumeData?: string }, options: MockTaskOptions) {
      const task = new MockDownloadTask(saved.url, new MockFile(saved.fileUri), options ?? {}, Number(saved.resumeData));
      task.state = "paused";
      return task;
    }
    downloadAsync() {
      if (this.state !== "idle") throw new Error(`downloadAsync() in state ${this.state}`);
      return this.run(0);
    }
    resumeAsync() {
      if (this.state !== "paused") throw new Error(`resumeAsync() in state ${this.state}`);
      return this.run(this.from);
    }
    pause() {
      if (this.state !== "active") throw new Error(`pause() in state ${this.state}`);
      this.state = "paused";
      this.settle?.(null);
    }
    release() {}
    private run(from: number) {
      this.state = "active";
      mockFs.downloads.push(this.url);
      mockFs.tasks.push(this);
      const uri = this.destination.uri;
      // The "file": as many bytes as the URL asks for.
      const size = Number(/[?&]bytes=(\d+)/.exec(this.url)?.[1] ?? 1000);
      const body = "a".repeat(size);
      const kept = (mockDisk.get(uri) ?? "").slice(0, from);
      return new Promise<MockFile | null>((resolve, reject) => {
        this.settle = resolve;
        const fail = (error: Error) => {
          if (this.state !== "active") return;
          this.state = "error";
          reject(error);
        };
        if (from > 0 && mockFs.failResume) return fail(new Error("HTTP 416"));
        const half = body.slice(0, Math.max(from, Math.floor(size / 2)));
        // Android streams into the destination: a failure leaves part of it.
        if (mockFs.freeBytes < size - from) {
          mockDisk.set(uri, kept + half.slice(from));
          return fail(new Error("ENOSPC: no space left on device"));
        }
        const finish = () => {
          if (this.state !== "active") return;
          mockDisk.set(uri, kept + body.slice(from));
          this.options.onProgress?.({ bytesWritten: size, totalBytes: size });
          this.state = "completed";
          resolve(this.destination);
        };
        if (mockFs.holding) {
          mockDisk.set(uri, kept + half.slice(from));
          this.options.onProgress?.({ bytesWritten: half.length, totalBytes: size });
          mockFs.hold = { release: finish, fail };
        } else {
          setTimeout(finish, 0);
        }
      });
    }
  }

  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = partsToUri(parts);
    }
    get exists() {
      return [...mockDisk.keys()].some((uri) => uri.startsWith(`${this.uri}/`));
    }
    create() {}
    delete() {
      for (const uri of [...mockDisk.keys()]) if (uri.startsWith(`${this.uri}/`)) mockDisk.delete(uri);
    }
    list() {
      const prefix = `${this.uri}/`;
      return [...mockDisk.keys()]
        .filter((uri) => uri.startsWith(prefix) && !uri.slice(prefix.length).includes("/"))
        .map((uri) => new MockFile(uri));
    }
  }

  return {
    File: MockFile,
    Directory: MockDirectory,
    DownloadTask: MockDownloadTask,
    Paths: {
      document: new MockDirectory("file:///document"),
      get availableDiskSpace() {
        return mockFs.freeBytes;
      },
    },
  };
});

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// --- The server, stubbed ---------------------------------------------------

type MockChapter = {
  id: string;
  book_id: string;
  number: number;
  title: string | null;
  access: "free" | "locked";
  audio_path: string | null;
  script_text: string | null;
  audio_duration_seconds: number | null;
  updated_at: string;
};

const mockServer = {
  settings: { public_cdn_domain: "https://cdn.test", free_chapters_at_start: 3, default_chapter_access: "locked" },
  chapters: [] as MockChapter[],
  unlocks: [] as { id: string; chapter_id: string; source: string; created_at: string }[],
  /** Chapter paths Storage refuses to sign: the audio policy saying no. */
  refused: new Set<string>(),
  /** Tables whose reads fail, as a dropped request would. */
  failing: new Set<string>(),
  /** What the catalog says each narration weighs (`audio_size_bytes`). */
  sizes: new Map<string, number>(),
  /** What the file really weighs, where it differs from the catalog. */
  fileBytes: new Map<string, number>(),
};

function mockCatalogRow(chapter: MockChapter) {
  return {
    id: chapter.id,
    book_id: chapter.book_id,
    number: chapter.number,
    title: chapter.title,
    access: chapter.access,
    has_text: chapter.script_text !== null,
    has_audio: chapter.audio_path !== null,
    audio_duration_seconds: chapter.audio_duration_seconds,
    updated_at: chapter.updated_at,
    audio_size_bytes: chapter.audio_path === null ? null : (mockServer.sizes.get(chapter.id) ?? 1000),
    text_bytes: chapter.script_text === null ? null : chapter.script_text.length,
  };
}

function mockRows(table: string): Record<string, unknown>[] {
  switch (table) {
    case "chapters_catalog":
      return mockServer.chapters.map(mockCatalogRow);
    case "chapters":
      return mockServer.chapters;
    case "unlocks":
      return mockServer.unlocks;
    case "books_catalog":
      return [{ id: "book-1", title: "Book One", author: "Author", cover_path: "book-1/cover.webp" }];
    default:
      return [];
  }
}

function mockQuery(table: string) {
  const filters: ((row: Record<string, unknown>) => boolean)[] = [];
  const answer = () =>
    mockServer.failing.has(table)
      ? { data: null, error: new Error(`${table} unavailable`) }
      : { data: mockRows(table).filter((row) => filters.every((filter) => filter(row))), error: null };
  const builder = {
    select: () => builder,
    order: () => builder,
    limit: () => builder,
    eq: (column: string, value: unknown) => {
      filters.push((row) => row[column] === value);
      return builder;
    },
    in: (column: string, values: unknown[]) => {
      filters.push((row) => values.includes(row[column]));
      return builder;
    },
    maybeSingle: () => {
      const { data, error } = answer();
      return Promise.resolve({ data: data?.[0] ?? null, error });
    },
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(answer()).then(resolve, reject),
  };
  return builder;
}

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => mockQuery(table),
    rpc: () => ({ single: () => Promise.resolve({ data: mockServer.settings, error: null }) }),
    storage: {
      from: () => ({
        createSignedUrl: (path: string) => {
          if (mockServer.refused.has(path)) {
            return Promise.resolve({ data: null, error: { message: "Object not found" } });
          }
          const chapter = mockServer.chapters.find((candidate) => candidate.audio_path === path);
          const bytes = chapter
            ? (mockServer.fileBytes.get(chapter.id) ?? mockServer.sizes.get(chapter.id) ?? 1000)
            : 1000;
          return Promise.resolve({ data: { signedUrl: `https://storage.test/${path}?token=t&bytes=${bytes}` }, error: null });
        },
      }),
    },
  },
}));

jest.mock("@/lib/revenuecat", () => ({
  getEntitlement: () =>
    Promise.resolve({ active: false, expiresAt: null, willRenew: false, productId: null, planId: null, managementUrl: null }),
  getCurrentOffering: () => Promise.resolve(null),
  logOutBilling: jest.fn(),
}));

// Sign-out's player step, recorded, so its order against the queue and the files can be checked.
const mockSignOutSteps: { step: string; queueEmpty: boolean; inFlightStopped: boolean; downloadsOnDisk: number }[] = [];
jest.mock("@/lib/audio/player", () => ({
  releaseAudio: jest.fn(() => {
    mockSignOutSteps.push({
      step: "releaseAudio",
      queueEmpty: jest.requireActual("@/lib/downloads/queue").getDownloadQueue().length === 0,
      inFlightStopped: mockFs.tasks[mockFs.tasks.length - 1]?.state === "paused",
      downloadsOnDisk: [...mockDisk.keys()].filter((uri) => uri.includes("/downloads/")).length,
    });
  }),
}));

jest.mock("@/lib/analytics", () => ({ track: jest.fn(), resetAnalytics: jest.fn() }));

// The real client pulls in NetInfo's native module; these need only a cache
// (the persistence rule has its own test, `lib/__tests__/query-client.test.ts`).
jest.mock("@/lib/query-client", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query");
  return {
    queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    QUERY_CACHE_PREFIX: "talebrim.query-cache",
  };
});

// --- Fixtures ----------------------------------------------------------------

const USER = "user_a";
const DOCUMENT = "file:///document";
const DOWNLOADS = `${DOCUMENT}/downloads`;
const DAY = 24 * 60 * 60 * 1000;

function chapter(number: number, overrides: Partial<MockChapter> = {}): MockChapter {
  const id = `c${number}`;
  return {
    id,
    book_id: "book-1",
    number,
    title: `Title ${number}`,
    // 1–3 free by access, as the dashboard creates them; the rest locked.
    access: number <= 3 ? "free" : "locked",
    audio_path: `book-1/${id}/narration.m4a`,
    script_text: `Text of chapter ${number}.`,
    audio_duration_seconds: 60,
    updated_at: "2026-09-28T10:00:00+00:00",
    ...overrides,
  };
}

function files(): string[] {
  return [...mockDisk.keys()].filter((uri) => uri.startsWith(`${DOWNLOADS}/`)).map((uri) => uri.slice(DOWNLOADS.length + 1)).sort();
}

function index(): Record<string, DownloadEntry> {
  return useDownloadsStore.getState().chapters;
}

async function settle() {
  for (let round = 0; round < 20; round += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

/** Chapter 1 alone, left half downloaded (`mockFs.holding`). */
async function startHeldDownload() {
  const plan = await prepareDownloads(USER, "book-1", "c1");
  startDownloads(USER, plan, "row");
  await settle();
}

async function downloadBook(chapterId?: string) {
  const plan = await prepareDownloads(USER, "book-1", chapterId);
  startDownloads(USER, plan, chapterId ? "row" : "download_all");
  await settle();
  return plan;
}

beforeAll(() => {
  jest.replaceProperty(Platform, "OS", "android");
});

// Queries fetched with no observer hold TanStack's 5-minute garbage-collection
// timers, which keep Jest from exiting after the last test.
afterAll(async () => {
  await stopDownloads();
  queryClient.clear();
});

beforeEach(async () => {
  await stopDownloads();
  mockDisk.clear();
  // PostHog's own files at the document root: never touched.
  mockDisk.set(`${DOCUMENT}/.posthog-rn.json`, "{}");
  mockDisk.set(`${DOCUMENT}/.posthog-rn-logs.json`, "[]");
  Object.assign(mockFs, { freeBytes: 10_000_000_000, hold: null, holding: false, tasks: [], downloads: [], failResume: false });
  mockServer.chapters = [1, 2, 3, 4, 5].map((number) => chapter(number));
  mockServer.unlocks = [];
  mockServer.refused = new Set(["book-1/c4/narration.m4a", "book-1/c5/narration.m4a"]);
  mockServer.failing = new Set();
  mockServer.sizes = new Map();
  mockServer.fileBytes = new Map();
  mockSignOutSteps.length = 0;
  useDownloadsStore.getState().clear();
  queryClient.clear();
  onlineManager.setOnline(true);
});

// --- Downloading -------------------------------------------------------------

describe("downloading", () => {
  it("downloads every chapter the reader can open, narration and text, and nothing partial is left", async () => {
    const plan = await downloadBook();

    expect(plan.rows.map((row) => row.id)).toEqual(["c1", "c2", "c3"]);
    expect(files()).toEqual(["c1.m4a", "c1.txt", "c2.m4a", "c2.txt", "c3.m4a", "c3.txt"]);
    const entry = index().c1;
    expect(entry.audio).toEqual({ ext: "m4a", bytes: 1000, path: "book-1/c1/narration.m4a" });
    expect(entry.text).toEqual({ bytes: "Text of chapter 1.".length, length: "Text of chapter 1.".length });
    expect(entry.book).toEqual({
      id: "book-1",
      title: "Book One",
      author: "Author",
      coverUrl: "https://cdn.test/storage/v1/object/public/covers/book-1/cover.webp",
    });
    // Never a signed URL in the index.
    expect(JSON.stringify(index())).not.toContain("https://storage.test");
    expect(useDownloadsStore.getState().userId).toBe(USER);
  });

  it("downloads one chapter at a time", async () => {
    mockFs.holding = true;
    const plan = await prepareDownloads(USER, "book-1");
    startDownloads(USER, plan, "download_all");
    await settle();
    expect(mockFs.downloads).toHaveLength(1);
    expect(getDownloadQueue().map((item) => item.status)).toEqual(["downloading", "queued", "queued"]);
    expect(getDownloadQueue()[0].progress).toBeCloseTo(0.5, 1);
  });

  it("never downloads a Locked chapter", async () => {
    const plan = await prepareDownloads(USER, "book-1", "c4");
    expect(plan.rows).toEqual([]);
  });

  it("fails a refused chapter with its reason, never retries it, and deletes nothing downloaded", async () => {
    // Unlocked by the app's lock rule, refused by the storage policy (a subscriber, until the mirror).
    mockServer.unlocks = [{ id: "u1", chapter_id: "c4", source: "ad", created_at: "" }];
    await downloadBook("c1");
    await downloadBook("c4");
    const item = getDownloadQueue().find((candidate) => candidate.chapterId === "c4");
    expect(item).toMatchObject({ status: "failed", failure: "refused" });
    expect(mockFs.downloads.filter((url) => url.includes("c4"))).toHaveLength(0);
    expect(index().c1).toBeDefined();
    expect(files()).toEqual(["c1.m4a", "c1.txt"]);
  });

  it("fails a chapter that doesn't fit with a full disk, leaves no partial file, and stops the queue", async () => {
    mockFs.freeBytes = 60_000_000; // Room for the margin, not for a 20 MB chapter.
    mockServer.sizes = new Map([
      ["c1", 20_000_000],
      ["c2", 1000],
    ]);
    await downloadBook();
    const statuses = Object.fromEntries(getDownloadQueue().map((item) => [item.chapterId, item]));
    expect(statuses.c1).toMatchObject({ status: "failed", failure: "disk_full" });
    // The rest were cancelled, not downloaded: the queue stopped.
    expect(statuses.c2).toBeUndefined();
    expect(files()).toEqual([]);
    expect(index()).toEqual({});
  });

  it("leaves no partial file when the disk fills during the write", async () => {
    mockFs.freeBytes = DISK_ROOM;
    // The catalog says 1 KB, so the size check passes; the real file is 60 MB, and the write runs out.
    mockServer.fileBytes = new Map([["c1", 60_000_000]]);
    await downloadBook("c1");
    expect(files()).toEqual([]);
    expect(getDownloadQueue()[0]).toMatchObject({ status: "failed", failure: "disk_full" });
  });

  it("pauses offline, keeps the bytes so far, and carries on from them on reconnect", async () => {
    mockFs.holding = true;
    await startHeldDownload();
    expect(files()).toEqual(["c1.m4a.part"]);

    onlineManager.setOnline(false);
    await settle();
    // Paused, not deleted: the half on disk stays, and so does the percentage.
    expect(files()).toEqual(["c1.m4a.part"]);
    expect(getDownloadQueue()[0].status).toBe("queued");
    expect(getDownloadQueue()[0].progress).toBeCloseTo(0.5, 1);

    mockFs.holding = false;
    onlineManager.setOnline(true);
    await settle();
    // The second request starts at byte 500, not 0.
    expect(mockFs.tasks.map((task) => task.from)).toEqual([0, 500]);
    expect(files()).toEqual(["c1.m4a", "c1.txt"]);
    expect(mockDisk.get(`${DOWNLOADS}/c1.m4a`)).toHaveLength(1000);
    expect(index().c1.audio?.bytes).toBe(1000);
  });

  it("pauses when the app leaves the foreground, and carries on from the same byte when it comes back", async () => {
    // React Native's jest setup mocks AppState. Swapped by hand and put back,
    // not spied on: restoring a spy on that mock strips its implementation for
    // every test after this one.
    const listeners: ((state: AppStateStatus) => void)[] = [];
    const addEventListener = AppState.addEventListener;
    AppState.addEventListener = ((_type: string, listener: (state: AppStateStatus) => void) => {
      listeners.push(listener);
      return { remove: () => undefined } as NativeEventSubscription;
    }) as typeof AppState.addEventListener;
    const currentState = Object.getOwnPropertyDescriptor(AppState, "currentState");
    const appState = (state: AppStateStatus) => {
      Object.defineProperty(AppState, "currentState", { value: state, configurable: true, writable: true });
      for (const listener of listeners) listener(state);
    };
    try {
      mockFs.holding = true;
      await startHeldDownload();

      appState("background");
      await settle();
      expect(files()).toEqual(["c1.m4a.part"]);
      expect(getDownloadQueue()[0].status).toBe("queued");
      expect(getDownloadQueue()[0].progress).toBeCloseTo(0.5, 1);
      // Nothing runs in the background.
      expect(mockFs.tasks).toHaveLength(1);

      mockFs.holding = false;
      appState("active");
      await settle();
      expect(mockFs.tasks.map((task) => task.from)).toEqual([0, 500]);
      expect(files()).toEqual(["c1.m4a", "c1.txt"]);
      expect(getDownloadQueue()).toEqual([]);
      expect(index().c1).toBeDefined();
    } finally {
      appState("active");
      AppState.addEventListener = addEventListener;
      if (currentState) Object.defineProperty(AppState, "currentState", currentState);
    }
  });

  it("deletes a paused chapter's bytes when it is cancelled", async () => {
    mockFs.holding = true;
    await startHeldDownload();
    onlineManager.setOnline(false);
    await settle();
    expect(files()).toEqual(["c1.m4a.part"]);

    cancelBookDownloads("book-1");
    await settle();
    expect(files()).toEqual([]);
    expect(getDownloadQueue()).toEqual([]);
  });

  it("starts over from the first byte when the server refuses to carry on", async () => {
    mockFs.holding = true;
    await startHeldDownload();
    onlineManager.setOnline(false);
    await settle();

    mockFs.holding = false;
    mockFs.failResume = true;
    onlineManager.setOnline(true);
    await settle();
    expect(mockFs.tasks.map((task) => task.from)).toEqual([0, 500, 0]);
    expect(files()).toEqual(["c1.m4a", "c1.txt"]);
    expect(mockDisk.get(`${DOWNLOADS}/c1.m4a`)).toHaveLength(1000);
  });

  it("cancels a book's downloads, keeping the chapters already done", async () => {
    await downloadBook("c1");
    mockFs.holding = true;
    await downloadBook();
    cancelBookDownloads("book-1");
    await settle();
    expect(getDownloadQueue()).toEqual([]);
    expect(files()).toEqual(["c1.m4a", "c1.txt"]);
    expect(Object.keys(index())).toEqual(["c1"]);
  });
});

/** Just past the 50 MB margin: a small chapter fits, a large write runs out. */
const DISK_ROOM = 50_000_000 + 100_000;

// --- The online access check ---------------------------------------------

describe("the access check", () => {
  beforeEach(async () => {
    mockServer.unlocks = [{ id: "u1", chapter_id: "c4", source: "ad", created_at: "" }];
    mockServer.refused = new Set();
    await downloadBook();
    expect(Object.keys(index()).sort()).toEqual(["c1", "c2", "c3", "c4"]);
    // Checked long ago.
    for (const id of ["c1", "c2", "c3", "c4"]) {
      useDownloadsStore.getState().put(USER, { ...index()[id], verifiedAt: Date.now() - 10 * DAY });
    }
  });

  it("moves verifiedAt on for a chapter still open", async () => {
    await verifyDownloads(USER);
    expect(index().c1.verifiedAt).toBeGreaterThan(Date.now() - DAY);
  });

  it("deletes a chapter the reader has lost", async () => {
    mockServer.unlocks = [];
    await verifyDownloads(USER);
    expect(index().c4).toBeUndefined();
    expect(files()).not.toContain("c4.m4a");
    expect(files()).not.toContain("c4.txt");
    expect(index().c1).toBeDefined();
  });

  it("deletes a chapter gone from the catalog", async () => {
    mockServer.chapters = mockServer.chapters.filter((candidate) => candidate.id !== "c2");
    await verifyDownloads(USER);
    expect(index().c2).toBeUndefined();
    expect(files()).not.toContain("c2.txt");
  });

  it("changes nothing when an input fails", async () => {
    mockServer.unlocks = [];
    mockServer.failing = new Set(["unlocks"]);
    const before = index();
    await verifyDownloads(USER);
    expect(index()).toEqual(before);
    expect(files()).toHaveLength(8);
  });

  it("fetches an edited chapter's text again, and keeps its narration when the path didn't change", async () => {
    mockServer.chapters = mockServer.chapters.map((candidate) =>
      candidate.id === "c1"
        ? { ...candidate, script_text: "Edited text.", updated_at: "2026-09-28T11:00:00+00:00" }
        : candidate,
    );
    const downloadsBefore = mockFs.downloads.length;
    await verifyDownloads(USER);
    await settle();
    expect(mockDisk.get(`${DOWNLOADS}/c1.txt`)).toBe("Edited text.");
    expect(index().c1.updatedAt).toBe("2026-09-28T11:00:00+00:00");
    expect(index().c1.text?.length).toBe("Edited text.".length);
    expect(mockFs.downloads.length).toBe(downloadsBefore);
  });

  it("downloads an edited chapter's narration again when its path changed", async () => {
    mockServer.chapters = mockServer.chapters.map((candidate) =>
      candidate.id === "c1"
        ? { ...candidate, audio_path: "book-1/c1/replaced.mp3", updated_at: "2026-09-28T11:00:00+00:00" }
        : candidate,
    );
    await verifyDownloads(USER);
    await settle();
    expect(index().c1.audio).toMatchObject({ ext: "mp3", path: "book-1/c1/replaced.mp3" });
    expect(files()).toContain("c1.mp3");
    expect(files()).not.toContain("c1.m4a");
  });
});

// --- Start and sign-out ----------------------------------------------------

describe("reconciling on start", () => {
  it("prunes an entry whose file is missing and deletes files no entry lists", async () => {
    await downloadBook();
    mockDisk.delete(`${DOWNLOADS}/c2.txt`);
    mockDisk.set(`${DOWNLOADS}/c9.m4a`, "stray");
    mockDisk.set(`${DOWNLOADS}/c3.m4a.part`, "half");
    reconcileDownloads(USER);
    expect(Object.keys(index()).sort()).toEqual(["c1", "c3"]);
    expect(files()).toEqual(["c1.m4a", "c1.txt", "c3.m4a", "c3.txt"]);
  });

  it("deletes another account's downloads, and nothing outside downloads/", async () => {
    await downloadBook();
    reconcileDownloads("user_b");
    expect(index()).toEqual({});
    expect(useDownloadsStore.getState().userId).toBeNull();
    expect(files()).toEqual([]);
    expect(mockDisk.has(`${DOCUMENT}/.posthog-rn.json`)).toBe(true);
    expect(mockDisk.has(`${DOCUMENT}/.posthog-rn-logs.json`)).toBe(true);
  });
});

describe("sign-out", () => {
  it("stops the queue and aborts the chapter in flight, then releases the player, then deletes downloads/", async () => {
    await downloadBook("c1");
    mockFs.holding = true;
    await downloadBook();
    expect(getDownloadQueue().some((item) => item.status === "downloading")).toBe(true);

    await clearUserScopedState();

    expect(releaseAudio).toHaveBeenCalledTimes(1);
    expect(mockSignOutSteps).toEqual([
      // The queue had stopped and the download was aborted; the files were still there.
      { step: "releaseAudio", queueEmpty: true, inFlightStopped: true, downloadsOnDisk: expect.any(Number) },
    ]);
    expect(mockSignOutSteps[0].downloadsOnDisk).toBeGreaterThan(0);
    expect(files()).toEqual([]);
    expect(index()).toEqual({});
    // Nothing outside downloads/ is touched.
    expect(mockDisk.has(`${DOCUMENT}/.posthog-rn.json`)).toBe(true);
    expect(mockDisk.has(`${DOCUMENT}/.posthog-rn-logs.json`)).toBe(true);
  });

  it("removes every download, and only downloads, on Remove all", async () => {
    await downloadBook();
    removeAllDownloads();
    expect(files()).toEqual([]);
    expect(index()).toEqual({});
    expect([...mockDisk.keys()].sort()).toEqual([`${DOCUMENT}/.posthog-rn-logs.json`, `${DOCUMENT}/.posthog-rn.json`]);
  });
});
