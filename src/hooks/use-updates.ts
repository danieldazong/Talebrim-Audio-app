import { useAuth, useUser } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useEntitlement } from "@/hooks/use-entitlement";
import { track } from "@/lib/analytics";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { libraryItemsByUserOptions } from "@/lib/queries/library-items";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { updatesOptions } from "@/lib/queries/updates";
import { waitFor, type WaitStatus } from "@/lib/query-status";
import {
  buildUpdates,
  latestSeen,
  newestUpdateAt,
  seenAtFromAccount,
  unreadCount,
  type UpdateItem,
} from "@/lib/updates";
import { useUpdatesStore } from "@/store/updates-store";
import type { ChapterLockInputs } from "@/types/states";

// The Updates inbox behind Discover's bell (2026-09-30): new chapters of the
// books on My List. `lib/updates.ts` holds the rules.

/** The phone's "seen" has rehydrated: until then nothing counts as new or seen. */
function useUpdatesHydrated(): boolean {
  return useSyncExternalStore(
    (listener) => useUpdatesStore.persist.onFinishHydration(listener),
    () => useUpdatesStore.persist.hasHydrated(),
  );
}

/** The two lists and "seen", as both the bell and the screen read them. */
function useUpdatesData() {
  const { userId } = useAuth();
  const { user } = useUser();
  const myList = useQuery({ ...libraryItemsByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const bookIds = useMemo(() => myList.data?.map((item) => item.book_id) ?? [], [myList.data]);
  const updates = useQuery({
    ...updatesOptions(userId ?? "", bookIds),
    enabled: Boolean(userId) && myList.data !== undefined,
  });
  const onPhone = useUpdatesStore((state) => (userId && state.userId === userId ? state.seenAt : null));
  const onAccount = seenAtFromAccount(user?.unsafeMetadata);
  const seenAt = latestSeen(onPhone, onAccount);
  const hydrated = useUpdatesHydrated();

  /**
   * Moves "seen" to `newest` (a server time): at once on this phone, and on
   * the account when it is behind. Offline, the account catches up the next
   * time Updates opens.
   */
  const markSeen = useCallback(
    (newest: number) => {
      if (!userId) return;
      useUpdatesStore.getState().markSeen(userId, newest);
      if (!user || (onAccount !== null && onAccount >= newest)) return;
      // Deep-merged: nothing else in `unsafeMetadata` changes.
      user
        .updateMetadata({ unsafeMetadata: { updates: { seenAt: new Date(newest).toISOString() } } })
        .catch((error: unknown) => {
          if (__DEV__) console.warn("[updates] couldn't save to the account", error);
        });
    },
    [userId, user, onAccount],
  );

  return { userId, myList, updates, seenAt, hydrated, markSeen };
}

/** How many chapters are new: the dot on Discover's bell. 0 until both lists load. */
export function useUnreadUpdates(): number {
  const { myList, updates, seenAt, hydrated } = useUpdatesData();
  return useMemo(
    () => (hydrated && myList.data && updates.data ? unreadCount(buildUpdates(updates.data, myList.data, seenAt)) : 0),
    [hydrated, myList.data, updates.data, seenAt],
  );
}

export type UpdatesView =
  | { status: WaitStatus }
  /** Nothing on My List: nothing to follow. */
  | { status: "no-list" }
  /** On My List, but no new chapter in 30 days. */
  | { status: "empty" }
  | { status: "ready"; items: UpdateItem[] };

/**
 * The Updates screen. "New" is measured against "seen" as it was when the
 * screen opened, so the markers stay for this visit while the bell's dot
 * clears at once. Chapters that arrive while it is open are marked seen too.
 */
export function useUpdatesScreen() {
  const { userId, myList, updates, seenAt, hydrated, markSeen } = useUpdatesData();
  const settings = useQuery(appSettingsOptions());
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });
  const entitlement = useEntitlement();

  // "Seen" as it was when the screen first had both lists: undefined until then.
  const [seenAtOpen, setSeenAtOpen] = useState<{ value: number | null } | undefined>(undefined);
  if (seenAtOpen === undefined && hydrated && myList.data && updates.data) setSeenAtOpen({ value: seenAt });

  const items = useMemo(
    () => (myList.data && updates.data && seenAtOpen ? buildUpdates(updates.data, myList.data, seenAtOpen.value) : null),
    [myList.data, updates.data, seenAtOpen],
  );
  const newest = items === null ? null : newestUpdateAt(items);

  // Only while the screen is in front: a chapter arriving then has been seen.
  useFocusEffect(
    useCallback(() => {
      if (newest !== null) markSeen(newest);
    }, [newest, markSeen]),
  );

  // Once per visit, with how many were new.
  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || items === null) return;
    tracked.current = true;
    track("updates_opened", { new_chapters: unreadCount(items) });
  }, [items]);

  const lockInputs: ChapterLockInputs | null =
    unlocks.data && entitlement.data
      ? {
          unlockedChapterIds: new Set(unlocks.data.map((unlock) => unlock.chapter_id)),
          isSubscribed: entitlement.data.active,
        }
      : null;

  let view: UpdatesView;
  let waitingOn: { refetch: () => Promise<unknown> }[] = [];
  if (myList.data === undefined) {
    ({ view, waitingOn } = waitFor([myList]));
  } else if (myList.data.length === 0) {
    view = { status: "no-list" };
  } else if (items === null) {
    ({ view, waitingOn } = waitFor([updates]));
  } else {
    view = items.length === 0 ? { status: "empty" } : { status: "ready", items };
  }

  function retry() {
    for (const query of waitingOn) void query.refetch();
  }

  return { view, retry, lockInputs, publicCdnDomain: settings.data?.public_cdn_domain ?? null };
}
