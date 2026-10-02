// Offline downloads' one queue — prompt 24. No React, no hooks, no JSX
// (AGENTS.md § lib/).
//
// One chapter at a time, never in parallel, in the foreground only: no
// background-download library. Its state is module state, like the player's
// and the parity writer's, so leaving a screen never cancels a download.
// Screens read it through `subscribeDownloadQueue()` and
// `getDownloadQueue()` (`hooks/use-downloads.ts`).
//
// Leaving the app, or losing the connection, pauses the chapter in flight and
// puts it back at the head of the queue, keeping the narration's bytes so far;
// returning, or reconnecting, carries on from them (a Range request,
// `File.createDownloadTask()`). Chapters already done stay done. Changed
// 2026-09-30: it used to start that chapter over, which on a 29 MB chapter
// looked like the download had failed.
//
// A chapter is written as partial files, renamed into place only once every
// part it has is on disk, and only then entered in the index: a partial file
// never looks complete. A failure or a cancel leaves none behind; only a
// pause keeps one, in the job, for the same recording, this session.
import { onlineManager } from "@tanstack/react-query";
import { AppState } from "react-native";

import { track } from "@/lib/analytics";
import {
  availableBytes,
  commitFile,
  deleteFile,
  deletePartial,
  downloadsAvailable,
  downloadToPartial,
  partialFile,
  writeTextToPartial,
} from "@/lib/downloads/files";
import { downloadFor } from "@/lib/downloads/local";
import {
  audioExtension,
  audioFileName,
  chapterDownloadSize,
  hasRoomFor,
  refreshParts,
  textFileName,
} from "@/lib/downloads/rules";
import { chapterAudioSourceOptions, type ChapterAudioSource } from "@/lib/queries/audio";
import { entitlementOptions } from "@/lib/queries/billing";
import { chapterTextOptions } from "@/lib/queries/chapters";
import type { DownloadRow } from "@/lib/queries/downloads";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryClient } from "@/lib/query-client";
import { syncServerPlan } from "@/lib/server-plan";
import { useDownloadsStore, type DownloadedBook, type DownloadEntry } from "@/store/downloads-store";
import { chapterStateFor, openedByPlan, textWithheld } from "@/types/states";

export type DownloadStatus = "queued" | "downloading" | "done" | "failed" | "cancelled";

/** Why a chapter failed, in fixed words: analytics' `kind` too. */
export type DownloadFailure = "disk_full" | "refused" | "network" | "other";

export type QueueItem = {
  chapterId: string;
  bookId: string;
  /**
   * "download" is the reader's own. "refresh" fetches an edited chapter's
   * changed parts again (prompt 24 step 8): it runs through the same queue,
   * one at a time, and no screen shows it.
   */
  kind: "download" | "refresh";
  status: DownloadStatus;
  /** From 0 to 1 while downloading: a real fraction of the bytes. */
  progress: number;
  /** Set when failed. */
  failure: DownloadFailure | null;
  /** Its book, as the index will keep it: the Downloads screen lists what is in progress. */
  book: DownloadedBook;
};

/** The narration's partial file a paused try kept, and the recording it is of. */
type KeptPartial = { name: string; path: string; complete: boolean };

type Job = QueueItem & { row: DownloadRow; partial: KeptPartial | null };

/** How long the lock inputs a chapter is checked against may be cached before it downloads. */
const LOCK_INPUTS_FRESH_MS = 60_000;
/** How long sign-out waits for the chapter in flight to stop before its files go. */
const STOP_WAIT_MS = 2_000;

class DownloadError extends Error {
  constructor(readonly kind: DownloadFailure) {
    super(kind);
  }
}

let jobs: Job[] = [];
/** The account the queue downloads for. Null after sign-out. */
let account: string | null = null;
/** The chapter in flight, and why it was aborted if it was. */
let inFlight: { job: Job; controller: AbortController; done: Promise<void> } | null = null;
let abortReason: "paused" | "cancelled" | null = null;
let snapshot: readonly QueueItem[] = [];
const listeners = new Set<() => void>();
let unwatch: (() => void) | null = null;

