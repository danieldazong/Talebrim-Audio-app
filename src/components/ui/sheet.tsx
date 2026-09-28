import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SheetProps = {
  /** Tapping the scrim. Android back closes the route itself. */
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * A sheet route's frame: the scrim, and the `raised` sheet at the bottom,
 * above the home indicator. M5a's and the alerts sheet's, each a
 * `transparentModal` route over whatever opened it (`app/_layout.tsx`).
 */
export function Sheet({ onClose, children }: SheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 justify-end">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        className="absolute bottom-0 left-0 right-0 top-0 bg-bg/70"
      />
      <View
        accessibilityViewIsModal
        className="items-center rounded-t-card bg-raised px-6 pt-8"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        {children}
      </View>
    </View>
  );
}
