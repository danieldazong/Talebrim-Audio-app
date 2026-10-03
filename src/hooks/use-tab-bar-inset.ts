import { useBottomTabBarHeight } from "expo-router/tabs";

/**
 * The room a tab screen's scrolling content leaves at its end for the tab
 * bar. Android and the web draw the bar in JS (`(tabs)/_layout.tsx`), so it
 * is the height React Navigation reports for it. iOS uses native tabs
 * instead: see `use-tab-bar-inset.ios.ts`.
 */
export function useTabBarInset(): number {
  return useBottomTabBarHeight();
}
