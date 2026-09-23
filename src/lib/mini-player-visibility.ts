// Data-driven mini-player visibility — AGENTS.md prompt 08 step 6: "must be
// data-driven from one exported map, not scattered conditionals."
//
// M1 and M2 sit outside the (tabs) group entirely, so they never mount this
// map at all — their "absence" is structural, not a `false` entry here.

/** Route names as they appear in `(tabs)/_layout.tsx`'s `<Tabs.Screen name>`. */
export type TabRouteName = "index" | "library" | "profile";

/**
 * Whether the mini player may render on a given tab route.
 *
 * true  — M3 (Discover/index), M7 (Library), M11 (Profile)
 * false — none today; M5/M6 are non-tab stack screens and are excluded by
 *         living outside this map, not by a `false` entry.
 */
export const MINI_PLAYER_VISIBLE_ROUTES: Record<TabRouteName, boolean> = {
  index: true, // M3 Discover
  library: true, // M7 Library
  profile: true, // M11 Profile
};
