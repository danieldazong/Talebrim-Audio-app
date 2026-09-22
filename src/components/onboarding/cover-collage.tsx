import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { images } from "@/constants/images";
import { collageFadeGradient } from "@/theme";

// Source banner is 1600x1114 (ratio ~1.436) — a single pre-composed,
// transparent-background stitch of three covers, center cover largest.
const BANNER_RATIO = 1600 / 1114;

// Rendered wider than the screen and centered so the crop lands on the
// center cover: bold, zoomed in, the outer two covers bleeding off both
// edges rather than shrunk to fit inside the frame.
const BANNER_SCALE = 1.55;

// Share of screen height the banner occupies. A fixed dp height left a dead
// gap on taller devices — proportional keeps the same composition from a
// 852dp frame up to a tall phone.
const BANNER_HEIGHT_RATIO = 0.3;
const BANNER_HEIGHT_MIN = 225;
const BANNER_HEIGHT_MAX = 300;

/**
 * Top-of-screen banner for the onboarding pre-screen — AGENTS.md is silent
 * on this exact screen, spec comes from prompts/Onboarding-screen.md.
 *
 * Full-bleed from y=0 (no SafeAreaView here), fills from the top down into
 * the headline, fading into `bg` at the bottom via LinearGradient. AGENTS.md
 * reserves gradients for M6 Now Playing — this is a deliberate, user-approved
 * exception: a stacked-opacity-band approximation was tried first and shows
 * visible seams over photographic cover art (Mach banding), which a real
 * gradient does not. See the note on `collageFadeGradient`.
 */
export function CoverCollage() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const bannerHeight = Math.min(
    BANNER_HEIGHT_MAX,
    Math.max(BANNER_HEIGHT_MIN, screenHeight * BANNER_HEIGHT_RATIO),
  );

  return (
    <View
      className="w-full overflow-hidden bg-bg"
      style={{ height: bannerHeight }}
    >
      <View
        className="absolute inset-x-0 top-0 items-center"
        style={{ pointerEvents: "none" }}
      >
        <Image
          source={images.onboardingBanner}
          contentFit="contain"
          style={{
            width: `${BANNER_SCALE * 100}%`,
            aspectRatio: BANNER_RATIO,
          }}
        />
      </View>

      <LinearGradient
        colors={collageFadeGradient}
        locations={[0, 0.6, 1]}
        className="absolute inset-x-0 bottom-0"
        style={{ height: bannerHeight * 0.62, pointerEvents: "none" }}
      />

      <View
        className="absolute h-10 w-10 items-center justify-center rounded-pill bg-raised"
        style={{ top: insets.top + 8, left: 16, zIndex: 10 }}
        importantForAccessibility="no"
      >
        <Image
          source={images.logo}
          contentFit="contain"
          style={{ width: 16, height: 28 }}
        />
      </View>
    </View>
  );
}
