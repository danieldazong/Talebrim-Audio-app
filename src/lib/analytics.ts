// Product analytics — prompt 21a. PostHog, explicit events only.
// No React, no hooks, no JSX (AGENTS.md § lib/).
//
// One plain client, never `PostHogProvider`: the provider is where
// autocapture and navigation tracking live, and this app sends only the
// events named below. Every property is an id, a number or a fixed word:
// never a title, chapter text, a search term, an email or a name.
//
// Without `EXPO_PUBLIC_POSTHOG_KEY` the client is created disabled and every
// call is a no-op, so tests and a fresh clone run without it. Offline, events
// wait in PostHog's own persisted queue (at most 1000, the oldest dropped
// first) and go with the next flush once the network is back.
import PostHog, { PostHogPersistedProperty, type PostHogOptions } from "posthog-react-native";

import { isUuid } from "@/lib/ids";
import type { RestorePoint } from "@/lib/parity/convert";
import type { ParitySourceMode } from "@/store/parity-store";

type HandoffDirection = "read_to_listen" | "listen_to_read";

/** Every event this app sends, and its properties. */
type AnalyticsEvents = {
  /** M5 or M6 reached its ready state for a chapter, once per open. */
  chapter_opened: { book_id: string; chapter_id: string; number: number; mode: ParitySourceMode };
  /** Text: M5's position reached 95%, once per open. Audio: the player's `didJustFinish`. */
  chapter_finished: { book_id: string; chapter_id: string; mode: ParitySourceMode };
  /** The Continue card's resume button, and the mode it opened. */
  continue_resumed: { from: "discover" | "library"; mode: ParitySourceMode };
  /** Once the server confirms, never at the optimistic change. */
  my_list_added: { book_id: string };
  my_list_removed: { book_id: string };
  /** `position` is the carousel page, from 1. */
  hero_opened: { book_id: string; position: number };
  hero_swiped: Record<string, never>;
  /** Never the search text. */
  search_performed: { result_count: number };
  /** How the destination found its place: mapped from the other mode, or its own ("none"). */
  handoff: { direction: HandoffDirection; mapped: "estimate" | "chapter-start" | "none" };
};

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? "";

/** Every insight filters on `environment = production`: the Free plan's one project holds testing too. */
const ENVIRONMENT = __DEV__ ? "development" : "production";

/**
 * How long a handoff may take to land before it no longer counts. The
 * destination normally opens within a second; one that failed and was left
 * must not claim a later, unrelated open.
 */
const HANDOFF_WINDOW_MS = 60_000;

type BeforeSend = Extract<NonNullable<PostHogOptions["before_send"]>, (event: never) => unknown>;
type OutgoingEvent = Parameters<BeforeSend>[0];

/**
 * Runs on every event, PostHog's own included. Adds `environment` here
 * rather than as a super property: `reset()` clears super properties at
 * every sign-out, and the first launch's Application Installed is captured
 * before a `register()` could land. Drops `url`, the launch link that
 * Application Opened carries, which could be a sign-in callback.
 *
 * `$geoip_disable` keeps the reader's location out of PostHog: no city,
 * postal code, coordinates or country, on the event or the person. The
 * project also discards the IP address ("Discard client IP data"), but its
 * GeoIP step reads the IP before that, so the setting alone kept the
 * location (owner's decision, 2026-09-25).
 */
function beforeSend(event: OutgoingEvent): OutgoingEvent {
  if (event === null) return null;
  const { url: _launchUrl, ...properties } = event.properties ?? {};
  return { ...event, properties: { ...properties, environment: ENVIRONMENT, $geoip_disable: true } };
}

/**
 * The web build renders every page in Node first (`web.output: "static"`),
 * where there is no `window`. A client there sent Application Opened for each
 * render, each under a new anonymous id: 217 of the first 223 (2026-09-25).
 */
const isServerRender = typeof window === "undefined";

function createClient(): PostHog {
  return new PostHog(KEY, {
    host: process.env.EXPO_PUBLIC_POSTHOG_HOST,
    disabled: KEY.length === 0 || isServerRender,
    // Application Opened, Became Active and Backgrounded: what retention is built on.
    captureAppLifecycleEvents: true,
    enableSessionReplay: false,
    // No feature flags in this app, so no flags request: not at launch, and
    // not at the identify and reset that would otherwise reload them.
    preloadFeatureFlags: false,
    sendFeatureFlagEvent: false,
    disableRemoteFeatureFlags: true,
    personProfiles: "identified_only",
    before_send: beforeSend,
  });
}

