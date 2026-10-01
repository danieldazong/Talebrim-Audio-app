import { useUser } from "@clerk/expo";
import * as Application from "expo-application";
import { router } from "expo-router";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { useState } from "react";
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { AccountCard, AccountCardSkeleton } from "@/components/profile/account-card";
import { SettingsGroup, SettingsHeading, SettingsRow } from "@/components/profile/settings-row";
import { UpsellCard } from "@/components/profile/upsell-card";
import { ReaderSettingsSheet } from "@/components/reader/reader-settings-sheet";
import { THEME_LABEL } from "@/components/reader/reader-theme";
import { Screen, TextLink } from "@/components/ui";
import { LEGAL_URLS } from "@/constants/legal";
import { useAlertsStatus } from "@/hooks/use-alerts";
import { useDeleteAccount } from "@/hooks/use-delete-account";
import { useDownloadEntries } from "@/hooks/use-downloads";
import { useEntitlement } from "@/hooks/use-entitlement";
import { usePurchase } from "@/hooks/use-purchase";
import { useSignOut } from "@/hooks/use-sign-out";
import { alertsStatusWords } from "@/lib/alerts";
import { isAnalyticsOptedOut, optInToAnalytics, optOutOfAnalytics, track } from "@/lib/analytics";
import { confirmDestructive } from "@/lib/confirm";
import {
  BILLING_UNAVAILABLE,
  RESTORE_SUCCEEDED,
  accountIdentity,
  planState,
  signOutMessage,
  versionLine,
} from "@/lib/profile";
import { billingAvailable } from "@/lib/revenuecat";
import { useReaderStore } from "@/store/reader-store";
import { layout } from "@/theme";

// M11 Profile & Settings — AGENTS.md M11, prompt 25, material/10.png (down
// to "Restore purchase"; the rest follows AGENTS.md § M11 and the prompt).
//
// A tab route: the tab shell draws the mini player and the tab bar below it.
// Nothing here waits on the network to render: the account card comes from
// Clerk, the rows from local slices. Pushed screens (M10, Downloads, the
// alerts sheet) come back here; the reading sheet is M5's own `Modal`.

const CHEVRON = { kind: "chevron" } as const;

function openLink(url: string) {
  Linking.openURL(url).catch(() => {});
}

export default function Profile() {
  const tabBarHeight = useBottomTabBarHeight();
  const { isLoaded, user } = useUser();
  const entitlement = useEntitlement();
  // As M10: a refetch after a failure shows the skeleton, not "failed".
  const plan = planState(entitlement.data, entitlement.isError && !entitlement.isFetching);

  return (
    // `edges=["top"]` only: the tab bar carries its own bottom inset, as on M7.
    <Screen edges={["top"]}>
      <ScrollView
        className="no-scrollbar"
        // The last line clears the mini player and the tab bar, as on M7.
        contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text accessibilityRole="header" className="text-heading text-[26px] leading-8" maxFontSizeMultiplier={1.3}>
          Profile
        </Text>

        <View className="mt-2">
          {isLoaded && user ? (
            <AccountCard
              identity={accountIdentity({
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.primaryEmailAddress?.emailAddress ?? null,
                imageUrl: user.imageUrl,
                hasImage: user.hasImage,
              })}
              plan={plan}
            />
          ) : (
            <AccountCardSkeleton />
          )}
        </View>

        {/* The screen's one ember action, once the reader is known not to
            subscribe: a subscriber's screen has none. */}
        {plan === "free" ? (
          <View className="mt-4">
            <UpsellCard onSeePlans={() => router.push("/subscription")} />
          </View>
        ) : null}

        <ReadingSection />
        <AccountSection />
        <SupportSection />
        <Footer />
      </ScrollView>
    </Screen>
  );
}

/**
 * Reading preferences, Font and Theme all open M5's own sheet, on the same
 * `reader` slice: a change shows in the reader at once, and the reader's
 * changes show here. The theme is the reader page's; the app stays dark.
 */