function log(...args: unknown[]) {
  if (__DEV__) console.log("[downloads]", ...args);
}

// --- Snapshot -----------------------------------------------------------

/** For `useSyncExternalStore`: called whenever the queue changes. */
export function subscribeDownloadQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getDownloadQueue(): readonly QueueItem[] {
  return snapshot;
}

/** True while a chapter is downloading or waiting to. */
export function isQueueBusy(): boolean {
  return jobs.some((job) => job.status === "queued" || job.status === "downloading");
}

function emit() {
  snapshot = jobs.map(({ row: _row, partial: _partial, ...item }) => item);
  for (const listener of listeners) listener();
}

function update(job: Job, next: Partial<QueueItem>) {
  Object.assign(job, next);
  emit();
}

const isActive = (job: Job) => job.status === "queued" || job.status === "downloading";

// --- When it runs -------------------------------------------------------

function inForeground(): boolean {
  // iOS's brief `inactive` counts as foreground, as `useIsForeground()` has it.
  return AppState.currentState !== "background";
}

function canRun(): boolean {
  return account !== null && onlineManager.isOnline() && inForeground();
}

/** Leaving the app or the network pauses the chapter in flight; coming back runs the queue on. */
function onConditionsChanged() {
  if (!canRun()) {
    if (inFlight !== null) {
      log("pausing", inFlight.job.chapterId, { online: onlineManager.isOnline(), foreground: inForeground() });
      abortReason = "paused";
      inFlight.controller.abort();
    }
    return;
  }
  void pump();
}

function watch() {
  if (unwatch !== null) return;
  const offOnline = onlineManager.subscribe(onConditionsChanged);
  const appState = AppState.addEventListener("change", onConditionsChanged);
  unwatch = () => {
    offOnline();
    appState.remove();
  };
}

// --- Queueing -----------------------------------------------------------

/**
 * Queues chapters to download for `userId`, in the order given. A chapter
 * already waiting or downloading is left where it is; one that failed or was
 * cancelled before starts again. Only chapters the caller checked the reader
 * can open (`prepareDownloads()`); each is checked again before it starts.
 */
export function enqueueDownloads(userId: string, rows: readonly DownloadRow[], book: DownloadedBook): void {
  enqueue(userId, rows, book, "download");
}

/** Queues an edited chapter's changed parts to fetch again (the access check). */
export function enqueueRefresh(userId: string, row: DownloadRow, book: DownloadedBook): void {
  enqueue(userId, [row], book, "refresh");
}

function enqueue(userId: string, rows: readonly DownloadRow[], book: DownloadedBook, kind: Job["kind"]) {
  if (!downloadsAvailable()) return;
  if (account !== null && account !== userId) return;
  account = userId;
  for (const row of rows) {
    if (row.id === null) continue;
    const chapterId = row.id;
    if (jobs.some((job) => job.chapterId === chapterId && isActive(job))) continue;
    jobs = jobs.filter((job) => job.chapterId !== chapterId);
    jobs.push({ chapterId, bookId: book.id, kind, status: "queued", progress: 0, failure: null, row, book, partial: null });
  }
  watch();
  emit();
  void pump();
}

/** Cancels one book's waiting chapters and the one in flight if it is this book's. Done chapters stay done. */
export function cancelBookDownloads(bookId: string): void {
  cancelWhere((job) => job.bookId === bookId && job.kind === "download");
}

/** Cancels one chapter's download, waiting or in flight. */
export function cancelChapterDownload(chapterId: string): void {
  cancelWhere((job) => job.chapterId === chapterId);
}

