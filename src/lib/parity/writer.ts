// The one writer of `reading_positions` — AGENTS.md § Read/listen parity.
// No React, no hooks, no JSX (AGENTS.md § lib/). The queue and its timers are
// module state, so a screen unmounting can never cancel a write.
//
// `recordPosition()` writes the session slice first (parity step 1), then
// queues one write per chapter, replacing any older one. The queue goes
// DEBOUNCE_MS after the last record, and at least every MAX_WAIT_MS while
// records keep coming: that is the reading or playing interval (step 2).
// `flush()` sends it now; the reader's unmount, app backgrounding and
// sign-out call it (step 5: flushed, never dropped).
//
// Each write upserts on (user_id, chapter_id) and sends only `chapter_id`,
// `book_id`, `last_mode` and the side that mode owns, so a reading write
// never clobbers a listening position. The server sets `user_id` (the column
// default) and `updated_at` (dashboard migration 20260924190305); the client
// sends neither.
import { onlineManager } from "@tanstack/react-query";

import { reconcile, fromServerRow } from "@/lib/parity/reconcile";
import { READING_POSITION_COLUMNS, type ReadingPosition } from "@/lib/queries/reading-position";
import { queryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import { useParityStore, type ParitySourceMode } from "@/store/parity-store";
import type { TablesInsert } from "@/types/database";

/** Quiet time after the last recorded position before it is sent. */
export const DEBOUNCE_MS = 2_000;
/** The longest a recorded position waits while records keep coming. */
export const MAX_WAIT_MS = 10_000;
/**
 * Attempts per trigger, the first included. After the last, the write stays
 * queued for the next trigger or a reconnect. The queue itself is bounded at
 * one write per chapter.
 */
export const MAX_ATTEMPTS = 3;
/** Wait before the second and third attempts. */
const RETRY_DELAYS_MS = [2_000, 8_000];

export type PositionInput = {
  /** The chapter that produced this position — never "the current chapter". */
  chapterId: string;
  bookId: string;
  mode: ParitySourceMode;
  /** A character offset for `text`; milliseconds for `audio`. */
  value: number;
};

type PendingWrite = PositionInput & {
  /** The account it was recorded under. A write never outlives its account. */
  userId: string;
};

const pending = new Map<string, PendingWrite>();
const inFlight = new Map<string, Promise<void>>();
let currentUserId: string | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;

function log(...args: unknown[]) {
  if (__DEV__) console.log("[parity]", ...args);
}

// Queued writes wait out an offline spell (`send()` skips while offline) and
// go the moment the connection returns.
onlineManager.subscribe((online) => {
  if (online) void flush();
});

/**
 * Whose writes may go out. Set by `AuthedQueryProvider` during render, next to
 * the Supabase token getter, so it changes with the token that authorises
 * the request.
 */
export function setParityUser(userId: string | null): void {
  currentUserId = userId;
}

/** Records a position: into the session slice now, and to the server shortly. */
export function recordPosition(input: PositionInput): void {
  const { chapterId, mode, value } = input;
  const { getPosition, setPosition } = useParityStore.getState();
  const existing = getPosition(chapterId);
  const existingValue = mode === "text" ? existing?.textOffset : existing?.audioMs;
  if (existing?.lastWrittenBy === mode && existingValue === value) return;

  setPosition({
    chapterId,
    textOffset: mode === "text" ? value : (existing?.textOffset ?? null),
    audioMs: mode === "audio" ? value : (existing?.audioMs ?? null),
    lastWrittenBy: mode,
    syncedAt: existing?.syncedAt ?? null,
    dirty: true,
  });

  if (currentUserId === null) return;
  pending.set(chapterId, { ...input, userId: currentUserId });
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void flush(), DEBOUNCE_MS);
  maxWaitTimer ??= setTimeout(() => void flush(), MAX_WAIT_MS);
}

/**
 * Brings a server row into the session slice when last-write-wins says it is
 * the newer copy (`lib/parity/reconcile.ts`). When a dirty session copy wins
 * instead, it is sent now.
 */
export function adoptServerPosition(chapterId: string, row: ReadingPosition | null): void {
  const { getPosition, setPosition } = useParityStore.getState();
  const session = getPosition(chapterId);
  if (row !== null && reconcile(session, row) === "adopt") setPosition(fromServerRow(row));
  else if (session?.dirty) void flush();
}