function ReadingSection() {
  const theme = useReaderStore((state) => state.theme);
  const fontSize = useReaderStore((state) => state.fontSize);
  const lineSpacing = useReaderStore((state) => state.lineSpacing);
  const atkinsonEnabled = useReaderStore((state) => state.atkinsonEnabled);
  const setTheme = useReaderStore((state) => state.setTheme);
  const setFontSize = useReaderStore((state) => state.setFontSize);
  const setLineSpacing = useReaderStore((state) => state.setLineSpacing);
  const setAtkinsonEnabled = useReaderStore((state) => state.setAtkinsonEnabled);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fontName = atkinsonEnabled ? "Atkinson Hyperlegible" : "Literata";
  const themeName = THEME_LABEL[theme];
  const openSheet = () => setSheetOpen(true);

  return (
    <>
      <SettingsHeading label="Reading" />
      <SettingsGroup>
        <SettingsRow
          icon="book-outline"
          label="Reading preferences"
          trailing={CHEVRON}
          onPress={openSheet}
          accessibilityLabel="Reading preferences. Opens reading settings."
        />
        {/* `Aa`, as M5's own way into this sheet: the frame's three lines read as a menu. */}
        <SettingsRow
          icon="text-outline"
          label={`Font: ${fontName}`}
          trailing={CHEVRON}
          onPress={openSheet}
          accessibilityLabel={`Font, ${fontName}. Opens reading settings.`}
        />
        <SettingsRow
          icon="moon-outline"
          label={`Theme: ${themeName}`}
          trailing={CHEVRON}
          onPress={openSheet}
          accessibilityLabel={`Theme, ${themeName}. Opens reading settings.`}
        />
        {/* Every platform: off Android, Downloads says they need the Android app. */}
        <SettingsRow
          icon="download-outline"
          label="Downloads & offline storage"
          trailing={CHEVRON}
          onPress={() => router.push("/downloads")}
          accessibilityLabel="Downloads and offline storage. Opens Downloads."
        />
      </SettingsGroup>

      <ReaderSettingsSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        theme={theme}
        fontSize={fontSize}
        lineSpacing={lineSpacing}
        atkinsonEnabled={atkinsonEnabled}
        onChangeTheme={setTheme}
        onChangeFontSize={setFontSize}
        onChangeLineSpacing={setLineSpacing}
        onChangeAtkinson={setAtkinsonEnabled}
      />
    </>
  );
}

/**
 * Manage subscription (M10), Restore purchase (the app's one restore path,
 * `usePurchase`), new-chapter alerts (the alerts sheet) and the analytics
 * opt-out. Restore's result is one line under the card.
 */
function AccountSection() {
  const { running, message, restore } = usePurchase("profile");
  const [restoreNote, setRestoreNote] = useState<string | null>(null);
  const alerts = useAlertsStatus();
  const alertsWords = alertsStatusWords(alerts.status);
  // PostHog keeps the opt-out on the device, so sign-out keeps it too.
  const [analyticsOn, setAnalyticsOn] = useState(() => !isAnalyticsOptedOut());

  async function restorePurchase() {
    if (!billingAvailable()) {
      setRestoreNote(BILLING_UNAVAILABLE);
      return;
    }
    setRestoreNote(null);
    const outcome = await restore();
    if (outcome?.kind === "success") setRestoreNote(RESTORE_SUCCEEDED);
  }

  function toggleAnalytics() {
    const next = !analyticsOn;
    setAnalyticsOn(next);
    (next ? optInToAnalytics() : optOutOfAnalytics()).catch(() => setAnalyticsOn(!next));
  }

  const restoreLine = restoreNote ?? message;

  return (
    <>
      <SettingsHeading label="Account" />
      <SettingsGroup>
        <SettingsRow
          icon="card-outline"
          label="Manage subscription"
          trailing={CHEVRON}
          onPress={() => router.push("/subscription")}
          accessibilityLabel="Manage subscription. Opens your plan."
        />
        <SettingsRow
          icon="sync-outline"
          label="Restore purchase"
          trailing={running === "restore" ? { kind: "spinner" } : CHEVRON}
          disabled={running !== null}
          onPress={() => void restorePurchase()}
          accessibilityLabel="Restore purchase from your Google account"
        />
        <SettingsRow
          icon="notifications-outline"
          label="New chapter alerts"
          detail={alertsWords || undefined}
          trailing={CHEVRON}
          onPress={() => router.push({ pathname: "/alerts", params: { from: "profile" } })}
          accessibilityLabel={`New chapter alerts${alertsWords ? `, ${alertsWords}` : ""}. Opens the alert settings.`}
        />
        <SettingsRow
          icon="analytics-outline"
          label="Usage analytics"
          detail="Helps us improve Talebrim."
          trailing={{ kind: "switch", value: analyticsOn }}
          onPress={toggleAnalytics}
          accessibilityLabel="Usage analytics"
          accessibilityHint="Helps us improve Talebrim."
        />
      </SettingsGroup>

      {restoreLine ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-ui text-body mt-3 px-1 text-sm leading-5"
          maxFontSizeMultiplier={1.5}
        >
          {restoreLine}
        </Text>
      ) : null}
    </>
  );
}

