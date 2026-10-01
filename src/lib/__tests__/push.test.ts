/// <reference types="jest" />

// New-chapter alerts' token handling (2026-10-01). The fake below behaves as
// `expo-notifications` 57.0.21 does on Android: every fetch of the device
// token also reports it to the token listeners. Before the fix, that report
// set off the sync again, and offline it never stopped: 33,794 attempts in
// 12 minutes on the owner's phone.

type DeviceToken = { type: "android"; data: string };
type TokenListener = (token: DeviceToken) => void;

const mockListeners = new Set<TokenListener>();
const mockPhone = {
  online: false,
  device: "fcm-token-1",
  /** The report arrives before the fetch's own answer, rather than after. */
  reportFirst: false,
};

function mockReport(token: DeviceToken) {
  for (const listener of [...mockListeners]) listener(token);
}

/** As the native module does: answer, then report the same token. */
async function mockFetchDeviceToken(): Promise<DeviceToken> {
  const token: DeviceToken = { type: "android", data: mockPhone.device };
  if (mockPhone.reportFirst) mockReport(token);
  else setTimeout(() => mockReport(token), 0);
  return token;
}

const mockNotifications = {
  setNotificationHandler: jest.fn(),
  addPushTokenListener: jest.fn((listener: TokenListener) => {
    mockListeners.add(listener);
    return { remove: () => mockListeners.delete(listener) };
  }),
  getDevicePushTokenAsync: jest.fn(mockFetchDeviceToken),
  // Fetches the device token itself unless it is handed one, as 57.0.21 does.
  getExpoPushTokenAsync: jest.fn(async (options?: { devicePushToken?: DeviceToken }) => {
    const device = options?.devicePushToken ?? (await mockFetchDeviceToken());
    if (!mockPhone.online) throw new Error('Unable to resolve host "exp.host"');
    return { type: "expo", data: `ExponentPushToken[${device.data}]` };
  }),
  setNotificationChannelAsync: jest.fn(async () => null),
  deleteNotificationChannelAsync: jest.fn(async () => undefined),
  AndroidImportance: { HIGH: 4 },
  AndroidNotificationVisibility: { PRIVATE: 0 },
};

jest.mock("expo-notifications", () => mockNotifications);
// An Android build made from this project: push runs. Only `Platform.OS`
// changes; the rest of React Native stays real for the modules that need it.
jest.mock("expo", () => ({ isRunningInExpoGo: () => false }));
jest.mock("react-native", () => {
  const actual = jest.requireActual<Record<string, unknown>>("react-native");
  const platform = { ...(actual.Platform as object), OS: "android" };
  return new Proxy(actual, { get: (target, key) => (key === "Platform" ? platform : target[key as string]) });
});
jest.mock("expo-constants", () => ({ __esModule: true, default: { easConfig: { projectId: "test-project" } } }));

const mockRpc = jest.fn(async (..._args: unknown[]) => ({ error: null }));
jest.mock("@/lib/supabase", () => ({ supabase: { rpc: (...args: unknown[]) => mockRpc(...args) } }));

type Push = typeof import("@/lib/push");

/** A fresh `lib/push.ts`, with the sync wired as `useAlertsSync()` wires it for a reader with alerts on. */
function loadPush(): Push {
  let push: Push | null = null;
  jest.isolateModules(() => {
    push = jest.requireActual<Push>("@/lib/push");
  });
  if (push === null) throw new Error("push didn't load");
  const loaded: Push = push;
  loaded.onPushTokenChange(() => {
    loaded.syncAlerts(true).catch(() => undefined);
  });
  return loaded;
}

/** Lets every report, retry and queued call run. A loop would keep going through all of them. */
async function settle() {
  for (let i = 0; i < 50; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  Object.assign(mockPhone, { online: false, device: "fcm-token-1", reportFirst: false });
});

describe("the phone's push token", () => {
  it("offline, tries once and stops: the token's own report is no change", async () => {
    const push = loadPush();
    await push.syncAlerts(true).catch(() => undefined);
    await settle();

    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("offline, stops after one more try when the report lands before the fetch answers", async () => {
    mockPhone.reportFirst = true;
    const push = loadPush();
    await push.syncAlerts(true).catch(() => undefined);
    await settle();

    expect(mockNotifications.getExpoPushTokenAsync.mock.calls.length).toBeLessThanOrEqual(2);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("online, registers once, with the Expo token made from the device token it fetched", async () => {
    mockPhone.online = true;
    const push = loadPush();
    await push.syncAlerts(true);
    await settle();

    expect(mockNotifications.getDevicePushTokenAsync).toHaveBeenCalledTimes(1);
    expect(mockNotifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "test-project",
      devicePushToken: { type: "android", data: "fcm-token-1" },
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith("set_push_token", {
      p_token: "ExponentPushToken[fcm-token-1]",
      p_enabled: true,
    });
  });

  it("registers again when Firebase rotates the token, once", async () => {
    mockPhone.online = true;
    const push = loadPush();
    await push.syncAlerts(true);
    await settle();

    mockPhone.device = "fcm-token-2";
    mockReport({ type: "android", data: "fcm-token-2" });
    await settle();

    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(mockRpc).toHaveBeenLastCalledWith("set_push_token", {
      p_token: "ExponentPushToken[fcm-token-2]",
      p_enabled: true,
    });
  });
});
