import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

/**
 * True while VoiceOver or TalkBack is on; follows the setting live.
 *
 * Always false on the web. A page cannot tell whether a screen reader is
 * running, and react-native-web's `isScreenReaderEnabled()` answers true
 * regardless, which held M5's toolbar open and stopped M3's hero carousel in
 * the web preview. The phone builds read the real setting. The web answer is
 * returned outright, not stored: a hot reload keeps a `true` stored earlier.
 */
export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {
        // Unknown counts as off; the listener below still corrects it.
      });
    const subscription = AccessibilityInfo.addEventListener("screenReaderChanged", setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return Platform.OS === "web" ? false : enabled;
}