function cancelWhere(matches: (job: Job) => boolean) {
  for (const job of jobs) {
    if (matches(job) && job.status === "queued") {
      job.status = "cancelled";
      dropPartial(job);
    }
  }
  if (inFlight !== null && matches(inFlight.job)) {
    abortReason = "cancelled";
    inFlight.controller.abort();
  }
  settle();
  emit();
}

/**
 * Sign-out, first: stops the queue and aborts the chapter in flight, before
 * the player is released and the files go (`clearUserScopedState()`).
 * Resolves once the chapter in flight has stopped, or after `STOP_WAIT_MS`.
 */
export function stopDownloads(): Promise<void> {
  account = null;
  jobs = [];
  unwatch?.();
  unwatch = null;
  const current = inFlight;
  if (current !== null) {
    abortReason = "cancelled";
    current.controller.abort();
  }
  emit();
  if (current === null) return Promise.resolve();
  return Promise.race([current.done, new Promise<void>((resolve) => setTimeout(resolve, STOP_WAIT_MS))]);
}

/**
 * Drops what no screen needs once a book has nothing left to do: its done
 * chapters (the index shows them now) and cancelled ones. A failed download
 * stays, with its reason, until the reader tries again; a failed refresh
 * leaves the old copy as it was, so it goes.
 */
function settle() {
  const busyBooks = new Set(jobs.filter(isActive).map((job) => job.bookId));
  jobs = jobs.filter(
    (job) =>
      busyBooks.has(job.bookId) ||
      (job.status === "failed" && job.kind === "download") ||
      isActive(job),
  );
  if (!isQueueBusy() && jobs.length === 0) {
    unwatch?.();
    unwatch = null;
  }
}

// --- Running ------------------------------------------------------------

async function pump(): Promise<void> {
  if (inFlight !== null || !canRun()) return;
  const job = jobs.find((candidate) => candidate.status === "queued");
  if (job === undefined || account === null) {
    settle();
    emit();
    return;
  }

  const userId = account;
  const controller = new AbortController();
  abortReason = null;
  // A chapter carrying on from its kept bytes keeps its percentage.
  update(job, { status: "downloading", progress: job.partial !== null ? job.progress : 0, failure: null });

  let finish: () => void = () => undefined;
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  inFlight = { job, controller, done };
  log("chapter started", job.chapterId, job.kind);

  try {
    await runJob(userId, job, controller.signal);
    job.status = "done";
    job.progress = 1;
    log("chapter done", job.chapterId);
  } catch (error) {
    if (controller.signal.aborted && abortReason === "paused") {
      // Paused by leaving the app or the network: back to the head of the
      // queue, keeping the narration's bytes so far, to carry on from them.
      job.status = "queued";
      if (job.partial === null) job.progress = 0;
      log("chapter paused", job.chapterId, { keptBytes: job.partial !== null, progress: job.progress });
    } else if (controller.signal.aborted) {
      // Cancelled: gone, with its bytes.
      dropPartial(job);
      job.status = "cancelled";
      job.progress = 0;
      log("chapter cancelled", job.chapterId);
    } else {
      dropPartial(job);
      const failure = error instanceof DownloadError ? error.kind : classify(error);
      log("chapter failed", job.chapterId, failure, error);
      job.status = "failed";
      job.failure = failure;
      if (job.kind === "download") track("download_failed", { kind: failure });
      // A full disk stops the queue: every chapter after it would fail too.
      if (failure === "disk_full") {
        for (const waiting of jobs) {
          if (waiting.status !== "queued") continue;
          waiting.status = "cancelled";
          dropPartial(waiting);
        }
      }
    }
  } finally {
    inFlight = null;
    finish();
  }

  settle();
  emit();
  void pump();
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A write that ran out of space: the catalog's size was short, or the phone filled meanwhile. */
function isDiskFull(error: unknown): boolean {
  return /ENOSPC|no space|disk full|storage full/i.test(messageOf(error));
}

/** An error that isn't the queue's own: a full disk, else the network, else something else. */
function classify(error: unknown): DownloadFailure {
  if (isDiskFull(error)) return "disk_full";
  try {
    if (!hasRoomFor(availableBytes(), 0)) return "disk_full";
  } catch {
    // The disk check itself failed: fall through.
  }
  return /network|timeout|timed out|unable to|host|connect|socket|fetch|download|http/i.test(messageOf(error))
    ? "network"
    : "other";
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) throw new Error("aborted");
}