/** Sends every queued write now. Resolves once each has had one attempt; retries carry on after. */
export function flush(): Promise<void> {
  clearTimers();
  return Promise.all([...pending.keys()].map((chapterId) => send(chapterId, 0))).then(() => undefined);
}

/** `flush()`, but never waiting longer than `ms`: sign-out must not hang on the network. */
export function flushWithin(ms: number): Promise<void> {
  return Promise.race([flush(), new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

/** Drops every queued write. Sign-out calls it, through `clearUserScopedState()`. */
export function clearParityQueue(): void {
  clearTimers();
  pending.clear();
}

function clearTimers() {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  if (maxWaitTimer !== null) clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;
}

function send(chapterId: string, attempt: number): Promise<void> {
  // One request per chapter at a time. A newer position waits for it, then goes.
  const running = inFlight.get(chapterId);
  if (running) return running.then(() => send(chapterId, attempt));

  const write = pending.get(chapterId);
  if (!write) return Promise.resolve();
  // Recorded under another account: `user_id` defaults to whoever's token is
  // on the request, so sending it would file it in the wrong account.
  if (write.userId !== currentUserId) {
    pending.delete(chapterId);
    return Promise.resolve();
  }
  if (!onlineManager.isOnline()) return Promise.resolve();

  const request = upsert(write)
    .then((row) => settle(write, row))
    .catch((error: unknown) => fail(write, attempt, error))
    .finally(() => inFlight.delete(chapterId));
  inFlight.set(chapterId, request);
  return request;
}

async function upsert(write: PendingWrite): Promise<ReadingPosition> {
  const base = { chapter_id: write.chapterId, book_id: write.bookId, last_mode: write.mode };
  // Only this mode's side: the upsert leaves the other one as it was.
  const row: TablesInsert<"reading_positions"> =
    write.mode === "text" ? { ...base, text_offset: write.value } : { ...base, audio_ms: write.value };

  const { data, error } = await supabase
    .from("reading_positions")
    .upsert(row, { onConflict: "user_id,chapter_id" })
    .select(READING_POSITION_COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

function settle(write: PendingWrite, row: ReadingPosition) {
  // Replaced while this was in flight: the newer write stays queued.
  if (pending.get(write.chapterId) === write) pending.delete(write.chapterId);
  // Signed out or switched account mid-request: leave no trace of it.
  if (write.userId !== currentUserId) return;

  const { getPosition, setPosition } = useParityStore.getState();
  const session = getPosition(write.chapterId);
  if (session) {
    const sessionValue = write.mode === "text" ? session.textOffset : session.audioMs;
    const confirmed = session.lastWrittenBy === write.mode && sessionValue === write.value;
    setPosition({ ...session, syncedAt: row.updated_at, dirty: session.dirty && !confirmed });
  }

  // The returned row is the server's truth, so it goes straight into the
  // cache: no refetch, and no catalog key is touched.
  queryClient.setQueryData(queryKeys.readingPosition.byChapter(write.userId, write.chapterId), row);
  queryClient.setQueryData(queryKeys.readingPosition.resumeByBook(write.userId, write.bookId), row);
  // Library's newest positions carry each chapter too, which this row lacks,
  // so they are only marked stale: a flush never fetches. M7 refetches them
  // when it next gains focus.
  void queryClient.invalidateQueries({
    queryKey: queryKeys.readingPosition.recent(write.userId),
    refetchType: "none",
  });
}

/** A rejection that resending the same row cannot fix: bad data (22) or a broken constraint (23), such as a deleted chapter. */
function isPermanent(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const { code } = error;
  return typeof code === "string" && /^2[23]/.test(code);
}

function fail(write: PendingWrite, attempt: number, error: unknown) {
  log("write failed", write.chapterId, error);
  // Replaced while this was in flight: the newer write goes on its own timer.
  if (pending.get(write.chapterId) !== write) return;

  if (isPermanent(error)) {
    pending.delete(write.chapterId);
    const session = useParityStore.getState().getPosition(write.chapterId);
    // Nothing will ever confirm it, so a newer server row may replace it.
    if (session) useParityStore.getState().setPosition({ ...session, dirty: false });
    return;
  }

  // Still dirty and still queued. Never a toast or an alert: a background
  // save failing does not interrupt reading.
  const delay = RETRY_DELAYS_MS[attempt];
  if (attempt + 1 < MAX_ATTEMPTS && delay !== undefined) {
    setTimeout(() => void send(write.chapterId, attempt + 1), delay);
  }
}
