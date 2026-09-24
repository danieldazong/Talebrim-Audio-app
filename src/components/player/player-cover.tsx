import { useState } from "react";
import { View, useWindowDimensions } from "react-native";

import { Cover } from "@/components/ui";

/** 281dp of the 393dp frame (material/8.png). */
const COVER_WIDTH_RATIO = 0.72;
/** The least space kept above and below the cover when the screen is short. */
const MIN_GAP = 24;
/** The rim, on each side. */
const RIM = 1;

type PlayerCoverProps = {
  /** Resolved via `resolveCoverUrl()`. Null draws `Cover`'s flat `surface` box. */
  coverUrl: string | null;
  /** The loading skeleton: a flat square in place of the art. */
  loading?: boolean;
};

/**
 * M6's square cover — prompt 17 step 5. It takes whatever height the rest of
 * the screen leaves, centred in it: 72% of the screen width where that fits,
 * smaller on a short screen or at a large text size, so the transport never
 * scrolls out of reach.
 */
export function PlayerCover({ coverUrl, loading = false }: PlayerCoverProps) {
  const { width } = useWindowDimensions();
  const [boxHeight, setBoxHeight] = useState(0);
  const size = Math.floor(Math.min(width * COVER_WIDTH_RATIO, boxHeight - 2 * MIN_GAP));

  return (
    <View
      className="flex-1 items-center justify-center"
      onLayout={(event) => setBoxHeight(event.nativeEvent.layout.height)}
    >
      {size <= 0 ? null : loading ? (
        <View
          accessible
          accessibilityLabel="Loading chapter"
          accessibilityState={{ busy: true }}
          className="rounded-cover bg-surface"
          style={{ width: size, height: size }}
        />
      ) : (
        // The thin ember rim AGENTS.md M6 specifies. A decorative edge, not an
        // action: the play button stays the screen's single ember action.
        <View className="overflow-hidden rounded-cover border border-ember">
          <Cover
            source={coverUrl === null ? null : { uri: coverUrl }}
            width={size - 2 * RIM}
            aspectRatio={1}
          />
        </View>
      )}
    </View>
  );
}
