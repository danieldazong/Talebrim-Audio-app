import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef } from "react";
import { Linking, Text, View } from "react-native";

import { Button, Cover, Sheet, TextLink } from "@/components/ui";
import { PLAN_NAME } from "@/constants/plan";
import { usePaywallChapter, type PaywallView } from "@/hooks/use-paywall-chapter";
import { usePurchase } from "@/hooks/use-purchase";
import { track } from "@/lib/analytics";
import { isUuid } from "@/lib/ids";
import { isParityMode, isPaywallFrom, openUnlockedChapter, paywallLines, type PaywallFrom } from "@/lib/paywall";
import { billingAvailable } from "@/lib/revenuecat";
import type { ParitySourceMode } from "@/store/parity-store";
import { colors } from "@/theme";

// M5a, the paywall sheet — AGENTS.md M5a, prompt 22 step 9. No frame draws it.
//
// A transparent modal over whatever opened it, receiving the chapter, the
// `mode` the tap was going to (the reader for "text", the player for
// "audio") and where it came from (`lib/paywall.ts`). A scrim, and the sheet
// on `raised`. "Not now", tapping the scrim or Android back closes it.
//
// It sells the story the reader is in: its cover, "Keep reading {story}",
// the locked chapter, three benefits, then "See plans", its one ember action
// (Decisions — 2026-10-01, "The paywall for a first visit"). Prompt 23 adds
// "Unlock free" and "Watch ad & continue"; the owner then sets the order.
//
// Never shown for a chapter that isn't locked: a chapter that turns out open
// (a subscription, an unlock, a restore) replaces the sheet with that
// chapter, in its mode.

/**
 * What a subscription gives, stated before any purchase (AGENTS.md M5a), at
 * most three and each true. Free features (speed, the sleep timer, offline
 * copies of open chapters) are never sold here. The listening and download
 * promises hold for locked chapters once the server knows subscribers
 * (prompt 22a, a launch blocker).
 */
const BENEFITS = [
  { icon: "library-outline", text: "Every chapter of every story, to read or listen" },
  { icon: "flash-outline", text: "New chapters as soon as they're out" },
  { icon: "cloud-download-outline", text: "Download any chapter for offline" },
] as const;

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function PaywallRoute() {
  const { chapterId, mode, from } = useLocalSearchParams<{ chapterId: string; mode?: string; from?: string }>();

  return (
    <Sheet onClose={close}>
      {isUuid(chapterId) ? (
        <ChapterPaywall
          key={chapterId}
          chapterId={chapterId}
          mode={isParityMode(mode) ? mode : "text"}
          from={isPaywallFrom(from) ? from : null}
        />
      ) : (
        // A stale or hand-typed link: nothing to fetch, nothing to unlock.
        <SheetMessage status="unavailable" onRetry={close} />
      )}
    </Sheet>
  );
}

type ChapterPaywallProps = {
  chapterId: string;
  mode: ParitySourceMode;
  /** Null for a hand-typed link: shown, but not counted. */
  from: PaywallFrom | null;
};

