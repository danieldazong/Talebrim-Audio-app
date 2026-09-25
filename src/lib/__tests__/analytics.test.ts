/// <reference types="jest" />

import type * as Analytics from "@/lib/analytics";

// The one client (prompt 21a step 11): disabled without a key or in a server
// render, kept across a Fast Refresh, every event tagged with its environment
// and no location, identify and reset, and the handoff that waits for its
// destination.

type Options = {
  disabled?: boolean;
  before_send?: (event: { event: string; properties?: Record<string, unknown> } | null) => unknown;
  [option: string]: unknown;
};

const mockCreated: { key: string; options: Options }[] = [];
const mockClient = {
  capture: jest.fn(),
  screen: jest.fn(() => Promise.resolve()),
  identify: jest.fn(),
  reset: jest.fn(),
  optIn: jest.fn(() => Promise.resolve()),
  optOut: jest.fn(() => Promise.resolve()),
  optedOut: false,
};

jest.mock("posthog-react-native", () => ({
  __esModule: true,
  default: jest.fn((key: string, options: Options) => {
    mockCreated.push({ key, options });
    return mockClient;
  }),
  PostHogPersistedProperty: {
    InstalledAppBuild: "installed_app_build",
    InstalledAppVersion: "installed_app_version",
    DeviceId: "device_id",
    OptedOut: "opted_out",
  },
}));

const CHAPTER = "0b5f3a52-7c1e-4d7a-9a57-3f1c2b8d9e10";
const OTHER_CHAPTER = "6a0e2f4c-1b3d-4e5f-8a9b-0c1d2e3f4a5b";
const originalKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;

/** Where the module keeps its one client across a Fast Refresh. */
const shared = globalThis as { __talebrimAnalytics?: unknown; window?: unknown };

/** The module run again, as a Fast Refresh runs it. */
function rerun(): typeof Analytics {
  let analytics: typeof Analytics | undefined;
  jest.isolateModules(() => {
    analytics = jest.requireActual<typeof Analytics>("@/lib/analytics");
  });
  if (analytics === undefined) throw new Error("not loaded");
  return analytics;
}

