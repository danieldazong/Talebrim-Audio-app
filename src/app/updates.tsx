import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { UpdateRow } from "@/components/updates/update-row";
import { Button, Screen } from "@/components/ui";
import { useAlertsStatus, type AlertsView } from "@/hooks/use-alerts";
import { useUpdatesScreen } from "@/hooks/use-updates";
import { resolveCoverUrl } from "@/lib/covers";
import { openPaywall } from "@/lib/paywall";
import type { UpdateItem } from "@/lib/updates";
import { colors, layout, radius } from "@/theme";
import { chapterStateFor, type ChapterLockInputs } from "@/types/states";

// Updates — Discover's bell (2026-09-30; AGENTS.md, Decisions — 2026-09-30,
// "Updates inbox"). New chapters of the stories on My List, newest first,
// from the last 30 days, with new-chapter alerts' on/off row at the top. No
// frame: Downloads' header and M9's rows, for design review. A pushed route
// over the tab shell (no tab bar, no mini player).

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** The lock, once the unlocks and the entitlement are known; null before. */
function isLocked(item: UpdateItem, inputs: ChapterLockInputs | null): boolean | null {
  if (inputs === null) return null;
  return chapterStateFor({ id: item.chapterId, number: item.number, access: item.access }, inputs).kind === "locked";
}

export default function UpdatesRoute() {
  const { view, retry, lockInputs, publicCdnDomain } = useUpdatesScreen();

  // "5 min ago" is measured from when the screen last came into view.
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => setNow(Date.now()), []));

  // A locked chapter opens M5a, never the chapter; while the lock can't be
  // told yet, the chapter opens and checks it itself. Pushed, so back returns
  // here.
  function open(item: UpdateItem) {
    const mode = item.hasText ? "text" : "audio";
    if (isLocked(item, lockInputs) === true) {
      openPaywall(item.chapterId, mode, "updates");
      return;
    }
    router.push({
      pathname: mode === "text" ? "/reader/[chapterId]" : "/player/[chapterId]",
      params: { chapterId: item.chapterId },
    });
  }

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
          Updates
        </Text>
      </View>

      <View className="px-4 pb-2">
        <AlertsRow />
      </View>

      {view.status === "ready" ? (
        <FlatList
          data={view.items}
          keyExtractor={(item) => item.chapterId}
          renderItem={({ item }) => (
            <UpdateRow
              item={item}
              coverUrl={publicCdnDomain === null ? null : resolveCoverUrl(publicCdnDomain, item.coverPath)}
              locked={isLocked(item, lockInputs)}
              now={now}
              onOpen={open}
            />
          )}
          ItemSeparatorComponent={Divider}
          contentContainerStyle={styles.list}
        />
      ) : view.status === "loading" ? (
        <UpdatesSkeleton />
      ) : view.status === "no-list" ? (
        <Message
          icon="add-circle-outline"
          title="Nothing to follow yet"
          line="Tap + My List on a story's page, and its new chapters show up here."
        />
      ) : view.status === "empty" ? (
        <Message
          icon="notifications-outline"
          title="No new chapters yet"
          line="New chapters of the stories on your My List show up here."
        />
      ) : view.status === "offline" ? (
        <Message icon="cloud-offline-outline" title="You're offline" line="Updates load when you reconnect." />
      ) : (
        <Message icon="alert-circle-outline" title="Couldn't load updates" line="Check your connection and try again.">
          <Button label="Try again" variant="outlined" onPress={retry} />
        </Message>
      )}
    </Screen>
  );
}

const ALERTS_STATUS: Record<AlertsView["status"], string> = {
  on: "On",
  off: "Off",
  blocked: "Off in Android settings",
  unavailable: "In the Talebrim app for Android",
  loading: "",
};

/**
 * New-chapter alerts, on or off: the bell's job until Updates took it. Opens
 * the alerts sheet, which turns them on or off, or explains why it can't.
 */
function AlertsRow() {
  const alerts = useAlertsStatus();
  const status = ALERTS_STATUS[alerts.status];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`New chapter alerts${status ? `, ${status}` : ""}. Opens the alert settings.`}
      onPress={() => router.push({ pathname: "/alerts", params: { from: "updates" } })}
      style={({ pressed }) => [styles.alerts, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons
        name={alerts.status === "on" ? "notifications" : "notifications-off-outline"}
        size={20}
        color={alerts.status === "on" ? colors.teal : colors.muted}
      />
      <Text className="font-ui-medium text-body flex-1 text-[15px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
        New chapter alerts
      </Text>
      <Text className="font-ui text-muted text-[13px]" numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {status}
      </Text>
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

/** Loading: rows shaped like the real ones, on the screen's own surface. */
function UpdatesSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading updates" accessibilityState={{ busy: true }} className="px-4">
      {[0, 1, 2].map((key) => (
        <View key={key} className="flex-row items-center gap-3 py-3">
          <View className="aspect-[2/3] rounded-cover bg-surface" style={{ width: 40 }} />
          <View className="flex-1 gap-2">
            <View className="h-3 w-24 rounded-pill bg-surface" />
            <View className="h-4 w-44 rounded-pill bg-surface" />
            <View className="h-3 w-16 rounded-pill bg-surface" />
          </View>
        </View>
      ))}
    </View>
  );
}

type MessageProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  line: string;
  children?: React.ReactNode;
};

/** Empty, offline and failed: an icon, a line, and what to do. */
function Message({ icon, title, line, children }: MessageProps) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {title}
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        {line}
      </Text>
      {children}
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
  alerts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  divider: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.raised,
  },
  list: {
    paddingHorizontal: layout.screenPadding,
    paddingBottom: 24,
  },
});
