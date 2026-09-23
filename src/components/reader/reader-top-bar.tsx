import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import type { ReaderPalette } from "@/components/reader/reader-theme";

type ReaderTopBarProps = {
  palette: ReaderPalette;
  /** Omitted while the chapter's data is unknown (step 18). */
  bookTitle?: string | null;
  chapterNumber?: number | null;
  onBack: () => void;
  onOpenSettings: () => void;
};

/**
 * M5's fixed top bar — prompt 14 step 7, measured from material/7.png: 64dp
 * below the status bar, page-coloured, a 1dp hairline along its bottom.
 * It never scrolls or hides.
 *
 * Back and `Aa` are both 44dp wide, so the centred title lines sit between
 * them and can never run underneath either.
 */
export function ReaderTopBar({
  palette,
  bookTitle,
  chapterNumber,
  onBack,
  onOpenSettings,
}: ReaderTopBarProps) {
  return (
    <View className={`h-16 flex-row items-center border-b px-4 ${palette.page} ${palette.hairline}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        className="h-11 w-11 items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Ionicons name="chevron-back" size={24} color={palette.colors.text} />
      </Pressable>

      <View
        className="flex-1 items-center px-2"
        accessible={Boolean(bookTitle) || chapterNumber != null}
        accessibilityRole="header"
      >
        {bookTitle ? (
          <Text
            className={`font-ui-medium text-[13px] uppercase tracking-[0.5px] ${palette.secondary}`}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {bookTitle}
          </Text>
        ) : null}
        {chapterNumber != null ? (
          <Text
            className={`font-display text-[15px] ${palette.display}`}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {`Chapter ${chapterNumber}`}
          </Text>
        ) : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reading settings"
        onPress={onOpenSettings}
        className="h-11 w-11 items-center justify-center"
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
      >
        <Text className={`font-ui-semibold text-base ${palette.text}`} maxFontSizeMultiplier={1.3}>
          Aa
        </Text>
      </Pressable>
    </View>
  );
}
