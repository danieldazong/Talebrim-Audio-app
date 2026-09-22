import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_SEEN_KEY = "talebrim.onboardingSeen";

/** Fails soft to `false` — worst case the onboarding screen shows again. */
export async function getOnboardingSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === "true";
  } catch {
    return false;
  }
}

/** Best-effort write — must never block navigation on failure. */
export async function setOnboardingSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "true");
  } catch {
    // Best-effort only.
  }
}