function ChapterPaywall({ chapterId, mode, from }: ChapterPaywallProps) {
  const { view, story, storyPending, managementUrl, retry } = usePaywallChapter(chapterId);
  const { running, message, restore } = usePurchase("paywall");
  const status = view.status;
  const navigation = useNavigation();
  // Set just before the sheet gives way to M10 or to the chapter, so only a
  // close counts as dismissed.
  const leaving = useRef(false);

  // Open after all, on arrival or once a subscription, an unlock or a
  // restore lands: the chapter replaces the sheet, once.
  const opened = useRef(false);
  useEffect(() => {
    if (status !== "open" || opened.current) return;
    opened.current = true;
    leaving.current = true;
    openUnlockedChapter(chapterId, mode, from);
  }, [status, chapterId, mode, from]);

  // Once per open, when the sheet first shows a locked chapter.
  const bookId = view.status === "locked" ? view.chapter.bookId : null;
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    if (bookId === null || from === null || shownAt.current !== null) return;
    shownAt.current = Date.now();
    track("paywall_shown", { book_id: bookId, chapter_id: chapterId, from });
  }, [bookId, chapterId, from]);

  // "Not now", the scrim, Android back: anything that removes the sheet
  // without its plans or its chapter.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", () => {
        const at = shownAt.current;
        if (leaving.current || at === null || bookId === null || from === null) return;
        leaving.current = true;
        const seconds = Math.round((Date.now() - at) / 1000);
        track("paywall_dismissed", { book_id: bookId, chapter_id: chapterId, from, seconds });
      }),
    [navigation, bookId, chapterId, from],
  );

  if (view.status === "loading" || view.status === "open") return <SheetSkeleton />;
  if (view.status !== "locked") return <SheetMessage status={view.status} onRetry={retry} />;

  const lines = paywallLines(mode, story?.title ?? null, view.chapter);

  // The sheet gives way to M10, carrying the chapter and its book, so a
  // purchase returns to it, analytics knows which story sold, and back from
  // M10 returns where the sheet was opened.
  const seePlans = () => {
    leaving.current = true;
    router.replace({
      pathname: "/subscription",
      params: { chapterId, bookId: view.chapter.bookId, mode, ...(from ? { from } : {}) },
    });
  };

  return (
    <>
      {/* Decorative: the headline names the story. A box of the cover's
          shape until the story is known, and where it has no cover. */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Cover source={story?.coverUrl ? { uri: story.coverUrl } : null} width={72} />
      </View>
      {storyPending ? (
        <View className="mt-5 h-6 w-3/5 rounded-pill bg-surface" />
      ) : (
        <Text
          accessibilityRole="header"
          className="text-heading mt-4 text-center text-[22px] leading-7"
          maxFontSizeMultiplier={1.3}
        >
          {lines.headline}
        </Text>
      )}
      <View accessible accessibilityLabel={lines.chapterSpoken} className="mt-2 flex-row items-center justify-center gap-1.5">
        <Ionicons name="lock-closed" size={14} color={colors.muted} />
        <Text className="font-ui text-muted shrink text-[15px] leading-[22px]" numberOfLines={2} maxFontSizeMultiplier={1.5}>
          {lines.chapter}
        </Text>
      </View>

      <View accessibilityRole="list" className="mt-5 gap-3 self-stretch">
        {BENEFITS.map((benefit) => (
          <View key={benefit.text} className="flex-row items-center gap-3">
            <Ionicons name={benefit.icon} size={18} color={colors.teal} />
            <Text className="font-ui text-body flex-1 text-[15px] leading-[22px]" maxFontSizeMultiplier={1.5}>
              {benefit.text}
            </Text>
          </View>
        ))}
      </View>

      {/* TODO(unlocks): prompt 23's "Unlock free" and "Watch ad & continue"
          join here; the owner then decides which one is the ember. */}

      {/* The sheet's one ember action. */}
      <Button
        label="See plans"
        accessibilityLabel={`See plans. Opens the ${PLAN_NAME} plans.`}
        onPress={seePlans}
        className="mt-6 h-12 self-stretch"
      />

      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-ui text-body mt-4 text-center text-sm leading-5"
          maxFontSizeMultiplier={1.5}
        >
          {message}
        </Text>
      ) : null}

      {/* A visible way out: the free chapters stay free without a plan.
          Restore needs Google Play: not in the web preview or Expo Go. */}
      <View className="mt-2 flex-row flex-wrap items-center justify-center">
        <TextLink label="Not now" onPress={close} />
        {billingAvailable() ? (
          <TextLink
            label={running === "restore" ? "Restoring…" : "Restore purchases"}
            accessibilityState={{ disabled: running !== null, busy: running === "restore" }}
            disabled={running !== null}
            onPress={() => void restore()}
          />
        ) : null}
        {managementUrl ? (
          <TextLink label="Manage subscription" onPress={() => Linking.openURL(managementUrl).catch(() => {})} />
        ) : null}
      </View>
    </>
  );
}

/** Loading: the locked sheet's shape (cover, headline, chapter, benefits), never a spinner. */
function SheetSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading chapter"
      accessibilityState={{ busy: true }}
      className="items-center self-stretch pb-6"
    >
      <Cover source={null} width={72} />
      <View className="mt-5 h-6 w-3/5 rounded-pill bg-surface" />
      <View className="mt-3 h-4 w-2/5 rounded-pill bg-surface" />
      <View className="mt-6 h-4 w-4/5 self-start rounded-pill bg-surface" />
      <View className="mt-3 h-4 w-3/5 self-start rounded-pill bg-surface" />
      <View className="mt-3 h-4 w-3/4 self-start rounded-pill bg-surface" />
    </View>
  );
}

type SheetMessageProps = {
  status: Exclude<PaywallView["status"], "locked" | "open" | "loading">;
  onRetry: () => void;
};

/** Failed (Retry), offline and not available (Back). The copy matches M5's. */
function SheetMessage({ status, onRetry }: SheetMessageProps) {
  const text =
    status === "failed"
      ? "We couldn't load this chapter."
      : status === "offline"
        ? "You're offline. Reconnect to see your options."
        : "This chapter isn't available.";

  return (
    <View className="items-center gap-3 self-stretch pb-2" accessibilityLiveRegion="polite">
      <Ionicons
        name={status === "offline" ? "cloud-offline-outline" : status === "failed" ? "alert-circle-outline" : "book-outline"}
        size={32}
        color={colors.muted}
      />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {text}
      </Text>
      {status === "failed" ? (
        <Button label="Retry" variant="outlined" onPress={onRetry} className="mt-2" />
      ) : (
        <Button label="Go back" variant="outlined" onPress={close} className="mt-2" />
      )}
    </View>
  );
}
