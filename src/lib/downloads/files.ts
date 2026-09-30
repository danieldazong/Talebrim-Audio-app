// The one module that touches the file system for downloads — prompt 24.
// No React, no hooks, no JSX (AGENTS.md § lib/). `expo-file-system`'s new API
// only (`File`, `Directory`, `Paths`), never the legacy one.
//
// Everything lives in ONE folder, `downloads/` under `Paths.document`:
// app-private and persistent. Never `Paths.cache`, which the OS may purge (a
// purged download is the bug readers report as "it deleted my book"), never
// shared storage, and never the media library. Nothing else in
// `Paths.document` is ever written, renamed or deleted: PostHog keeps its
// event queue and the analytics opt-out as files at its root.
import { Directory, DownloadTask, File, Paths, type DownloadTaskOptions } from "expo-file-system";
import { Platform } from "react-native";

import { PARTIAL_SUFFIX } from "@/lib/downloads/rules";

const FOLDER = "downloads";

/**
 * Downloads run on Android only, while iOS scope is open (AGENTS.md
 * § Important Constraints): an iOS build would first need the folder kept
 * out of iCloud backup. Never on the web, where `expo-file-system` has no
 * file system, and so never in the web build's server render either.
 */
export function downloadsAvailable(): boolean {
  return Platform.OS === "android";
}

function folder(): Directory {
  return new Directory(Paths.document, FOLDER);
}

/** A file inside `downloads/`. `name` is always a chapter id and an extension: never a path. */
export function downloadFile(name: string): File {
  return new File(folder(), name);
}

/** The partial file a download writes before it is renamed into place. */
export function partialFile(name: string): File {
  return downloadFile(`${name}${PARTIAL_SUFFIX}`);
}

/** Creates `downloads/` if it isn't there. */
export function ensureFolder(): void {
  const dir = folder();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

/** The names of every file in `downloads/`; none when it doesn't exist. */
export function listFileNames(): string[] {
  const dir = folder();
  if (!dir.exists) return [];
  return dir.list().flatMap((item) => (item instanceof File ? [item.name] : []));
}

/** Deletes one file in `downloads/`, if it is there. Never throws. */
export function deleteFile(name: string): void {
  try {
    const file = downloadFile(name);
    if (file.exists) file.delete();
  } catch {
    // Already gone, or held open: reconciling on the next start deletes it.
  }
}

/** Deletes `downloads/` and everything in it. Never `Paths.document` itself. */
export function deleteFolder(): void {
  const dir = folder();
  if (dir.exists) dir.delete();
}

/** The phone's free space, in bytes. */
export function availableBytes(): number {
  return Paths.availableDiskSpace;
}

/** Deletes `name`'s partial file, if it is there. Never throws. */
export function deletePartial(name: string): void {
  deleteFile(`${name}${PARTIAL_SUFFIX}`);
}

function pausedError(): Error {
  const error = new Error("The download was paused.");
  error.name = "AbortError";
  return error;
}

/**
 * Downloads `url` into `name`'s partial file. The caller renames it into
 * place once every part of the chapter is on disk (`commitFile()`).
 *
 * With `resume`, it carries on from the bytes already in the partial file: a
 * Range request from its length. A server that ignores Range sends the whole
 * file, which is then written from the start.
 *
 * Aborting `signal` pauses the download: the request stops, the bytes so far
 * stay on disk for a later `resume`, and the promise rejects with an
 * AbortError. It pauses the native task rather than cancelling it: in 57.0.7
 * a cancel can leave the task's promise unsettled on Android, and a pause
 * always settles it. A failure leaves the partial file too. The caller
 * deletes it (`deletePartial()`) when it won't carry on from it.
 */
export async function downloadToPartial(
  url: string,
  name: string,
  { onProgress, signal, resume }: Pick<DownloadTaskOptions, "onProgress"> & { signal: AbortSignal; resume: boolean },
): Promise<File> {
  if (signal.aborted) throw pausedError();
  ensureFolder();
  const partial = partialFile(name);
  const from = resume && partial.exists ? partial.size : 0;
  const task =
    from > 0
      ? DownloadTask.fromSavable({ url, fileUri: partial.uri, isDirectory: false, resumeData: String(from) }, { onProgress })
      : File.createDownloadTask(url, partial, { onProgress });
  const pause = () => {
    if (task.state === "active") task.pause();
  };
  signal.addEventListener("abort", pause, { once: true });
  try {
    const file = from > 0 ? await task.resumeAsync() : await task.downloadAsync();
    if (file === null) throw pausedError();
    return file;
  } finally {
    signal.removeEventListener("abort", pause);
    task.release();
  }
}

/** Writes `text` into `name`'s partial file. */
export function writeTextToPartial(name: string, text: string): File {
  ensureFolder();
  const partial = partialFile(name);
  try {
    partial.write(text);
  } catch (error) {
    // A full disk can fail the write halfway.
    deleteFile(partial.name);
    throw error;
  }
  return partial;
}

/** Renames a partial file into place, replacing what was there. Returns its size. */
export function commitFile(partial: File, name: string): number {
  const target = downloadFile(name);
  partial.moveSync(target, { overwrite: true });
  return target.size;
}

/** A downloaded chapter's text, from its file. */
export function readTextFile(name: string): Promise<string> {
  return downloadFile(name).text();
}

/** A file's `file://` URI, which the player loads as it loads a signed URL. */
export function fileUri(name: string): string {
  return downloadFile(name).uri;
}
