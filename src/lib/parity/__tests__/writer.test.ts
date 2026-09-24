/// <reference types="jest" />

import { onlineManager } from "@tanstack/react-query";

import {
  DEBOUNCE_MS,
  MAX_WAIT_MS,
  clearParityQueue,
  flush,
  recordPosition,
  setParityUser,
} from "@/lib/parity/writer";
import { useParityStore } from "@/store/parity-store";

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

// The real client pulls in NetInfo's native module; the writer needs only a cache.
jest.mock("@/lib/query-client", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query");
  return { queryClient: new QueryClient() };
});

const USER_A = "user_a";
const USER_B = "user_b";
const SERVER_TIME = "2026-09-24T10:00:00.000001+00:00";

function succeed() {
  mockUpsert.mockImplementation(async (_table: string, row: Record<string, unknown>) => ({
    data: { id: "row", audio_ms: null, text_offset: null, ...row, updated_at: SERVER_TIME },
    error: null,
  }));
}

function position(chapterId = "chapter-1") {
  return useParityStore.getState().getPosition(chapterId);
}

function text(value: number, chapterId = "chapter-1") {
  recordPosition({ chapterId, bookId: "book-1", mode: "text", value });
}

beforeEach(() => {
  jest.useFakeTimers();
  // The writer's development log of failed writes.
  jest.spyOn(console, "log").mockImplementation(() => {});
  mockUpsert.mockReset();
  succeed();
  clearParityQueue();
  useParityStore.getState().clear();
  onlineManager.setOnline(true);
  setParityUser(USER_A);
});

afterEach(() => {
  jest.useRealTimers();
});

it("writes the session slice first, dirty, before any request", () => {
  text(120);
  expect(position()).toMatchObject({ textOffset: 120, audioMs: null, lastWrittenBy: "text", dirty: true });
  expect(mockUpsert).not.toHaveBeenCalled();
});

it("sends ten rapid positions for one chapter as one write, of the last", async () => {
  for (let offset = 0; offset < 10; offset += 1) text(offset * 100);
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(mockUpsert).toHaveBeenCalledTimes(1);
  expect(mockUpsert.mock.calls[0][1]).toMatchObject({ text_offset: 900 });
});

it("sends only its own side, and never user_id or updated_at", async () => {
  text(42);
  await flush();

  const [table, row, options] = mockUpsert.mock.calls[0];
  expect(table).toBe("reading_positions");
  expect(row).toEqual({ chapter_id: "chapter-1", book_id: "book-1", last_mode: "text", text_offset: 42 });
  expect(options).toEqual({ onConflict: "user_id,chapter_id" });
});

it("sends on flush at once, as an unmount does, without waiting for the debounce", async () => {
  text(10);
  await flush();
  expect(mockUpsert).toHaveBeenCalledTimes(1);
  expect(position()).toMatchObject({ dirty: false, syncedAt: SERVER_TIME });
});

it("still sends a position recorded after the flush, on its own debounce", async () => {
  text(10);
  await flush();
  // The reader's settle timer firing after unmount.
  text(20);
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);

  expect(mockUpsert).toHaveBeenCalledTimes(2);
  expect(mockUpsert.mock.calls[1][1]).toMatchObject({ text_offset: 20 });
});

it("writes at least every MAX_WAIT_MS while positions keep coming", async () => {
  // A record every second never leaves the debounce quiet.
  for (let second = 0; second < MAX_WAIT_MS / 1000; second += 1) {
    text(second);
    await jest.advanceTimersByTimeAsync(1000);
  }
  expect(mockUpsert).toHaveBeenCalledTimes(1);
});

it("keeps a failed write dirty and retries it", async () => {
  mockUpsert.mockResolvedValueOnce({ data: null, error: { message: "Network request failed", code: "" } });
  text(10);
  await flush();

  expect(position()).toMatchObject({ textOffset: 10, dirty: true, syncedAt: null });

  await jest.advanceTimersByTimeAsync(2_000);
  expect(mockUpsert).toHaveBeenCalledTimes(2);
  expect(position()).toMatchObject({ dirty: false, syncedAt: SERVER_TIME });
});

it("stops after three attempts per trigger, and tries again on the next", async () => {
  mockUpsert.mockResolvedValue({ data: null, error: { message: "Network request failed", code: "" } });
  text(10);
  await flush();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(mockUpsert).toHaveBeenCalledTimes(3);

  succeed();
  await flush();
  expect(mockUpsert).toHaveBeenCalledTimes(4);
  expect(position()).toMatchObject({ dirty: false });
});

it("drops a write the server rejects outright, instead of retrying it", async () => {
  mockUpsert.mockResolvedValueOnce({ data: null, error: { message: "violates foreign key", code: "23503" } });
  text(10);
  await flush();
  await jest.advanceTimersByTimeAsync(60_000);

  expect(mockUpsert).toHaveBeenCalledTimes(1);
  expect(position()).toMatchObject({ dirty: false });
});

it("drops a write recorded under another account", async () => {
  text(10);
  setParityUser(USER_B);
  await flush();
  expect(mockUpsert).not.toHaveBeenCalled();

  // Gone, not waiting: switching back does not resurrect it.
  setParityUser(USER_A);
  await flush();
  expect(mockUpsert).not.toHaveBeenCalled();
});

it("waits while offline and sends on reconnect", async () => {
  onlineManager.setOnline(false);
  text(10);
  await flush();
  expect(mockUpsert).not.toHaveBeenCalled();
  expect(position()).toMatchObject({ dirty: true });

  onlineManager.setOnline(true);
  await jest.advanceTimersByTimeAsync(0);
  expect(mockUpsert).toHaveBeenCalledTimes(1);
});

it("keeps a newer position dirty when an older one is confirmed", async () => {
  let release: () => void = () => {};
  mockUpsert.mockImplementationOnce(
    (_table: string, row: Record<string, unknown>) =>
      new Promise((resolve) => {
        release = () => resolve({ data: { id: "row", ...row, updated_at: SERVER_TIME }, error: null });
      }),
  );
  text(10);
  const first = flush();
  text(20);
  release();
  await first;

  expect(position()).toMatchObject({ textOffset: 20, dirty: true });
  await flush();
  expect(mockUpsert.mock.calls[1][1]).toMatchObject({ text_offset: 20 });
  expect(position()).toMatchObject({ dirty: false });
});

it("writes each chapter to its own row, however they interleave", async () => {
  text(10, "chapter-1");
  recordPosition({ chapterId: "chapter-2", bookId: "book-1", mode: "audio", value: 5_000 });
  await flush();

  const rows = mockUpsert.mock.calls.map(([, row]) => row);
  expect(rows).toEqual(
    expect.arrayContaining([
      { chapter_id: "chapter-1", book_id: "book-1", last_mode: "text", text_offset: 10 },
      { chapter_id: "chapter-2", book_id: "book-1", last_mode: "audio", audio_ms: 5_000 },
    ]),
  );
  expect(rows).toHaveLength(2);
});
