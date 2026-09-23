import { Ionicons } from "@expo/vector-icons";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { formatDurationCompact } from "@/lib/format";
import { colors, heroCardFadeGradient, radius } from "@/theme";
import type { CarouselBookRow } from "@/types/catalog";

type HeroCardProps = {
  book: CarouselBookRow;
  /** Resolved via `resolveCoverUrl()` against the live `public_cdn_domain` — never built inline here. */
  coverUrl: string | null;
  onPress: (id: string) => void;
};

/**
 * M3 hero card — AGENTS.md prompt 09 step 4. `Read or Listen` is the single
 * ember element on this screen; every other affordance here is text/outline.
 *
 * // NO BACKING METRIC — the design shows a "#1 Trending" rank, but there is
 * no view-counts or reads table to justify one (AGENTS.md Data Contract).
 * The rank number is omitted; "Serial" alone is kept as it's a real content
 * classification (every seed book here IS a serial), not an invented metric.
 */
export function HeroCard({ book, coverUrl, onPress }: HeroCardProps) {
  const genres = book.genres ?? [];

  return (
    <View className="mx-4 overflow-hidden rounded-card bg-surface" style={{ borderRadius: radius.card }}>
      {coverUrl === null ? (
        // MISSING ASSET: cover-placeholder — flat surface box, no icon, no
        // generated art (AGENTS.md § Image Generation Rules).
        <View className="h-80 bg-surface" />
      ) : (
        <ImageBackground
          source={coverUrl}
          style={{ height: 320, justifyContent: "flex-start" }}
          contentFit="cover"
        >
          <View
            className="flex-row items-center gap-1 self-start rounded-pill bg-bg/70 px-3 py-1.5"
            style={{ margin: 16 }}
          >
            <Ionicons name="layers-outline" size={14} color={colors.teal} />
            <Text className="font-ui-medium text-teal text-xs" maxFontSizeMultiplier={1.3}>
              Serial
            </Text>
          </View>

          {/* Real gradient fade, not a flat scrim — AGENTS.md § Design
              System reserves gradients for M6, but a flat block leaves a
              hard visible seam where this design shows a smooth blend into
              the card's `surface` background. Same documented exception as
              the onboarding collage fade (`theme/colors.ts`), approved
              2026-09-23 to match the reference exactly. */}
          <LinearGradient
            colors={heroCardFadeGradient}
            locations={[0, 0.6, 1]}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 160,
            }}
          />
        </ImageBackground>
      )}

      <View className="gap-3 p-4">
        {genres.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {genres.slice(0, 2).map((genre) => (
              <View key={genre} className="rounded-pill bg-blush/20 px-3 py-1">
                <Text className="font-ui-medium text-blush text-xs" maxFontSizeMultiplier={1.3}>
                  {genre}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text className="text-heading text-2xl" maxFontSizeMultiplier={1.3}>
          {book.title ?? "Untitled"}
        </Text>

        <Text className="font-ui text-muted text-sm" maxFontSizeMultiplier={1.5}>
          By {book.author ?? "Unknown author"}
          {book.chapter_count !== null ? ` · ${book.chapter_count} Chapters` : ""}
        </Text>

        <View className="flex-row items-center justify-between">
          <Button
            label="Read or Listen"
            variant="primary"
            icon={<Ionicons name="play" size={16} color={colors.ink} />}
            onPress={() => book.id && onPress(book.id)}
          />

          {/* DEVIATION: the design material renders this row (and its icon)
              in teal, but prompt 09 step 6 reserves teal exclusively for the
              audio badge on cover cards ("do not use teal anywhere else on
              this screen"). Rendered in muted instead; following the
              prompt's stricter text over the image. */}
          <View
            accessible
            accessibilityLabel={`${formatDurationCompact(book.total_duration_seconds)} of audio parity`}
            className="flex-row items-center gap-1"
          >
            <Ionicons name="time-outline" size={16} color={colors.muted} />
            <Text className="font-ui-medium text-muted text-sm" maxFontSizeMultiplier={1.3}>
              {formatDurationCompact(book.total_duration_seconds)} Audio Parity
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
