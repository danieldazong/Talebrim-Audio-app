import { useGlobalSearchParams, useSegments } from "expo-router";
import { useEffect, useRef } from "react";

import { screenFromRoute, trackScreen } from "@/lib/analytics";

/**
 * One screen event per route change (prompt 21a step 6), from the root
 * layout. A new chapter on the same route (M5's Next, M6's autoplay) is a
 * route change; a re-render, or a change to a parameter that isn't an id
 * (M6's `play`), is not.
 */
export function useScreenTracking() {
  const screen = screenFromRoute(useSegments(), useGlobalSearchParams());
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    const key = `${screen.name} ${JSON.stringify(screen.properties)}`;
    if (key === lastSent.current) return;
    lastSent.current = key;
    trackScreen(screen);
  });
}
