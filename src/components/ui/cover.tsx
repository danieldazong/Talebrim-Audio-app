import { Image, type ImageSource } from "expo-image";
import { View, type ImageSourcePropType } from "react-native";

import { colors, layout, radius } from "@/theme";

type CoverProps = {
  /** Resolved local/remote image source, or `null` for a missing/unmapped cover. */
  source: ImageSource | ImageSourcePropType | null;
  /** Stable id for list recycling — required on every cover in a virtualised list. */
  recyclingKey?: string;
  /**
   * Sizing only — `expo-image`'s `Image` does not accept `className` in this
   * NativeWind version, so width goes through a plain prop here, matching
   * the inline-style pattern already used for covers in `MiniPlayer`. Height
   * is always derived from the aspect ratio, never passed separately.
   */
  width?: number;
  /**
   * 2:3 unless a frame says otherwise (M6's square cover). Any other ratio
   * crops from the bottom, never both edges, so the title lettering at the
   * top of the art survives (AGENTS.md § Image Rule).
   */
  aspectRatio?: number;
  /**
   * `"high"` for a screen's one large cover (M4, M6), so it loads ahead of
   * the carousel covers still downloading behind it. Native only.
   */
  priority?: "normal" | "high";
};

/**
 * Cover art, 2:3 by default, 12dp radius — AGENTS.md § Layout / § Image Rule.
 *
 * `source: null` renders a flat `surface`-coloured box instead of an image —
 * no icon, no generated art (AGENTS.md § Image Generation Rules) — until
 * `constants/images.ts` ships a real `coverPlaceholder` asset.
 * // MISSING ASSET: cover-placeholder
 *
 * `recyclingKey` + `transition` has a known glitch in list contexts
 * (expo/expo#22516); this component intentionally omits `transition` so
 * `recyclingKey` alone can be relied on for carousel recycling.
 */
export function Cover({
  source,
  recyclingKey,
  width,
  aspectRatio = layout.coverAspectRatio,
  priority = "normal",
}: CoverProps) {
  const shape = { aspectRatio, borderRadius: radius.cover, width };

  if (source === null) {
    return <View style={[shape, { backgroundColor: colors.surface }]} />;
  }

  return (
    <Image
      source={source}
      recyclingKey={recyclingKey}
      style={[shape, { backgroundColor: colors.surface }]}
      contentFit="cover"
      contentPosition={aspectRatio === layout.coverAspectRatio ? "center" : "top"}
      // Memory as well as disk: a cover seen on Discover shows at once on M4,
      // with no second decode. The default is disk only.
      cachePolicy="memory-disk"
      priority={priority}
    />
  );
}
