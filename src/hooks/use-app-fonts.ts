import { useFonts } from "expo-font";

import { fontMap } from "@/lib/fonts";

/**
 * Loads the app's fonts and reports when it is safe to render.
 *
 * `ready` is true once the fonts are registered OR loading has definitively
 * failed. The error branch is the point: a corrupt or missing font file
 * degrades the app to system fonts instead of hanging on the splash screen
 * forever. AGENTS.md § UI Quality Bar.
 */
export function useAppFonts(): { ready: boolean; error: Error | null } {
  const [loaded, error] = useFonts(fontMap);

  return { ready: loaded || error !== null, error };
}
