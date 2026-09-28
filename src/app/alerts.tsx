import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { Button, Sheet, TextLink } from "@/components/ui";
import { useAlertsSheet, type AlertsSheet } from "@/hooks/use-alerts";
import { isAlertsFrom } from "@/lib/alerts";
import { colors } from "@/theme";

// The alerts sheet — prompt 23a step 4. No frame draws it; it follows M5a's
// sheet (`app/paywall/[chapterId].tsx`) and AGENTS.md § Design System.
//
// A transparent modal over whatever opened it, with `from`: `my_list` when
// the app asks after the first My List add (once per account), `bell` from
// Discover's bell, which always opens it. On `raised`, from the top: the
// state's icon, its headline or line, and its actions. Tapping the scrim or
// Android back closes it; while it asks, that counts as "Not now".
//
// "Notify me" is the sheet's one ember action.

function close() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function AlertsRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>();
  // A hand-typed link is treated as the reader asking, as the bell is.
  const sheet = useAlertsSheet(isAlertsFrom(from) ? from : "bell", close);

  return (
    <Sheet onClose={close}>
      <AlertsContent {...sheet} />
    </Sheet>
  );
}

function AlertsContent({
  view,
  requesting,
  notifyMe,
  notNow,
  turnOff,
  openSettings,
}: AlertsSheet) {
  switch (view.status) {
    case "loading":
      return <SheetSkeleton />;
    case "off":
      return (
        <>
          <BellIcon />
          <Headline>Get notified when new chapters come out?</Headline>
          <Line>Alerts are only for the stories on your My List.</Line>
          <Button label="Notify me" loading={requesting} onPress={notifyMe} className="mt-6 h-12 self-stretch" />
          <View className="mt-2">
            <TextLink label="Not now" disabled={requesting} onPress={notNow} />
          </View>
        </>
      );
    case "on":
      return (
        <>
          <BellIcon />
          <Headline>New chapter alerts are on</Headline>
          <Line>We&apos;ll let you know when a story on your My List has new chapters.</Line>
          <Button label="Turn off" variant="outlined" onPress={turnOff} className="mt-6 h-12 self-stretch" />
        </>
      );
    case "blocked":
      return (
        <Message icon="notifications-off-outline" text="Notifications for Talebrim are turned off in Android's settings.">
          <Button label="Open settings" variant="outlined" onPress={openSettings} className="mt-2 h-12 self-stretch" />
        </Message>
      );
    case "unavailable":
      return (
        <Message icon="phone-portrait-outline" text="New chapter alerts work in the Talebrim app for Android.">
          <Button label="Close" variant="outlined" onPress={close} className="mt-2" />
        </Message>
      );
  }
}

function BellIcon() {
  return (
    <View className="h-14 w-14 items-center justify-center rounded-pill bg-surface">
      <Ionicons name="notifications" size={24} color={colors.champagne} />
    </View>
  );
}

function Headline({ children }: { children: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="text-heading mt-4 text-center text-[22px] leading-7"
      maxFontSizeMultiplier={1.3}
    >
      {children}
    </Text>
  );
}

function Line({ children }: { children: string }) {
  return (
    <Text className="font-ui text-muted mt-2 text-center text-[15px] leading-[22px]" maxFontSizeMultiplier={1.5}>
      {children}
    </Text>
  );
}

type MessageProps = {
  icon: "notifications-off-outline" | "phone-portrait-outline";
  text: string;
  children: React.ReactNode;
};

/** Blocked and unavailable: one line and one way on, as M5a's messages. */
function Message({ icon, text, children }: MessageProps) {
  return (
    <View className="items-center gap-3 self-stretch pb-2" accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {text}
      </Text>
      {children}
    </View>
  );
}

/** Loading: the sheet's shape with a skeleton headline, never a spinner. */
function SheetSkeleton() {
  return (
    <View
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      className="items-center self-stretch pb-6"
    >
      <BellIcon />
      <View className="mt-5 h-6 w-3/5 rounded-pill bg-surface" />
      <View className="mt-4 h-4 w-4/5 rounded-pill bg-surface" />
    </View>
  );
}
