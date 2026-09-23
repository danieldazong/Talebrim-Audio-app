import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors } from "@/theme";

type ScreenProps = {
  children: ReactNode;
  /**
   * Which sides get safe-area inset. Screens with full-bleed artwork at the
   * top pass `["bottom"]` so the image reaches y=0.
   */
  edges?: readonly Edge[];
  /** Layout classes for the inner content container. */
  className?: string;
  /**
   * Paints the safe areas. Defaults to `bg`; M5 passes its reader page
   * colour so plum never shows above or below a light page.
   */
  backgroundColor?: string;
};

/**
 * Screen shell — `bg` background (or `backgroundColor`) plus safe-area insets.
 *
 * SafeAreaView takes no className (AGENTS.md § Style Exception Rules), so the
 * background is an inline style here and layout classes go on the inner View.
 */
export function Screen({
  children,
  edges = ["top", "bottom"],
  className = "",
  backgroundColor = colors.bg,
}: ScreenProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor }} edges={edges}>
      <View className={`flex-1 ${className}`}>{children}</View>
    </SafeAreaView>
  );
}
