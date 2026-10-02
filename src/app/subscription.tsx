import { Ionicons } from "@expo/vector-icons";
import * as Application from "expo-application";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { PlanCard, PlanCardsSkeleton } from "@/components/subscription/plan-card";
import {
  PlanStatusCard,
  PlanStatusCardSkeleton,
  type PlanStatus,
} from "@/components/subscription/plan-status-card";
import { Button, Screen, TextLink } from "@/components/ui";
import { LEGAL_URLS } from "@/constants/legal";
import { PLAN_NAME } from "@/constants/plan";
import { usePlans, type PlansStatus } from "@/hooks/use-plans";
import { usePurchase } from "@/hooks/use-purchase";
import { track } from "@/lib/analytics";
import {
  defaultPlan,
  playSubscriptionsUrl,
  productToReplace,
  renewalLine,
  type Entitlement,
  type Plan,
} from "@/lib/billing";
import { isUuid } from "@/lib/ids";
import { isParityMode, isPaywallFrom, isSubscriptionFrom, openUnlockedChapter, type SubscriptionFrom } from "@/lib/paywall";
import { billingUnavailableLine, inAndroidApp } from "@/lib/revenuecat";
import { colors, layout } from "@/theme";

// M10 Subscription & Manage Plan — AGENTS.md M10, prompt 22 step 10,
// material/11.png ("Your plan", as a subscriber sees it).
//
// A pushed stack route outside (tabs): no tab bar, no mini player. From M9's
// bar and M11 it receives only where it was opened from (`source`); from M5a
// it receives the chapter tapped, its book and its mode, so a purchase or
// restore opens that chapter in its place, and back from it returns where the
// paywall was opened.
//
// A reader who doesn't subscribe gets a layout no frame draws (Decisions —
// 2026-10-01, "The paywall for a first visit"): "Choose a plan", a line
// saying what every plan gives, and Restore, Terms and Privacy as links, so
// nothing competes with Subscribe. A subscriber gets the frame's.
//
// Every price, plan, period, saving and date comes from RevenueCat
// (`hooks/use-plans.ts`, `lib/billing.ts`); the frame's are placeholder.

