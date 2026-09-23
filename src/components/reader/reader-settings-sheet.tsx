import type { ReactNode } from "react";
import { Modal, Pressable, Switch, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { THEME_LABEL } from "@/components/reader/reader-theme";
import { SegmentedControl, type SegmentedOption } from "@/components/ui";
import { FONT_SIZE_MAX, FONT_SIZE_MIN, type ReaderTheme } from "@/store/reader-store";
import { colors } from "@/theme";

const FONT_SIZE_STEP = 2;

const THEME_OPTIONS: SegmentedOption<ReaderTheme>[] = [
  { value: "light", label: THEME_LABEL.light },
  { value: "sepia", label: THEME_LABEL.sepia },
  { value: "dark", label: THEME_LABEL.dark },
];

type Spacing = "compact" | "default" | "relaxed";

const LINE_SPACING: Record<Spacing, number> = { compact: 1.5, default: 1.7, relaxed: 2.0 };

const SPACING_OPTIONS: SegmentedOption<Spacing>[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "relaxed", label: "Relaxed" },
];

/** The option closest to the stored spacing, so the control always opens on a value. */
function spacingOption(lineSpacing: number): Spacing {
  return SPACING_OPTIONS.reduce((best, option) =>
    Math.abs(LINE_SPACING[option.value] - lineSpacing) <
    Math.abs(LINE_SPACING[best.value] - lineSpacing)
      ? option
      : best,
  ).value;
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <View className="min-h-14 flex-row items-center justify-between gap-4">
      {typeof label === "string" ? (
        <Text className="font-ui text-body flex-1 text-[15px]" maxFontSizeMultiplier={1.3}>
          {label}
        </Text>
      ) : (
        label
      )}
      {children}
    </View>
  );
}

type StepButtonProps = {
  label: string;
  accessibilityLabel: string;
  textClassName: string;
  disabled: boolean;
  onPress: () => void;
};

function StepButton({ label, accessibilityLabel, textClassName, disabled, onPress }: StepButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="h-11 w-11 items-center justify-center rounded-pill border border-muted/40"
      style={({ pressed }) => ({ opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Text className={`font-ui-semibold text-body ${textClassName}`} maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Pressable>
  );
}

type ReaderSettingsSheetProps = {
  visible: boolean;
  onClose: () => void;
  theme: ReaderTheme;
  fontSize: number;
  lineSpacing: number;
  atkinsonEnabled: boolean;
  onChangeTheme: (theme: ReaderTheme) => void;
  onChangeFontSize: (size: number) => void;
  onChangeLineSpacing: (spacing: number) => void;
  onChangeAtkinson: (enabled: boolean) => void;
};

/**
 * M5's reading settings — prompt 14 step 11. A React Native `Modal` sliding
 * up over a `bg/60` scrim. Closed by the scrim, Android back and "Done".
 * `raised` in every reader theme. The M5a paywall can reuse the pattern.
 */
export function ReaderSettingsSheet({
  visible,
  onClose,
  theme,
  fontSize,
  lineSpacing,
  atkinsonEnabled,
  onChangeTheme,
  onChangeFontSize,
  onChangeLineSpacing,
  onChangeAtkinson,
}: ReaderSettingsSheetProps) {
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
          accessibilityLabel="Close reading settings"
          onPress={onClose}
          className="absolute inset-0 bg-bg/60"
        />

        <View className="rounded-t-card bg-raised px-6 pt-6" style={{ paddingBottom: 24 + insets.bottom }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text accessibilityRole="header" className="text-heading text-xl" maxFontSizeMultiplier={1.3}>
              Reading settings
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

          <Row label="Text size">
            <View className="flex-row items-center gap-3">
              <StepButton
                label="A−"
                accessibilityLabel="Decrease text size"
                textClassName="text-[13px]"
                disabled={fontSize <= FONT_SIZE_MIN}
                onPress={() => onChangeFontSize(Math.max(FONT_SIZE_MIN, fontSize - FONT_SIZE_STEP))}
              />
              <Text
                accessibilityLabel={`Text size ${fontSize}`}
                className="font-ui-medium text-body w-7 text-center text-[15px]"
                maxFontSizeMultiplier={1.3}
              >
                {fontSize}
              </Text>
              <StepButton
                label="A+"
                accessibilityLabel="Increase text size"
                textClassName="text-[17px]"
                disabled={fontSize >= FONT_SIZE_MAX}
                onPress={() => onChangeFontSize(Math.min(FONT_SIZE_MAX, fontSize + FONT_SIZE_STEP))}
              />
            </View>
          </Row>

          <Row label="Theme">
            <SegmentedControl
              accessibilityLabel="Theme"
              options={THEME_OPTIONS}
              value={theme}
              onChange={onChangeTheme}
              className="w-[232px]"
            />
          </Row>

          <Row label="Line spacing">
            <SegmentedControl
              accessibilityLabel="Line spacing"
              options={SPACING_OPTIONS}
              value={spacingOption(lineSpacing)}
              onChange={(value) => onChangeLineSpacing(LINE_SPACING[value])}
              className="w-[232px]"
            />
          </Row>

          <Row
            label={
              <View className="flex-1">
                <Text className="font-ui text-body text-[15px]" maxFontSizeMultiplier={1.3}>
                  Atkinson Hyperlegible
                </Text>
                <Text className="font-ui text-muted text-[13px]" maxFontSizeMultiplier={1.3}>
                  Designed for low-vision readers
                </Text>
              </View>
            }
          >
            {/* Body text only: headings stay Fraunces and chrome stays Inter. */}
            <Switch
              value={atkinsonEnabled}
              onValueChange={onChangeAtkinson}
              accessibilityLabel="Atkinson Hyperlegible font"
              trackColor={{ false: colors.surface, true: colors.teal }}
              ios_backgroundColor={colors.surface}
              thumbColor={atkinsonEnabled ? colors.body : colors.muted}
            />
          </Row>
        </View>
      </View>
    </Modal>
  );
}