/** Deletes the narration's partial file a paused try kept, if there is one. */
function dropPartial(job: Job) {
  if (job.partial === null) return;
  deletePartial(job.partial.name);
  job.partial = null;
}

/**
 * The lock rule for a chapter about to download, against the unlocks and
 * the entitlement fetched within the last minute. Never a Locked chapter,
 * and never one whose lock can't be told: a failed input fails it. True when
 * only Talebrim Unlimited opens it (`openedByPlan()`), so a refusal from the
 * server may be its copy of the plan running behind (prompt 22a).
 */
async function checkOpenable(userId: string, row: DownloadRow): Promise<boolean> {
  if (row.id === null || row.number === null) throw new DownloadError("other");
  let inputs;
  try {
    const [unlocks, entitlement] = await Promise.all([
      queryClient.fetchQuery({ ...unlocksByUserOptions(userId), staleTime: LOCK_INPUTS_FRESH_MS }),
      queryClient.fetchQuery({ ...entitlementOptions(userId), staleTime: LOCK_INPUTS_FRESH_MS }),
    ]);
    inputs = {
      unlockedChapterIds: new Set(unlocks.map((unlock) => unlock.chapter_id)),
      isSubscribed: entitlement.active,
    };
  } catch {
    throw new DownloadError("network");
  }
  const chapter = { id: row.id, number: row.number, access: row.access };
  if (chapterStateFor(chapter, inputs).kind === "locked") throw new DownloadError("refused");
  return openedByPlan(chapter, inputs);
}

/** The chapter's narration source, signed now when `fresh`. */
async function fetchSource(userId: string, chapterId: string, fresh: boolean): Promise<ChapterAudioSource> {
  const options = chapterAudioSourceOptions(userId, chapterId);
  try {
    return await queryClient.fetchQuery(fresh ? { ...options, staleTime: 0 } : options);
  } catch {
    throw new DownloadError("network");
  }
}

/**
 * The chapter's signed narration URL. `fresh` signs a new one. A refusal is
 * the storage policy saying no (a locked chapter): the chapter fails as
 * refused and is never retried. For a chapter only Talebrim Unlimited opens
 * (`byPlan`), a refusal, or the row withheld, can be the server's copy of the
 * plan running behind the phone's (prompt 22a step 8): the server is asked
 * to check it once, and the chapter is signed once more, before it fails.
 */
async function sign(
  userId: string,
  chapterId: string,
  fresh: boolean,
  byPlan: boolean,
): Promise<Extract<ChapterAudioSource, { kind: "signed" }>> {
  let source = await fetchSource(userId, chapterId, fresh);
  if (byPlan && source.kind !== "signed") {
    log("refused under the plan: the server checks it", chapterId);
    await syncServerPlan();
    source = await fetchSource(userId, chapterId, true);
  }
  if (source.kind === "refused") throw new DownloadError("refused");
  // The row lost its narration after `has_audio` was read; for a chapter
  // only the plan opens, the server withholding the row.
  if (source.kind === "unavailable") throw new DownloadError(byPlan ? "refused" : "other");
  return source;
}

/**
 * The chapter's text, read fresh on the sanctioned terms: the lock check
 * ran for this chapter, and the catalog row proves it published. Null when
 * it has none. For a chapter only Talebrim Unlimited opens, a read that
 * comes back empty although the row has text is the server withholding it
 * (prompt 22a step 8): the server checks the plan once, the text is read once
 * more, and still empty, the chapter fails as refused.
 */
