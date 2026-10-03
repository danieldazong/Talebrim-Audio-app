/**
 * iOS's tabs are native (`(tabs)/_layout.ios.tsx`), and a native tab bar has
 * no height to read: `useBottomTabBarHeight()` throws outside JS tabs. The
 * system insets each tab's scroll view for the bar instead (automatic content
 * inset adjustment), so the content adds nothing for it.
 */
export function useTabBarInset(): number {
  return 0;
}
