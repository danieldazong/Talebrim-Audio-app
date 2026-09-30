// Looking up a download on this phone — prompt 24 step 9. No React, no
// hooks, no JSX (AGENTS.md § lib/). The player, `resolve.ts`, the queue and
// the access check all ask here, so "is it downloaded" has one answer.
import { onlineManager } from "@tanstack/react-query";

import { fileUri } from "@/lib/downloads/files";
import { audioFileName, withinOfflineWindow } from "@/lib/downloads/rules";
import { useDownloadsStore, type DownloadEntry } from "@/store/downloads-store";

/** `userId`'s download of a chapter, or null. Never another account's. */
export function downloadFor(userId: string | null | undefined, chapterId: string): DownloadEntry | null {
  const { userId: owner, chapters } = useDownloadsStore.getState();
  if (!userId || owner !== userId) return null;
  return chapters[chapterId] ?? null;
}

/** Every download `userId` has. */
export function downloadsFor(userId: string | null | undefined): DownloadEntry[] {
  const { userId: owner, chapters } = useDownloadsStore.getState();
  if (!userId || owner !== userId) return [];
  return Object.values(chapters);
}

/**
 * Whether a download opens right now: always online, where the lock check
 * is live and the file is still what plays and reads; offline, for 30 days
 * after its last online check.
 */
export function opensNow(entry: DownloadEntry, online: boolean, now: number): boolean {
  return online || withinOfflineWindow(entry.verifiedAt, now);
}

/**
 * The file the player loads for a downloaded chapter, instead of signing a
 * URL: no signing, no re-mint and no network for it. Null when the chapter
 * isn't downloaded with narration, or has been offline past its 30 days,
 * where signing waits for a connection instead.
 */
export function localAudioUri(userId: string | null, chapterId: string, now = Date.now()): string | null {
  const entry = downloadFor(userId, chapterId);
  if (entry?.audio == null || !opensNow(entry, onlineManager.isOnline(), now)) return null;
  return fileUri(audioFileName(chapterId, entry.audio.ext));
}