async function readText(chapterId: string, hasText: boolean | null, byPlan: boolean): Promise<string | null> {
  const read = () => queryClient.fetchQuery({ ...chapterTextOptions(chapterId), staleTime: 0 });
  let value: string | null;
  try {
    value = await read();
    if (byPlan && textWithheld(hasText, value)) {
      log("text withheld under the plan: the server checks it", chapterId);
      await syncServerPlan();
      value = await read();
    }
  } catch {
    throw new DownloadError("network");
  }
  if (byPlan && textWithheld(hasText, value)) throw new DownloadError("refused");
  return value;
}

type PartialFile = { name: string; file: ReturnType<typeof writeTextToPartial> };

type DownloadedAudio = { partial: PartialFile; ext: string; path: string };

/**
 * The chapter's narration, as a complete partial file. A partial file a
 * paused try of the same recording kept carries on from its last byte, or
 * is used as it is if it had finished. Anything else starts from the first
 * byte. A failed try (an expired URL mid-queue, a dropped request, a resume
 * the server refused) is signed again and started over, once. The job holds
 * the partial file throughout, so a pause keeps it and anything else drops
 * it (`pump()`).
 */
async function downloadAudio(
  userId: string,
  job: Job,
  first: Extract<ChapterAudioSource, { kind: "signed" }>,
  byPlan: boolean,
  signal: AbortSignal,
  onProgress: (progress: { bytesWritten: number; totalBytes: number }) => void,
): Promise<DownloadedAudio> {
  let source = first;
  for (let attempt = 1; ; attempt += 1) {
    const ext = audioExtension(source.path);
    const name = audioFileName(job.chapterId, ext);
    const kept = job.partial;
    const resume = attempt === 1 && kept !== null && kept.path === source.path && kept.name === name;
    if (!resume) dropPartial(job);
    if (resume && kept.complete) {
      const file = partialFile(name);
      if (file.exists) {
        onProgress({ bytesWritten: file.size, totalBytes: file.size });
        return { partial: { name, file }, ext, path: source.path };
      }
    }
    job.partial = { name, path: source.path, complete: false };
    try {
      const file = await downloadToPartial(source.url, name, { onProgress, signal, resume });
      job.partial = { name, path: source.path, complete: true };
      return { partial: { name, file }, ext, path: source.path };
    } catch (error) {
      if (signal.aborted || isDiskFull(error) || attempt > 1) throw error;
      log("audio download failed, signing again", job.chapterId, { resumed: resume }, error);
      source = await sign(userId, job.chapterId, true, byPlan);
    }
  }
}

/**
 * One chapter: checked, sized against the free space, then its narration
 * and its text written as partial files, renamed into place together, and
 * entered in the index. A refresh fetches only what changed. A refresh is
 * checked against the lock rule too, since 2026-10-02 (prompt 22a): for a
 * chapter only the plan opens, a text the server withholds then fails it,
 * rather than leaving the old text marked current.
 */
