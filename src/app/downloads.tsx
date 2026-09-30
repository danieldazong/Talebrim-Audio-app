import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { DownloadedBook } from "@/components/downloads/downloaded-book";
import { DownloadingBook } from "@/components/downloads/downloading-book";
import { Screen, TextLink } from "@/components/ui";
import { useDownloadEntries, useDownloadQueue, useDownloadsHydrated, useIsOnline } from "@/hooks/use-downloads";
import { availableBytes, downloadsAvailable } from "@/lib/downloads/files";
import { removeAllDownloads, removeBookDownloads } from "@/lib/downloads/manage";
import { cancelBookDownloads } from "@/lib/downloads/queue";
import { downloadingBooks, entryBytes, groupByBook } from "@/lib/downloads/rules";
import { formatBytes, formatBytesSpoken } from "@/lib/format";
import { useDownloadsStore, type DownloadEntry } from "@/store/downloads-store";
import { colors, layout } from "@/theme";

// Downloads — prompt 24 step 12. No frame: built from M9's rows and M7's
// header, and reported for design review. A pushed route over the tab shell
// (no tab bar, no mini player). Opened from M11's "Downloads & offline
// storage" row (prompt 25), the Profile placeholder until then, and M3's
// offline state. Everything here is read from the downloads index, so it
// works with no network at all.

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** A chapter opens in the reader when its text is downloaded, else in the player. Pushed, so back returns here. */
function openChapter(entry: DownloadEntry) {
  router.push({
    pathname: entry.text ? "/reader/[chapterId]" : "/player/[chapterId]",
    params: { chapterId: entry.chapterId },
  });
}

/** A book still downloading opens M9, where each chapter's progress and Cancel are. */
function openChapterList(bookId: string) {
  router.push({ pathname: "/chapters/[bookId]", params: { bookId } });
}

/** The phone's free space; null where it can't be read. */
function readFreeBytes(): number | null {
  if (!downloadsAvailable()) return null;
  try {
    return availableBytes();
  } catch {
    return null;
  }
}

/** "Remove all downloads": the one confirmation this screen asks. */
function confirmRemoveAll() {
  Alert.alert("Remove all downloads?", "Every downloaded chapter is removed from this phone. You can download them again.", [
    { text: "Cancel", style: "cancel" },
    { text: "Remove all", style: "destructive", onPress: removeAllDownloads },
  ]);
}

export default function DownloadsRoute() {
  const hydrated = useDownloadsHydrated();
  const entries = useDownloadEntries();
  const online = useIsOnline();
  const groups = useMemo(() => groupByBook(entries), [entries]);
  // Books still downloading show above the downloaded ones, so a long
  // chapter under way is never mistaken for a lost one.
  const queue = useDownloadQueue();
  const downloading = useMemo(() => downloadingBooks(queue), [queue]);
  const total = useMemo(() => entries.reduce((sum, entry) => sum + entryBytes(entry), 0), [entries]);

  // Free space and "now", read again whenever the screen gains focus and
  // whenever the index changes (a remove here, a download finishing).
  const [freeBytes, setFreeBytes] = useState<number | null>(readFreeBytes);
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setFreeBytes(readFreeBytes());
      setNow(Date.now());
    }, []),
  );
  useEffect(() => useDownloadsStore.subscribe(() => setFreeBytes(readFreeBytes())), []);

  const summary = [
    entries.length > 0 ? `${formatBytes(total)} on this phone` : null,
    freeBytes !== null ? `${formatBytes(freeBytes)} free` : null,
  ].filter((part) => part !== null);
  const spokenSummary = [
    entries.length > 0 ? `${formatBytesSpoken(total)} on this phone` : null,
    freeBytes !== null ? `${formatBytesSpoken(freeBytes)} free` : null,
  ].filter((part) => part !== null);

  return (
    <Screen>
      <View className="flex-row items-center pb-2 pl-1.5 pr-4 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          // No className beside a `style` function (AGENTS.md § Style Exception Rules).
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.body} />
        </Pressable>
        <Text accessibilityRole="header" className="text-heading ml-1 text-2xl leading-8" maxFontSizeMultiplier={1.3}>
          Downloads
        </Text>
      </View>

      {summary.length > 0 ? (
        <Text
          accessibilityLabel={spokenSummary.join(", ")}
          className="font-ui text-muted px-4 pb-3 text-sm"
          maxFontSizeMultiplier={1.3}
        >
          {summary.join(" · ")}
        </Text>
      ) : null}

      {!hydrated ? (
        <DownloadsSkeleton />
      ) : groups.length === 0 && downloading.length === 0 ? (
        <NoDownloads />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.book.id}
          renderItem={({ item }) => (
            <DownloadedBook
              group={item}
              online={online}
              now={now}
              onOpenChapter={openChapter}
              onRemoveBook={removeBookDownloads}
            />
          )}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            downloading.length > 0 ? (
              <View className="gap-3">
                {downloading.map((info) => (
                  <DownloadingBook
                    key={info.book.id}
                    info={info}
                    online={online}
                    onOpen={openChapterList}
                    onCancel={cancelBookDownloads}
                  />
                ))}
              </View>
            ) : null
          }
          ListFooterComponent={
            groups.length > 0 ? (
              <View className="items-center pt-2">
                <TextLink label="Remove all downloads" onPress={confirmRemoveAll} />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

/** Loading: the index is still rehydrating. Cards shaped like the real ones. */
function DownloadsSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading downloads" accessibilityState={{ busy: true }} className="gap-3 px-4">
      {[0, 1].map((key) => (
        <View key={key} className="flex-row items-center gap-3 rounded-card bg-surface p-3">
          <View className="aspect-[2/3] rounded-cover bg-raised" style={{ width: 48 }} />
          <View className="flex-1 gap-2.5">
            <View className="h-4 w-40 rounded-pill bg-raised" />
            <View className="h-3 w-28 rounded-pill bg-raised" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Empty: nothing downloaded, and where to start. */
function NoDownloads() {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name="download-outline" size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        No downloads yet
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        {downloadsAvailable()
          ? "Download chapters from a story's chapter list to read and listen with no connection."
          : "Downloads work in the Talebrim app for Android."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    gap: 12,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 24,
  },
});
