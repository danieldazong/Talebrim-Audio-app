import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import type { RestorePoint } from "@/lib/parity/convert";

/** How long the notice holds its slot before the slot's own text returns. */
const NOTICE_MS = 4_000;

/** Both screens' copy when the place could not be mapped and starts the chapter over. */
const FROM_START = "From the start of the chapter";

/**
 * The notice a screen shows when it opens at a place mapped from the other
 * mode (prompt 19 step 8): `estimate` is the screen's own copy ("Near where
 * you were reading"), and the chapter-start fallback says so. Null when it
 * opened at its own mode's place.
 *
 * Taken from the first render, when the screen first shows its place: a
 * later change is not a new open. Shown for four seconds and announced to
 * screen readers. The timer goes with the unmount.
 */
export function useHandoffNotice(mapped: RestorePoint["mapped"], estimate: string): string | null {
  const [notice] = useState(() => (mapped === "estimate" ? estimate : mapped === "chapter-start" ? FROM_START : null));
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (notice === null) return;
    AccessibilityInfo.announceForAccessibility(notice);
    const timer = setTimeout(() => setExpired(true), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  return expired ? null : notice;
}
