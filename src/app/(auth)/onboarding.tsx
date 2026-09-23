import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CoverCollage } from "@/components/onboarding/cover-collage";
import { images } from "@/constants/images";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { colors } from "@/theme";
import { useSplashStore } from "@/store/splash-store";

// STATIC MARKETING COPY — never wire this to reading_positions or the
// parity writer. It illustrates read/listen parity; it is not user data.
const PARITY_CARD_DEMO = {
  chapterLabel: "Ch. 14 · 65%",
  progressPercent: 65,
  textLabel: "Text · Page 182",
  audioLabel: "Audio · 18:42 left",
} as const;

function goToSignIn() {
  useSplashStore.getState().markSplashSeen();
  router.push("/(auth)/sign-in");
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  // Live value — this screen runs signed out, which `reader_settings()` allows.
  const freeChapters = useQuery(appSettingsOptions()).data?.free_chapters_at_start ?? null;

  return (
    <View className="flex-1 bg-bg">
      <CoverCollage />

      <View className="flex-1 px-6">
        {/* Two spacers share the slack: most above the headline, a little
            below the value rows so the free-chapters line is never flush
            against them. Both collapse under content pressure before any
            type size is touched. */}
        <View className="flex-[3]" />

        <Text
          className="font-display text-4xl leading-[40px] text-champagne"
          maxFontSizeMultiplier={1.3}
        >
          Read it.
        </Text>
        <Text
          className="font-display text-4xl leading-[40px] text-ember"
          maxFontSizeMultiplier={1.3}
        >
          Or hear it.
        </Text>

        {/* Capped so the line breaks land like the design's three lines
            instead of stretching to two on a wider phone. */}
        <Text className="font-ui text-muted mt-3 max-w-[330px] text-[17px] leading-[26px]">
          Thousands of chapters of forbidden romance. Switch between reading
          and listening without ever losing your place.
        </Text>

        <View
          className="bg-raised mt-5 rounded-card p-4"
          accessible
          accessibilityLabel="Reading progress example: chapter 14, 65 percent, synced in real time"
        >
          <View className="flex-row items-center gap-3">
            <Image
              source={images.covers.eternalEclipse}
              contentFit="cover"
              className="h-14 w-10 rounded-field"
            />
            <View className="flex-1 gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="font-ui-semibold text-body text-[17px]">
                  {PARITY_CARD_DEMO.chapterLabel}
                </Text>
                <View className="h-1.5 w-1.5 rounded-pill bg-teal" />
                <Text className="font-ui text-teal text-sm">
                  Synced in real time
                </Text>
              </View>

              <View className="justify-center">
                <View className="progress">
                  <View
                    className="progress__fill"
                    style={{ width: `${PARITY_CARD_DEMO.progressPercent}%` }}
                  />
                </View>
                <View
                  className="bg-ember absolute h-3 w-3 rounded-pill"
                  style={{
                    left: `${PARITY_CARD_DEMO.progressPercent}%`,
                    transform: [{ translateX: -6 }],
                  }}
                />
              </View>

              <View className="flex-row justify-between">
                <Text className="font-ui text-muted text-sm">
                  {PARITY_CARD_DEMO.textLabel}
                </Text>
                <Text className="font-ui text-muted text-sm">
                  {PARITY_CARD_DEMO.audioLabel}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="mt-5 gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-pill bg-raised">
              <Feather name="book-open" size={20} color={colors.ember} />
            </View>
            <View className="flex-1">
              <Text className="font-ui-semibold text-body text-[17px]">
                Read or listen
              </Text>
              <Text className="font-ui text-muted mt-0.5 text-[15px]">
                Every story in text and audio.
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-pill bg-raised">
              <Feather name="clock" size={20} color={colors.ember} />
            </View>
            <View className="flex-1">
              <Text className="font-ui-semibold text-body text-[17px]">
                New chapters weekly
              </Text>
              <Text className="font-ui text-muted mt-0.5 text-[15px]">
                Serials that run for hundreds of chapters.
              </Text>
            </View>
          </View>
        </View>

        <View className="min-h-4 flex-1" />

        {/* Hidden, not removed, until the live count arrives: removing it
            would let the spacers re-divide the slack and shift the headline,
            and showing a guessed number is the thing AGENTS.md forbids. Stays
            hidden if the request fails. */}
        <Text
          className={`font-ui-medium text-body text-center text-[17px] ${freeChapters === null ? "opacity-0" : ""}`}
          maxFontSizeMultiplier={1.3}
          accessibilityElementsHidden={freeChapters === null}
          importantForAccessibility={freeChapters === null ? "no-hide-descendants" : "auto"}
        >
          Start with
          <Text className="font-ui-semibold text-ember">
            {" "}
            {freeChapters ?? ""}{" "}
          </Text>
          free chapters.
        </Text>

        <Pressable
          onPress={goToSignIn}
          accessibilityRole="button"
          accessibilityLabel="Start reading"
          className="btn btn--primary mt-4 h-14 w-full"
        >
          <Text
            className="font-ui-semibold text-ink text-[17px]"
            maxFontSizeMultiplier={1.3}
          >
            Start Reading
          </Text>
          <Feather name="chevron-right" size={20} color={colors.ink} />
        </Pressable>

        <Pressable
          onPress={goToSignIn}
          accessibilityRole="link"
          accessibilityLabel="Sign in"
          className="mt-3 min-h-11 flex-row items-center justify-center"
        >
          <Text className="font-ui text-muted text-[15px]">
            Already have an account?{" "}
          </Text>
          <Text className="font-ui-medium text-teal text-[15px]">Sign in</Text>
        </Pressable>

        <Text
          className="font-ui text-muted mt-1 text-center text-sm"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
        >
          You must be 18+ to use Talebrim.
        </Text>
      </View>
    </View>
  );
}
