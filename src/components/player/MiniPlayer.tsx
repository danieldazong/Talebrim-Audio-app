import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";

import { useMiniPlayer } from "@/hooks/use-mini-player";
import { colors, layout } from "@/theme";

const COVER_SIZE = 40;
const COVER_RADIUS = 8;

/**
 * 56dp mini player — AGENTS.md prompt 08 step 5. Rendered once in
 * `(tabs)/_layout.tsx`, above the tab bar, so it survives tab switches
 * instead of unmounting per screen.
 *
 * Live since prompt 18: the player's loaded chapter, its real cover and the
 * same status M6 reads (`hooks/use-mini-player.ts`). Renders nothing (zero
 * height) until something has played, and after sign-out. No progress line:
 * its frame draws none.
 *
 * The open target and the play button are siblings, never one inside the
 * other. On the web a button can't contain a button, and on a phone a screen
 * reader reads a button as one element, which hid the play button inside it.
 */
export function MiniPlayer() {
  const { track, status, togglePlay, open } = useMiniPlayer();

  if (track === null) return null;

  // Buffering is on its way to playing, so the button pauses it.
  const playing = status !== "paused";

  return (
    <View className="mx-4 h-14 flex-row items-center rounded-card bg-raised pr-3">
      {/* Everything left of the play button opens M6, padding included. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Now Playing"
        accessibilityHint={`${track.title}${track.author ? `, by ${track.author}` : ""}`}
        onPress={open}
        className="h-full flex-1 flex-row items-center gap-3 px-3"
      >
        {track.coverUrl === null ? (
          <View
            style={{ width: COVER_SIZE, height: COVER_SIZE, borderRadius: COVER_RADIUS, backgroundColor: colors.surface }}
          />
        ) : (
          <Image
            source={{ uri: track.coverUrl }}
            style={{ width: COVER_SIZE, height: COVER_SIZE, borderRadius: COVER_RADIUS, backgroundColor: colors.surface }}
            contentFit="cover"
            contentPosition="top"
          />
        )}

        <View className="flex-1">
          <Text
            className="font-ui-semibold text-body text-sm"
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {track.title}
          </Text>
          {track.author ? (
            <Text
              className="font-ui text-muted text-xs"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {track.author}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "Pause" : "Play"}
        accessibilityState={{ busy: status === "buffering" }}
        hitSlop={layout.minTouchTarget}
        onPress={togglePlay}
        className="h-11 w-11 items-center justify-center"
      >
        <Ionicons
          name={playing ? "pause" : "play"}
          size={22}
          color={colors.body}
        />
      </Pressable>
    </View>
  );
}
