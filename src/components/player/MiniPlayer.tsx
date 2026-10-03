import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Color } from "expo-router";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { useMiniPlayer } from "@/hooks/use-mini-player";
import { colors, layout } from "@/theme";

const COVER_SIZE = 40;
/** In iOS's tab bar accessory, which is shorter than the 56dp card. */
const ACCESSORY_COVER_SIZE = 32;
const COVER_RADIUS = 8;

type MiniPlayerProps = {
  /**
   * Set only on iOS, where the mini player is the native tab bar's bottom
   * accessory (`(tabs)/_layout.ios.tsx`): `regular` above the bar, `inline`
   * beside it once it shrinks, with room for the title alone. The system
   * draws the glass around it, so it has no card of its own, and its words
   * take the system's label colours, which follow the glass between light
   * and dark. Left out (Android, the web), it is the card above the tab bar.
   */
  placement?: "regular" | "inline";
};

/**
 * 56dp mini player — AGENTS.md prompt 08 step 5. Rendered once in
 * `(tabs)/_layout.tsx`, above the tab bar, so it survives tab switches
 * instead of unmounting per screen. On iOS it is the native tab bar's
 * accessory instead (`placement`).
 *
 * Live since prompt 18: the player's loaded chapter, its real cover and the
 * same status M6 reads (`hooks/use-mini-player.ts`). Renders nothing (zero
 * height) until something has played, and after sign-out. No progress line:
 * its frame draws none.
 *
 * The open target and the play button are siblings, never one inside the
 * other. On the web a button can't contain a button, and on a phone a screen
 * reader reads a button as one element, which hid the play button inside it.
 *
 * Memoized: it takes no props but `placement` and reads the player itself, so
 * a tab switch, which renders the tab bar again, doesn't render it again too.
 */
export const MiniPlayer = memo(function MiniPlayer({ placement }: MiniPlayerProps) {
  const { track, status, togglePlay, open } = useMiniPlayer();

  if (track === null) return null;

  // Buffering is on its way to playing, so the button pauses it.
  const playing = status !== "paused";
  const inGlass = placement !== undefined;
  const coverSize = inGlass ? ACCESSORY_COVER_SIZE : COVER_SIZE;
  const coverStyle = { width: coverSize, height: coverSize, borderRadius: COVER_RADIUS, backgroundColor: colors.surface };

  return (
    <View
      className={
        inGlass ? "flex-1 flex-row items-center pr-1" : "mx-4 h-14 flex-row items-center rounded-card bg-raised pr-3"
      }
    >
      {/* Everything left of the play button opens M6, padding included. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open Now Playing"
        accessibilityHint={`${track.title}${track.author ? `, by ${track.author}` : ""}`}
        onPress={open}
        className="h-full flex-1 flex-row items-center gap-3 px-3"
      >
        {placement === "inline" ? null : track.coverUrl === null ? (
          <View style={coverStyle} />
        ) : (
          <Image
            source={{ uri: track.coverUrl }}
            style={coverStyle}
            contentFit="cover"
            contentPosition="top"
          />
        )}

        <View className="flex-1">
          <Text
            className="font-ui-semibold text-body text-sm"
            style={inGlass ? { color: Color.ios.label } : undefined}
            numberOfLines={1}
            maxFontSizeMultiplier={1.3}
          >
            {track.title}
          </Text>
          {track.author && placement !== "inline" ? (
            <Text
              className="font-ui text-muted text-xs"
              style={inGlass ? { color: Color.ios.secondaryLabel } : undefined}
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
          color={inGlass ? Color.ios.label : colors.body}
        />
      </Pressable>
    </View>
  );
});