/** Google Play's name for this app, for its subscriptions page. */
const PACKAGE_NAME = Application.applicationId ?? "com.talebrim.app";

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function SubscriptionRoute() {
  const params = useLocalSearchParams<{
    chapterId?: string;
    bookId?: string;
    mode?: string;
    from?: string;
    source?: string;
  }>();
  const returnTo =
    isUuid(params.chapterId) && isParityMode(params.mode)
      ? {
          chapterId: params.chapterId,
          bookId: isUuid(params.bookId) ? params.bookId : null,
          mode: params.mode,
          from: isPaywallFrom(params.from) ? params.from : null,
        }
      : null;
  // Null for a hand-typed link: shown, but not counted.
  const openedFrom: SubscriptionFrom | null = returnTo
    ? "paywall"
    : isSubscriptionFrom(params.source)
      ? params.source
      : null;
  const storyBookId = returnTo?.bookId ?? null;
  const storyChapterId = returnTo?.chapterId ?? null;
  const story = useMemo(
    () => (storyBookId && storyChapterId ? { bookId: storyBookId, chapterId: storyChapterId } : null),
    [storyBookId, storyChapterId],
  );

  const { available, entitlement, plansStatus, plans, current, packageFor, retry } = usePlans();
  const { running, message, purchase, restore } = usePurchase("subscription", story);
  // The reader's pick; null follows `defaultPlan()`.
  const [pickedId, setPickedId] = useState<string | null>(null);

  const subscribed = entitlement.data?.active === true;
  const selected = plans.find((plan) => plan.id === pickedId) ?? defaultPlan(plans, current);
  const isCurrent = selected !== null && selected.id === current?.id;

  // Once per open, once it is known whether the reader subscribes.
  const known = entitlement.data !== undefined;
  const viewed = useRef(false);
  useEffect(() => {
    if (!known || openedFrom === null || viewed.current) return;
    viewed.current = true;
    track("subscription_viewed", {
      from: openedFrom,
      subscribed,
      ...(story ? { book_id: story.bookId, chapter_id: story.chapterId } : {}),
    });
  }, [known, openedFrom, subscribed, story]);

  function pick(plan: Plan) {
    if (plan.id === selected?.id) return;
    setPickedId(plan.id);
    track("plan_selected", { package_id: plan.id });
  }

  // Opened from M5a: the chapter replaces this screen. Otherwise the screen
  // stays and shows the subscriber layout, the new plan selected.
  function afterSuccess() {
    if (returnTo) openUnlockedChapter(returnTo.chapterId, returnTo.mode, returnTo.from);
    else setPickedId(null);
  }

  async function confirm() {
    if (selected === null || isCurrent) return;
    const pkg = packageFor(selected);
    if (pkg === null) return;
    // On Google Play a switch replaces the plan they are on (`productToReplace()`).
    const replacing = entitlement.data ? productToReplace(entitlement.data) : null;
    const outcome = await purchase(pkg, replacing);
    if (outcome?.kind === "success") afterSuccess();
  }

  async function restorePurchases() {
    const outcome = await restore();
    if (outcome?.kind === "success") afterSuccess();
  }

  const manageUrl =
    entitlement.data?.managementUrl ?? playSubscriptionsUrl(PACKAGE_NAME, entitlement.data?.productId ?? null);
  const openManage = () => Linking.openURL(manageUrl).catch(() => {});

  return (
    <Screen>
      <View className="h-14 flex-row items-center gap-2 px-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={goBack}
          // No className beside a `style` function (AGENTS.md § Style Exception Rules).
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.body} />
        </Pressable>
        <Text accessibilityRole="header" className="text-heading text-[26px] leading-8" maxFontSizeMultiplier={1.3}>
          {subscribed ? "Your plan" : "Choose a plan"}
        </Text>
      </View>

      {!available ? (
        <Unavailable />
      ) : (
        <ScrollView
          className="no-scrollbar"
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {entitlement.data === undefined ? (
            <EntitlementPending failed={entitlement.isError && !entitlement.isFetching} onRetry={retry} />
          ) : (
            <>
              {subscribed ? (
                plansStatus === "loading" ? (
                  <PlanStatusCardSkeleton />
                ) : (
                  <PlanStatusCard status={statusOf(entitlement.data, current)} />
                )
              ) : null}

              {subscribed ? (
                <Text accessibilityRole="header" className="text-heading mt-8 text-lg leading-6" maxFontSizeMultiplier={1.3}>
                  Switch plan
                </Text>
              ) : (
                // What every plan gives, and that leaving is easy: the screen's
                // title already says "Choose a plan".
                <Text className="font-ui text-body mt-2 text-[15px] leading-[22px]" maxFontSizeMultiplier={1.5}>
                  {`${PLAN_NAME} opens every locked chapter of every story. Cancel anytime in Google Play.`}
                </Text>
              )}

              <View className="mt-4">
                {plansStatus === "ready" ? (
                  <View accessibilityRole="radiogroup" className="gap-3">
                    {plans.map((plan) => (
                      <PlanCard
                        key={plan.id}
                        plan={plan}
                        selected={plan.id === selected?.id}
                        disabled={running !== null}
                        onSelect={pick}
                      />
                    ))}
                  </View>
                ) : plansStatus === "loading" ? (
                  <PlanCardsSkeleton />
                ) : (
                  <PlansMessage status={plansStatus} onRetry={retry} />
                )}
              </View>

              {message ? (
                <Text
                  accessibilityLiveRegion="polite"
                  className="font-ui text-body mt-6 text-center text-sm leading-5"
                  maxFontSizeMultiplier={1.5}
                >
                  {message}
                </Text>
              ) : null}

              {plansStatus === "ready" && selected !== null ? (
                <>
                  {/* The screen's one ember action. Its label and width hold while it runs. */}
                  <Button
                    label={subscribed ? "Confirm change" : "Subscribe"}
                    loading={running === "purchase"}
                    disabled={isCurrent || running !== null}
                    onPress={() => void confirm()}
                    className="mt-8 h-12"
                  />
                  {selected.renewal ? (
                    <Text
                      className="font-ui text-muted mt-3 text-center text-[13px] leading-[18px]"
                      maxFontSizeMultiplier={1.5}
                    >
                      {selected.renewal}
                    </Text>
                  ) : null}
                </>
              ) : null}

              {subscribed ? (
                <>
                  <Button
                    label="Restore purchase"
                    variant="accent"
                    accessibilityLabel="Restore purchase from your Google account"
                    loading={running === "restore"}
                    disabled={running !== null}
                    onPress={() => void restorePurchases()}
                    className="mt-6 h-12"
                  />
                  <Button label="Manage in Google Play" variant="accent" onPress={openManage} className="mt-3 h-12" />

                  {/* AGENTS.md M10 asks for it though the frame doesn't draw it.
                      Cancelling happens in Google Play. */}
                  {entitlement.data.willRenew ? (
                    <View className="mt-3 items-center">
                      <TextLink label="Cancel subscription" onPress={openManage} />
                    </View>
                  ) : null}

                  <View className="mt-4 flex-row flex-wrap justify-center">
                    <LegalLinks />
                  </View>
                </>
              ) : (
                // Links, so nothing competes with Subscribe. Google Play only
                // for a reader who has had a subscription: a lapsed one, or one
                // whose payment failed, fixes it there.
                <View className="mt-6 flex-row flex-wrap justify-center">
                  <TextLink
                    label={running === "restore" ? "Restoring…" : "Restore purchase"}
                    accessibilityLabel="Restore purchase from your Google account"
                    accessibilityState={{ disabled: running !== null, busy: running === "restore" }}
                    disabled={running !== null}
                    onPress={() => void restorePurchases()}
                  />
                  {entitlement.data.managementUrl ? (
                    <TextLink label="Manage in Google Play" onPress={openManage} />
                  ) : null}
                  <LegalLinks />
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </Screen>
  );
}

/**
 * The status card. Its title is the store's, from the offering; offline, or
 * for a plan no longer offered, the plan's name stands in.
 */
function statusOf(entitlement: Entitlement, current: Plan | null): PlanStatus {
  return {
    title: current?.title ?? PLAN_NAME,
    renewal: renewalLine(entitlement, current),
    billedByPlay: entitlement.store === "PLAY_STORE",
  };
}

/**
 * Where billing can't run. In the Android app (no key yet, or a store build
 * that refused a test key) the plan is "coming soon"; on the web preview and
 * in Expo Go it lives in the Android app (`billingUnavailableLine()`).
 */
function Unavailable() {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8">
      <Ionicons name={inAndroidApp() ? "time-outline" : "phone-portrait-outline"} size={32} color={colors.muted} />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {billingUnavailableLine()}
      </Text>
    </View>
  );
}

/** The entitlement is still loading, or failed: the whole screen waits on it. */
function EntitlementPending({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) {
    return (
      <View className="gap-8">
        <PlanStatusCardSkeleton />
        <PlanCardsSkeleton />
      </View>
    );
  }
  return <PlansMessage status="failed" onRetry={onRetry} />;
}

/** Failed (Retry) and offline (none: the plans load on reconnect). Never empty cards. */
function PlansMessage({ status, onRetry }: { status: Exclude<PlansStatus, "ready" | "loading">; onRetry: () => void }) {
  return (
    <View className="items-center gap-3 rounded-card border border-raised bg-surface px-6 py-8" accessibilityLiveRegion="polite">
      <Ionicons
        name={status === "offline" ? "cloud-offline-outline" : "alert-circle-outline"}
        size={28}
        color={colors.muted}
      />
      <Text className="font-ui text-body text-center text-base" maxFontSizeMultiplier={1.5}>
        {status === "offline" ? "You're offline." : "We couldn't load the plans."}
      </Text>
      <Text className="font-ui text-muted text-center text-sm" maxFontSizeMultiplier={1.5}>
        {status === "offline" ? "The plans will load when you reconnect." : "Check your connection and try again."}
      </Text>
      {status === "failed" ? <Button label="Retry" variant="outlined" onPress={onRetry} className="mt-2" /> : null}
    </View>
  );
}

/**
 * Terms and Privacy, each only once its URL exists (`constants/legal.ts`), as
 * links for the caller's row.
 */
function LegalLinks() {
  const links = [
    { label: "Terms of Service", url: LEGAL_URLS.terms },
    { label: "Privacy Policy", url: LEGAL_URLS.privacy },
  ].flatMap(({ label, url }) => (url === null ? [] : [{ label, url }]));

  return links.map((link) => (
    <TextLink key={link.label} label={link.label} onPress={() => Linking.openURL(link.url).catch(() => {})} />
  ));
}

const styles = StyleSheet.create({
  back: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
  },
});