/**
 * Help: a message to support, written in the app (`app/support.tsx`), which
 * reaches support@talebrim.com by email. It needs no web page (the owner's
 * call, 2026-10-01).
 */
function SupportSection() {
  return (
    <>
      <SettingsHeading label="Support" />
      <SettingsGroup>
        <SettingsRow
          icon="help-circle-outline"
          label="Help"
          detail="Send us a message"
          trailing={CHEVRON}
          onPress={() => router.push("/support")}
          accessibilityLabel="Help. Opens a form to send us a message."
        />
      </SettingsGroup>
    </>
  );
}

/**
 * Sign out and Delete account, the legal links once they exist, the
 * installed version, and in development the health probe, which holds the
 * clear-storage button. Never in a release build.
 */
function Footer() {
  const signOut = useSignOut();
  const downloads = useDownloadEntries();
  const deletion = useDeleteAccount();
  const [signingOut, setSigningOut] = useState(false);
  const busy = signingOut || deletion.deleting;

  // The app's only sign-out path. It records and flushes first, signs out
  // of Clerk, then clears the phone: downloads included, so it says so.
  function confirmSignOut() {
    if (busy) return;
    confirmDestructive({
      title: "Sign out?",
      message: signOutMessage(downloads.length),
      action: "Sign out",
      onConfirm: () => {
        setSigningOut(true);
        track("signed_out", {});
        signOut().catch(() => setSigningOut(false));
      },
    });
  }

  const version = versionLine(Platform.OS, Application.nativeApplicationVersion, Application.nativeBuildVersion);
  const legal = [
    { label: "Terms of Service", url: LEGAL_URLS.terms },
    { label: "Privacy Policy", url: LEGAL_URLS.privacy },
  ].flatMap(({ label, url }) => (url === null ? [] : [{ label, url }]));

  return (
    <View className="mt-8 items-center">
      <TextLink
        tone="destructive"
        label={signingOut ? "Signing out…" : "Sign out"}
        accessibilityHint="Signs you out of Talebrim on this phone. Asks first."
        accessibilityState={{ disabled: busy, busy: signingOut }}
        disabled={busy}
        onPress={confirmSignOut}
      />
      <TextLink
        tone="destructive"
        label={deletion.deleting ? "Deleting…" : "Delete account"}
        accessibilityHint="Deletes your Talebrim account and everything saved to it. Asks first."
        accessibilityState={{ disabled: busy, busy: deletion.deleting }}
        disabled={busy}
        onPress={deletion.confirmDelete}
      />
      {deletion.message ? (
        <Text
          accessibilityLiveRegion="polite"
          className="font-ui text-body px-4 text-center text-sm leading-5"
          maxFontSizeMultiplier={1.5}
        >
          {deletion.message}
        </Text>
      ) : null}

      {legal.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap justify-center">
          {legal.map((link) => (
            <TextLink key={link.label} label={link.label} onPress={() => openLink(link.url)} />
          ))}
        </View>
      ) : null}

      {version ? (
        <Text className="font-ui text-muted mt-4 text-[13px] leading-[18px]" maxFontSizeMultiplier={1.3}>
          {version}
        </Text>
      ) : null}

      {__DEV__ ? (
        <View className="mt-2">
          <TextLink label="Development: health probe" onPress={() => router.push("/health")} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
  },
});
