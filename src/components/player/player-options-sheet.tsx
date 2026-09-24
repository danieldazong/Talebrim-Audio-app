import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/theme";

export type SheetOption<T> = {
  value: T;
  label: string;
  /** What a screen reader says, when the label reads badly aloud ("1.5x"). */
  accessibilityLabel?: string;
};

type PlayerOptionsSheetProps<T> = {
  visible: boolean;
  title: string;
  options: SheetOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

/**
 * M6's playback speed and sleep timer choices — prompt 17 step 9. The reader
 * settings sheet's pattern: a React Native `Modal` sliding up on `raised` over
 * a `bg/60` scrim, closed by the scrim, Android back and "Done". Choosing an
 * option applies it and closes the sheet. No ember here: the play button is
 * the screen's one ember action.
 */
export function PlayerOptionsSheet<T>({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: PlayerOptionsSheetProps<T>) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          onPress={onClose}
          className="absolute inset-0 bg-bg/60"
        />

        <View className="rounded-t-card bg-raised px-6 pt-6" style={{ paddingBottom: 16 + insets.bottom }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-heading text-xl" maxFontSizeMultiplier={1.3}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={onClose}
              className="-mr-3 h-11 justify-center px-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text className="font-ui-semibold text-body text-[15px]" maxFontSizeMultiplier={1.3}>
                Done
              </Text>
            </Pressable>
          </View>

          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={option.accessibilityLabel ?? option.label}
                accessibilityState={{ selected }}
                onPress={() => {
                  onSelect(option.value);
                  onClose();
                }}
                className="min-h-14 flex-row items-center justify-between gap-4"
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Text
                  className={`text-[15px] ${selected ? "font-ui-semibold text-teal" : "font-ui text-body"}`}
                  maxFontSizeMultiplier={1.3}
                >
                  {option.label}
                </Text>
                {selected ? <Ionicons name="checkmark" size={20} color={colors.teal} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}