/** A fresh copy of the module, with a new client created with `key` (or none). */
function load(key: string | undefined): { analytics: typeof Analytics; options: Options } {
  if (key === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  else process.env.EXPO_PUBLIC_POSTHOG_KEY = key;
  delete shared.__talebrimAnalytics;
  const analytics = rerun();
  const created = mockCreated.at(-1);
  if (created === undefined) throw new Error("no client created");
  return { analytics, options: created.options };
}

beforeEach(() => {
  mockCreated.length = 0;
  jest.clearAllMocks();
});

afterAll(() => {
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  else process.env.EXPO_PUBLIC_POSTHOG_KEY = originalKey;
});

describe("the client", () => {
  it("is disabled without a key, so every call is a no-op", () => {
    expect(load(undefined).options.disabled).toBe(true);
    expect(load("").options.disabled).toBe(true);
  });

  it("is enabled with a key, with explicit events only and no flags", () => {
    const { options } = load("phc_test");
    expect(mockCreated[0].key).toBe("phc_test");
    expect(options).toMatchObject({
      disabled: false,
      captureAppLifecycleEvents: true,
      enableSessionReplay: false,
      preloadFeatureFlags: false,
      sendFeatureFlagEvent: false,
      disableRemoteFeatureFlags: true,
      personProfiles: "identified_only",
    });
  });

  it("is disabled in the web build's server render, where there is no window", () => {
    const savedWindow = shared.window;
    delete shared.window;
    try {
      expect(load("phc_test").options.disabled).toBe(true);
    } finally {
      shared.window = savedWindow;
    }
  });

  it("is created once, and a Fast Refresh reuses it", () => {
    const { analytics } = load("phc_test");
    const again = rerun();
    expect(mockCreated).toHaveLength(1);

    analytics.track("hero_swiped", {});
    again.track("hero_swiped", {});
    expect(mockClient.capture).toHaveBeenCalledTimes(2);
  });

  it("tags every event with its environment and no location, and drops the launch link", () => {
    const { options } = load("phc_test");
    const beforeSend = options.before_send;
    if (beforeSend === undefined) throw new Error("no before_send");

    // Jest runs as a development build.
    expect(beforeSend({ event: "chapter_opened", properties: { chapter_id: CHAPTER } })).toEqual({
      event: "chapter_opened",
      properties: { chapter_id: CHAPTER, environment: "development", $geoip_disable: true },
    });
    expect(
      beforeSend({ event: "Application Opened", properties: { url: "talebrimapp://sso-callback?nonce=x" } }),
    ).toEqual({ event: "Application Opened", properties: { environment: "development", $geoip_disable: true } });
    expect(beforeSend({ event: "$identify" })).toEqual({
      event: "$identify",
      properties: { environment: "development", $geoip_disable: true },
    });
    // An event can't switch the location back on.
    expect(beforeSend({ event: "$screen", properties: { $geoip_disable: false } })).toEqual({
      event: "$screen",
      properties: { environment: "development", $geoip_disable: true },
    });
    expect(beforeSend(null)).toBeNull();
  });
});

describe("identity", () => {
  it("identifies the reader by Clerk user id alone, with no person properties", () => {
    const { analytics } = load("phc_test");
    analytics.identifyReader("user_a");
    expect(mockClient.identify).toHaveBeenCalledTimes(1);
    expect(mockClient.identify).toHaveBeenCalledWith("user_a");
  });

  it("resets at sign-out, keeping the opt-out and PostHog's own install markers", () => {
    const { analytics } = load("phc_test");
    analytics.resetAnalytics();
    expect(mockClient.reset).toHaveBeenCalledWith([
      "installed_app_build",
      "installed_app_version",
      "device_id",
      "opted_out",
    ]);
  });
});

describe("the handoff", () => {
  it("is sent when the destination opens, with how it mapped the place", () => {
    const { analytics } = load("phc_test");
    analytics.trackHandoffStart("read_to_listen", CHAPTER);
    analytics.trackHandoffLanded(CHAPTER, "audio", "estimate");
    expect(mockClient.capture).toHaveBeenCalledWith("handoff", { direction: "read_to_listen", mapped: "estimate" });

    analytics.trackHandoffStart("listen_to_read", CHAPTER);
    analytics.trackHandoffLanded(CHAPTER, "text", null);
    expect(mockClient.capture).toHaveBeenLastCalledWith("handoff", { direction: "listen_to_read", mapped: "none" });
    expect(mockClient.capture).toHaveBeenCalledTimes(2);
  });

  it("is dropped by any other open, and never counted by a later one", () => {
    const { analytics } = load("phc_test");
    analytics.trackHandoffStart("read_to_listen", CHAPTER);
    analytics.trackHandoffLanded(OTHER_CHAPTER, "audio", null);
    analytics.trackHandoffLanded(CHAPTER, "audio", null);

    analytics.trackHandoffStart("read_to_listen", CHAPTER);
    // The reader again, not the player it was headed for.
    analytics.trackHandoffLanded(CHAPTER, "text", null);
    analytics.trackHandoffLanded(CHAPTER, "audio", null);
    expect(mockClient.capture).not.toHaveBeenCalled();
  });

  it("is dropped at sign-out", () => {
    const { analytics } = load("phc_test");
    analytics.trackHandoffStart("listen_to_read", CHAPTER);
    analytics.resetAnalytics();
    analytics.trackHandoffLanded(CHAPTER, "text", "estimate");
    expect(mockClient.capture).not.toHaveBeenCalled();
  });

  it("no longer counts after a minute", () => {
    const { analytics } = load("phc_test");
    const now = jest.spyOn(Date, "now").mockReturnValue(1_000_000);
    analytics.trackHandoffStart("read_to_listen", CHAPTER);
    now.mockReturnValue(1_000_000 + 60_001);
    analytics.trackHandoffLanded(CHAPTER, "audio", "estimate");
    now.mockRestore();
    expect(mockClient.capture).not.toHaveBeenCalled();
  });
});

describe("screenFromRoute", () => {
  it("keeps dynamic segments as written, and sends their ids in snake_case", () => {
    const { analytics } = load(undefined);
    expect(analytics.screenFromRoute(["reader", "[chapterId]"], { chapterId: CHAPTER })).toEqual({
      name: "/reader/[chapterId]",
      properties: { chapter_id: CHAPTER },
    });
    expect(analytics.screenFromRoute(["book", "[id]"], { id: CHAPTER })).toEqual({
      name: "/book/[id]",
      properties: { id: CHAPTER },
    });
    expect(analytics.screenFromRoute(["(tabs)", "library"], {})).toEqual({
      name: "/(tabs)/library",
      properties: {},
    });
  });

  it("never sends a parameter that isn't an id", () => {
    const { analytics } = load(undefined);
    // A hand-typed link, and M6's `play` flag.
    expect(analytics.screenFromRoute(["reader", "[chapterId]"], { chapterId: "a secret note" })).toEqual({
      name: "/reader/[chapterId]",
      properties: {},
    });
    expect(analytics.screenFromRoute(["player", "[chapterId]"], { chapterId: CHAPTER, play: "1" })).toEqual({
      name: "/player/[chapterId]",
      properties: { chapter_id: CHAPTER },
    });
    expect(analytics.screenFromRoute(["search"], { q: "werewolf" })).toEqual({ name: "/search", properties: {} });
  });
});
