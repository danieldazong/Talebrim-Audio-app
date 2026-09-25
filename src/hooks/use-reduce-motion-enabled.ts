import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** True while the system's Reduce Motion (iOS) or Remove animations (Android) is on; follows it live. */
export function useReduceMotionEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch(() => {
        // Unknown counts as off; the listener below still corrects it.
      });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setEnabled);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return enabled;
}