async function runJob(userId: string, job: Job, signal: AbortSignal): Promise<void> {
  const { row, chapterId } = job;
  const existing = downloadFor(userId, chapterId);
  // Removed since the check queued it: nothing to refresh.
  if (job.kind === "refresh" && existing === null) return;

  const byPlan = await checkOpenable(userId, row);
  throwIfAborted(signal);

  // What to fetch. A refresh reads the narration's path again, on the
  // sanctioned terms, and fetches the narration only if the path changed.
  let source: Extract<ChapterAudioSource, { kind: "signed" }> | null = null;
  let parts = { audio: row.has_audio === true, text: row.has_text === true };
  if (job.kind === "refresh" && existing !== null) {
    if (row.has_audio === true) source = await sign(userId, chapterId, true, byPlan);
    parts = refreshParts(existing, row, source?.path ?? null);
  }

  const size = chapterDownloadSize({
    ...row,
    has_audio: parts.audio,
    has_text: parts.text,
  });
  let free: number;
  try {
    free = availableBytes();
  } catch {
    throw new DownloadError("other");
  }
  if (!hasRoomFor(free, size.bytes)) throw new DownloadError("disk_full");

  const expectedText = parts.text ? (row.text_bytes ?? 0) : 0;
  let expectedAudio = parts.audio ? Math.max(0, size.bytes - expectedText) : 0;
  let written = 0;
  const report = (audioWritten: number, textDone: boolean) => {
    const total = expectedAudio + expectedText;
    const done = audioWritten + (textDone ? expectedText : 0);
    const progress = total > 0 ? Math.min(1, done / total) : 0;
    // Whole percents only: a re-render per percent, not per packet.
    if (Math.floor(progress * 100) !== Math.floor(job.progress * 100)) update(job, { progress });
    written = audioWritten;
  };

  let audio: DownloadedAudio | null = null;
  let text: { partial: PartialFile; length: number } | null = null;
  try {
    if (parts.audio) {
      source ??= await sign(userId, chapterId, false, byPlan);
      const onProgress = ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
        if (totalBytes > 0) expectedAudio = totalBytes;
        report(bytesWritten, false);
      };
      audio = await downloadAudio(userId, job, source, byPlan, signal, onProgress);
    }
    throwIfAborted(signal);

    if (parts.text) {
      const value = await readText(chapterId, row.has_text, byPlan);
      throwIfAborted(signal);
      if (value !== null && value.trim().length > 0) {
        const name = textFileName(chapterId);
        text = { partial: { name, file: writeTextToPartial(name, value) }, length: value.length };
      }
      report(written, true);
    }
    throwIfAborted(signal);

    if (job.kind === "download" && audio === null && text === null) throw new DownloadError("other");
    commit(userId, job, existing, audio, text);
  } catch (error) {
    // The text is fetched again on any retry. The narration's partial file is
    // the job's: `pump()` keeps it for a pause and drops it otherwise.
    if (text !== null) deleteFile(text.partial.file.name);
    throw error;
  }
}

/** Renames the partial files into place, then enters the chapter in the index. */
function commit(
  userId: string,
  job: Job,
  existing: DownloadEntry | null,
  audio: DownloadedAudio | null,
  text: { partial: PartialFile; length: number } | null,
) {
  const { row, chapterId, book } = job;
  if (row.number === null) throw new DownloadError("other");

  let audioEntry = existing?.audio ?? null;
  if (audio !== null) {
    const bytes = commitFile(audio.partial.file, audio.partial.name);
    // Renamed into place: no partial file left to keep or drop.
    job.partial = null;
    // A replaced recording can have another extension: the old file goes.
    if (audioEntry !== null && audioEntry.ext !== audio.ext) deleteFile(audioFileName(chapterId, audioEntry.ext));
    audioEntry = { ext: audio.ext, bytes, path: audio.path };
  } else if (row.has_audio !== true && audioEntry !== null) {
    deleteFile(audioFileName(chapterId, audioEntry.ext));
    audioEntry = null;
  }

  let textEntry = existing?.text ?? null;
  if (text !== null) {
    textEntry = { bytes: commitFile(text.partial.file, text.partial.name), length: text.length };
  } else if (job.kind === "download" || row.has_text !== true) {
    // No text to keep: none came back, or the chapter lost it.
    if (textEntry !== null) deleteFile(textFileName(chapterId));
    textEntry = null;
  }

  const measured = row.audio_duration_seconds;
  useDownloadsStore.getState().put(userId, {
    chapterId,
    book: existing?.book ?? book,
    number: row.number,
    title: row.title,
    hasText: textEntry !== null,
    hasAudio: audioEntry !== null,
    durationSeconds: measured !== null && Number.isFinite(measured) && measured > 0 ? measured : null,
    audio: audioEntry,
    text: textEntry,
    updatedAt: row.updated_at,
    verifiedAt: Date.now(),
  });
}
