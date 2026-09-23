import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { images } from "@/constants/images";
import { colors, layout } from "@/theme";
import { usePlaybackStore } from "@/store/playback-store";

/**
 * 56dp mini player — AGENTS.md prompt 08 step 5. Rendered once in
 * `(tabs)/_layout.tsx`, above the tab bar, so it survives tab switches
 * instead of unmounting per screen.
 *
 * Renders nothing (zero height) when no track has ever been loaded — step 7.
 * `currentChapterId` is the only signal for "a track is loaded"; it is set
 * once M6 starts wiring real playback and never reset back to null just to
 * hide this bar again.
 */
export function MiniPlayer() {
  const currentChapterId = usePlaybackStore((state) => state.currentChapterId);
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const setIsPlaying = usePlaybackStore((state) => state.setIsPlaying);

  if (!currentChapterId) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open Now Playing"
      className="mx-4 h-14 flex-row items-center gap-3 rounded-card bg-raised px-3"
      // TODO(prompt 19/20): route to /player/[chapterId] once a real chapter
      // is behind this bar.
    >
      <Image
        // SHELL — wired in prompt 19/20: this is a fixed placeholder cover,
        // not the currently-playing book's real cover. Swap to
        // images.coverPlaceholder when a track has no cover, and to the
        // chapter's real cover once chapter/book data is wired.
        source={images.covers.eternalEclipse}
        style={{ width: 40, height: 40, borderRadius: 8 }}
        contentFit="cover"
      />

      <View className="flex-1">
        <Text
          className="font-ui-semibold text-body text-sm"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {/* SHELL — wired in prompt 19/20: static placeholder copy. */}
          Eternal Eclipse · Ch. 12
        </Text>
        <Text
          className="font-ui text-muted text-xs"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          Elara Vance
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        hitSlop={layout.minTouchTarget}
        onPress={() => setIsPlaying(!isPlaying)}
        className="h-11 w-11 items-center justify-center"
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={22}
          color={colors.body}
        />
      </Pressable>
    </Pressable>
  );
}
