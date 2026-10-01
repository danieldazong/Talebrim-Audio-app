// M11's two confirmations: Sign out and Delete account (prompt 25).
// No React, no hooks, no JSX (AGENTS.md § lib/).
import { Alert, Platform } from "react-native";

type Confirmation = {
  title: string;
  message: string;
  /** The destructive button's label. */
  action: string;
  onConfirm: () => void;
};

/**
 * Asks first, with Cancel and a destructive action. react-native-web's
 * `Alert.alert` does nothing, so the web preview asks with the browser's own
 * confirm instead; without it, both links would do nothing there.
 */
export function confirmDestructive({ title, message, action, onConfirm }: Confirmation): void {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: action, style: "destructive", onPress: onConfirm },
  ]);
}
