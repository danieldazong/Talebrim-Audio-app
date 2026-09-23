import { useState } from "react";
import { Text, View } from "react-native";

import { CoverCollage } from "@/components/onboarding/cover-collage";
import { Body, Button, Chip, Heading, Screen } from "@/components/ui";
import { GENRES, type Genre } from "@/data/genres";
import { routeAfterAuth } from "@/lib/auth-routing";
import { useOnboardingStore } from "@/store/onboarding-store";

// UNDEFINED STEP 3: the design material shows three step dots with the
// second one active, implying a step after this screen. AGENTS.md's Screen
// Inventory defines only M1 (sign in) and M2 (this screen) before M3
// (Discover) — no third onboarding step exists anywhere in the spec. The
// index below is hardcoded to match the material; do not build a step 3.
const STEP_COUNT = 3;
const CURRENT_STEP_INDEX = 1;

// Selection is local-component state until submit — AGENTS.md has no
// profile table until Phase 2, so the onboarding Zustand store (persisted to
// AsyncStorage) is the only durable home for it. Writing on every toggle
// would persist an abandoned, half-made selection; the store only receives
// the choice on "Start Reading" or "Skip", both of which also set the
// completion flag that gates this route from ever re-showing.
export default function Genres() {
  const [selected, setSelected] = useState<ReadonlySet<Genre>>(new Set());
  const completeOnboarding = useOnboardingStore(
    (state) => state.completeOnboarding,
  );
  const skipOnboarding = useOnboardingStore((state) => state.skipOnboarding);

  function toggle(value: Genre) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

  function onSubmit() {
    completeOnboarding(Array.from(selected));
    routeAfterAuth();
  }

  function onSkip() {
    // Skip is a real path onward with an empty selection, not a disabled
    // state — AGENTS.md sets no minimum on this screen. It is still a
    // completed state: a user who skips is never shown M2 again.
    skipOnboarding();
    routeAfterAuth();
  }

  return (
    <Screen edges={["bottom"]}>
      <CoverCollage />

      <View className="flex-1 px-6">
        <View className="mt-6 flex-row items-center justify-center gap-2">
          {Array.from({ length: STEP_COUNT }).map((_, index) => (
            <View
              key={index}
              className={`h-1.5 rounded-pill ${
                index === CURRENT_STEP_INDEX
                  ? "bg-ember w-6"
                  : "bg-raised w-1.5"
              }`}
            />
          ))}
        </View>

        <Heading className="mt-6">What you love to read</Heading>
        <Body className="mt-2">
          Pick the genres that pull you in — we&apos;ll use them to recommend
          stories.
        </Body>

        <View
          className="mt-6 flex-row flex-wrap gap-3"
          accessibilityLabel="Genre selection"
        >
          {GENRES.map((genre) => {
            const isSelected = selected.has(genre.value);
            return (
              <View key={genre.value} className="min-h-11 justify-center">
                <Chip
                  label={genre.label}
                  selected={isSelected}
                  onPress={() => toggle(genre.value)}
                />
              </View>
            );
          })}
        </View>

        <View className="min-h-6 flex-1" />

        <Button
          label="Start Reading"
          variant="primary"
          className="h-14 w-full"
          onPress={onSubmit}
        />

        <Text
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip"
          className="font-ui text-muted mt-4 min-h-11 text-center text-[15px] leading-[44px]"
        >
          Skip
        </Text>
      </View>
    </Screen>
  );
}
