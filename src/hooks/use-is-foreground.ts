import { useEffect, useState } from "react";
import { AppState } from "react-native";

/**
 * True unless the app is backgrounded. iOS's brief `inactive` (Control
 * Centre, the app switcher, an incoming call) counts as foreground so nothing
 * that follows it flaps. Catalog sync and M3's hero carousel use it.
 */
export function useIsForeground(): boolean {
  const [isForeground, setIsForeground] = useState(AppState.currentState !== "background");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => setIsForeground(state !== "background"));
    return () => subscription.remove();
  }, []);

  return isForeground;
}
