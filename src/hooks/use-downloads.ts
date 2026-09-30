import { useAuth } from "@clerk/expo";
import NetInfo from "@react-native-community/netinfo";
import { onlineManager } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Alert } from "react-native";

import { useIsForeground } from "@/hooks/use-is-foreground";
import { downloadsAvailable } from "@/lib/downloads/files";
import {
  prepareDownloads,
  reconcileDownloads,
  removeChapterDownload,
  startDownloads,
  verifyAllDownloads,
  verifyDownloads,
} from "@/lib/downloads/manage";
import {
  cancelBookDownloads,
  cancelChapterDownload,
  getDownloadQueue,
  subscribeDownloadQueue,
  type QueueItem,
} from "@/lib/downloads/queue";
import { downloadConfirmation } from "@/lib/downloads/rules";
import { useDownloadsStore, type DownloadEntry } from "@/store/downloads-store";

// Offline downloads, as screens read them — prompt 24. The index is
// `store/downloads-store.ts`, the queue `lib/downloads/queue.ts`.

function subscribeHydration(listener: () => void): () => void {
  return useDownloadsStore.persist.onFinishHydration(listener);
}

/**
 * True once the index has rehydrated from AsyncStorage. Everything that
 * decides "downloaded or not" waits for it, so a cold start offline never
 * shows a downloaded chapter as missing.
 */
export function useDownloadsHydrated(): boolean {
  return useSyncExternalStore(subscribeHydration, () => useDownloadsStore.persist.hasHydrated());
}

/** TanStack's view of the connection, which NetInfo feeds (`lib/query-client.ts`). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
  );
}

/**
 * The signed-in reader's download of a chapter: undefined until the index has
 * rehydrated, then the entry or null. Never another account's.
 */
export function useDownloadEntry(chapterId: string): DownloadEntry | null | undefined {
  const { userId } = useAuth();
  const hydrated = useDownloadsHydrated();
  const entry = useDownloadsStore((state) =>
    userId && state.userId === userId ? (state.chapters[chapterId] ?? null) : null,
  );
  return hydrated ? entry : undefined;
}

/** Every download the signed-in reader has; empty until the index has rehydrated. */
export function useDownloadEntries(): DownloadEntry[] {
  const { userId } = useAuth();
  const chapters = useDownloadsStore((state) => (userId && state.userId === userId ? state.chapters : null));
  return useMemo(() => (chapters ? Object.values(chapters) : []), [chapters]);
}

/** The queue: every chapter waiting, downloading, or finished this run. */
export function useDownloadQueue(): readonly QueueItem[] {
  return useSyncExternalStore(subscribeDownloadQueue, getDownloadQueue);
}

/**
 * Online, a download is checked again before it opens (prompt 24 step 8),
 * once per open, alongside the screen's own lock check. Never waited on.
 */
export function useVerifyOnOpen(chapterId: string, entry: DownloadEntry | null | undefined): void {
  const { userId } = useAuth();
  const online = useIsOnline();
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current || !entry || !online || !userId) return;
    checked.current = true;
    void verifyDownloads(userId, [chapterId]);
  }, [chapterId, entry, online, userId]);
}

/**
 * M9's download actions for one book (prompt 24 step 12). "Download all"
 * fetches the chapters, their sizes and the lock inputs fresh, then asks
 * once with the count and the size ("12 chapters, 48 MB"), saying so on
 * mobile data. One chapter's download asks nothing, and neither does a
 * remove. `preparing` is true while the fresh answers load; `prepareFailed`
 * when they couldn't.
 */
export function useBookDownloads(bookId: string) {
  const { userId } = useAuth();
  const online = useIsOnline();
  const [preparing, setPreparing] = useState(false);
  const [prepareFailed, setPrepareFailed] = useState(false);

  async function downloadAll() {
    if (!userId || preparing) return;
    setPreparing(true);
    setPrepareFailed(false);
    try {
      const plan = await prepareDownloads(userId, bookId);
      if (plan.rows.length === 0) return;
      const network = await NetInfo.fetch();
      const { title, message } = downloadConfirmation(plan.rows.length, plan.size, network.type === "cellular");
      Alert.alert(title, message, [
        { text: "Cancel", style: "cancel" },
        { text: "Download", onPress: () => startDownloads(userId, plan, "download_all") },
      ]);
    } catch {
      setPrepareFailed(true);
    } finally {
      setPreparing(false);
    }
  }

  async function downloadChapter(chapterId: string) {
    if (!userId) return;
    setPrepareFailed(false);
    try {
      startDownloads(userId, await prepareDownloads(userId, bookId, chapterId), "row");
    } catch {
      setPrepareFailed(true);
    }
  }

  return {
    online,
    preparing,
    prepareFailed,
    downloadAll,
    downloadChapter,
    cancelAll: () => cancelBookDownloads(bookId),
    cancelChapter: cancelChapterDownload,
    removeChapter: removeChapterDownload,
  };
}

/**
 * Keeps downloads honest for the signed-in reader, from the root navigator:
 * once the index has rehydrated, the index and the folder are made to agree
 * (another account's index deleted), then every download is checked online
 * at start, on each return to the foreground at most once a day, and on
 * reconnecting while one is past its 30 days.
 */
export function useDownloadsSync(): void {
  const { isSignedIn, userId } = useAuth();
  const hydrated = useDownloadsHydrated();
  const isForeground = useIsForeground();
  const online = useIsOnline();
  const account = isSignedIn && userId && hydrated && downloadsAvailable() ? userId : null;

  // Once per account per session, before anything is checked.
  const reconciledFor = useRef<string | null>(null);
  useEffect(() => {
    if (account === null || reconciledFor.current === account) return;
    reconciledFor.current = account;
    reconcileDownloads(account);
    void verifyAllDownloads(account, "start");
  }, [account]);

  const wasForeground = useRef(isForeground);
  useEffect(() => {
    const returned = isForeground && !wasForeground.current;
    wasForeground.current = isForeground;
    if (account !== null && returned) void verifyAllDownloads(account, "foreground");
  }, [account, isForeground]);

  const wasOnline = useRef(online);
  useEffect(() => {
    const reconnected = online && !wasOnline.current;
    wasOnline.current = online;
    if (account !== null && reconnected) void verifyAllDownloads(account, "reconnect");
  }, [account, online]);
}