/**
 * Kept on `globalThis`, so a Fast Refresh that runs this module again reuses
 * the one client. PostHog never removes the AppState listener it adds, so a
 * second client sent every lifecycle event twice, and events it sent had no
 * screen (2026-09-25). A change to the options above needs a full reload.
 */
const shared = globalThis as typeof globalThis & { __talebrimAnalytics?: PostHog };
const client = (shared.__talebrimAnalytics ??= createClient());

// Development only, and only when asked for: PostHog's own log in the Metro
// terminal, every event as it is captured and every batch as it is sent or
// fails. `EXPO_PUBLIC_POSTHOG_DEBUG=1` in `.env.local`, then `npx expo start -c`.
if (__DEV__ && process.env.EXPO_PUBLIC_POSTHOG_DEBUG === "1") client.debug();

/** A handoff on its way to the other screen (`trackHandoffStart()`). */
let pendingHandoff: { direction: HandoffDirection; chapterId: string; startedAt: number } | null = null;

/** Sends one event. Never waits: PostHog queues it and sends it in the background. */
export function track<E extends keyof AnalyticsEvents>(event: E, properties: AnalyticsEvents[E]): void {
  client.capture(event, properties);
}

export type TrackedScreen = { name: string; properties: Record<string, string> };

/**
 * A screen's name from Expo Router's segments, with its dynamic segments kept
 * as written ("/reader/[chapterId]", "/(tabs)/library"), and their values as
 * snake_case properties ("chapter_id"). Only an id is sent: a hand-typed
 * link's text never is, and neither is any other parameter.
 */
export function screenFromRoute(
  segments: readonly string[],
  params: Readonly<Record<string, string | string[] | undefined>>,
): TrackedScreen {
  const properties: Record<string, string> = {};
  for (const segment of segments) {
    const param = /^\[(\w+)\]$/.exec(segment)?.[1];
    if (param === undefined) continue;
    const value = params[param];
    if (isUuid(value)) properties[param.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)] = value;
  }
  return { name: `/${segments.join("/")}`, properties };
}

/** One per route change, from the root layout (`hooks/use-screen-tracking.ts`). */
export function trackScreen({ name, properties }: TrackedScreen): void {
  void client.screen(name, properties);
}

/**
 * M5's Listen and M6's Read instead, as they navigate. How the place was
 * mapped is only known where the handoff lands, so the event waits for the
 * destination's `trackHandoffLanded()`, as the place itself waits in the
 * parity slice.
 */
export function trackHandoffStart(direction: HandoffDirection, chapterId: string): void {
  pendingHandoff = { direction, chapterId, startedAt: Date.now() };
}

/**
 * M5 and M6, as their ready state opens, with the `mapped` their notice
 * shows. Sends the handoff waiting for this chapter in this mode. Any open
 * ends the wait, so a handoff that never landed is never counted later.
 */
export function trackHandoffLanded(chapterId: string, mode: ParitySourceMode, mapped: RestorePoint["mapped"]): void {
  const handoff = pendingHandoff;
  pendingHandoff = null;
  if (handoff === null || handoff.chapterId !== chapterId) return;
  if ((handoff.direction === "read_to_listen" ? "audio" : "text") !== mode) return;
  if (Date.now() - handoff.startedAt > HANDOFF_WINDOW_MS) return;
  track("handoff", { direction: handoff.direction, mapped: mapped ?? "none" });
}

/**
 * The signed-in reader, by Clerk user id: the id RevenueCat and every reader
 * table use. No person properties. Calling it again with the same id sends
 * nothing.
 */
export function identifyReader(userId: string): void {
  client.identify(userId);
}

/**
 * Sign-out, from `clearUserScopedState()`: the next account on this device
 * starts with a new anonymous id. The opt-out survives it, as the other
 * device-level choices do: signing out must never switch analytics back on.
 */
export function resetAnalytics(): void {
  pendingHandoff = null;
  client.reset([
    // PostHog's own defaults, which passing a list replaces.
    PostHogPersistedProperty.InstalledAppBuild,
    PostHogPersistedProperty.InstalledAppVersion,
    PostHogPersistedProperty.DeviceId,
    PostHogPersistedProperty.OptedOut,
  ]);
}

/** For M11's Analytics switch (prompt 25). Persisted by PostHog, on this device. */
export function optOutOfAnalytics(): Promise<void> {
  return client.optOut();
}

export function optInToAnalytics(): Promise<void> {
  return client.optIn();
}

export function isAnalyticsOptedOut(): boolean {
  return client.optedOut;
}
