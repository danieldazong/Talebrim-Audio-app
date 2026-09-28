import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef } from "react";
import { Linking, Text, View } from "react-native";

import { Button, Sheet, TextLink } from "@/components/ui";
import { usePaywallChapter, type PaywallChapter, type PaywallView } from "@/hooks/use-paywall-chapter";
import { usePurchase } from "@/hooks/use-purchase";
import { track } from "@/lib/analytics";
import { isUuid } from "@/lib/ids";
import { isParityMode, isPaywallFrom, openUnlockedChapter, type PaywallFrom } from "@/lib/paywall";
import { billingAvailable } from "@/lib/revenuecat";
import type { ParitySourceMode } from "@/store/parity-store";
import { colors } from "@/theme";

// M5a, the paywall sheet — AGENTS.md M5a, prompt 22 step 9. No frame draws it.
//
// A transparent modal over whatever opened it, receiving the chapter, the
// `mode` the tap was going to (the reader for "text", the player for
// "audio") and where it came from (`lib/paywall.ts`). A scrim, and the sheet
// on `raised`. Tapping the scrim or Android back closes it.
//
// Never shown for a chapter that isn't locked: a chapter that turns out open
// (a subscription, an unlock, a restore) replaces the sheet with that
// chapter, in its mode.
//
// No ember element until prompt 23: its two ember actions have nothing
// behind them yet.

/** The ad-free value proposition, stated before any purchase (AGENTS.md M5a). */
const VALUE_PROPOSITION = "Go Ad-Free to open every chapter of every story, with no ads.";

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function headline(chapter: PaywallChapter): string {
  return chapter.title ? `Chapter ${chapter.number}: ${chapter.title}` : `Chapter ${chapter.number}`;
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
  const { view, managementUrl, retry } = usePaywallChapter(chapterId);
  const { running, message, restore } = usePurchase("paywall");
  const status = view.status;

  // Open after all, on arrival or once a subscription, an unlock or a
  // restore lands: the chapter replaces the sheet, once.
  const opened = useRef(false);
  useEffect(() => {
    if (status !== "open" || opened.current) return;
    opened.current = true;
    openUnlockedChapter(chapterId, mode, from);
  }, [status, chapterId, mode, from]);

  // Once per open, when the sheet first shows a locked chapter.
  const bookId = view.status === "locked" ? view.chapter.bookId : null;
  const shown = useRef(false);
  useEffect(() => {
    if (bookId === null || from === null || shown.current) return;
    shown.current = true;
    track("paywall_shown", { book_id: bookId, chapter_id: chapterId, from });
  }, [bookId, chapterId, from]);

  if (view.status === "loading" || view.status === "open") return <SheetSkeleton />;
  if (view.status !== "locked") return <SheetMessage status={view.status} onRetry={retry} />;

  // The sheet gives way to M10, carrying the chapter, so a purchase returns
  // to it and back from M10 returns where the sheet was opened.
  const goAdFree = () =>
    router.replace({ pathname: "/subscription", params: { chapterId, mode, ...(from ? { from } : {}) } });

  return (
    <>
      <LockIcon />
      <Text
        accessibilityRole="header"
        className="text-heading mt-4 text-center text-[22px] leading-7"
        maxFontSizeMultiplier={1.3}
      >
        {headline(view.chapter)}
      </Text>
      <Text className="font-ui text-muted mt-2 text-center text-[15px] leading-[22px]" maxFontSizeMultiplier={1.5}>
        {VALUE_PROPOSITION}
      </Text>

      {/* TODO(unlocks): prompt 23's "Unlock free", the sheet's ember action
          while the reader's free unlock for this book is available. */}
      {/* TODO(unlocks): prompt 23's "Watch ad & continue", the ember action
          otherwise. */}

      <Button label="Go Ad-Free" variant="accent" onPress={goAdFree} className="mt-6 h-12 self-stretch" />

      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-ui text-body mt-4 text-center text-sm leading-5"
          maxFontSizeMultiplier={1.5}
        >
          {message}
        </Text>
      ) : null}

      {/* Restore needs Google Play: not in the web preview or Expo Go. */}
      <View className="mt-2 flex-row flex-wrap items-center justify-center">
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

function LockIcon() {
  return (
    <View className="h-14 w-14 items-center justify-center rounded-pill bg-surface">
      <Ionicons name="lock-closed" size={24} color={colors.champagne} />
    </View>
  );
}

/** Loading: the sheet's shape with a skeleton headline, never a spinner. */
function SheetSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading chapter"
      accessibilityState={{ busy: true }}
      className="items-center self-stretch pb-6"
    >
      <LockIcon />
      <View className="mt-5 h-6 w-3/5 rounded-pill bg-surface" />
      <View className="mt-4 h-4 w-4/5 rounded-pill bg-surface" />
      <View className="mt-2 h-4 w-1/2 rounded-pill bg-surface" />
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
