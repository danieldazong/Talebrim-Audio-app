import { Ionicons } from "@expo/vector-icons";
import { ImageBackground } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Text, View } from "react-native";

import { Button } from "@/components/ui";
import { formatDurationCompact } from "@/lib/format";
import { genreLabel } from "@/lib/labels";
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
 * // NO BACKING METRIC — the design's badge reads "★ #1 Trending Serial", but
 * there is no view-counts or reads table to rank by (AGENTS.md Data
 * Contract). The badge keeps the design's star and says what is true
 * instead: every card in the hero carousel is one of its tab's five newest
 * stories (`newestHeroIds()`), so "New Serial". If the hero is ever chosen
 * another way, change the label with it. One line: the frame's second line
 * is its phrase wrapping inside a too-narrow pill.
 */
export function HeroCard({ book, coverUrl, onPress }: HeroCardProps) {
  const genres = book.genres ?? [];
  const hasAudio = (book.audio_count ?? 0) > 0;

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
          // Crop from the bottom, not both edges — cover titles sit at the top.
          contentPosition="top"
          // The first cover on Discover, and the same file M4 shows next.
          cachePolicy="memory-disk"
          priority="high"
        >
          <View
            className="flex-row items-center gap-1 self-start rounded-pill bg-bg/70 px-3 py-1.5"
            style={{ margin: 16 }}
          >
            <Ionicons name="star" size={12} color={colors.teal} />
            <Text className="font-ui-medium text-teal text-xs" numberOfLines={1} maxFontSizeMultiplier={1.3}>
              New Serial
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
                  {genreLabel(genre)}
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

          {/* Teal, as the design draws it: an audio affordance (AGENTS.md
              § Design System). The owner lifted prompt 09's "no teal
              elsewhere" on 2026-09-25. Only for a narrated book: teal marks
              audio, and a text-only book has no audio length to show, as on
              M4. */}
          {hasAudio ? (
            <View
              accessible
              accessibilityLabel={`${formatDurationCompact(book.total_duration_seconds)} of audio parity`}
              className="flex-row items-center gap-1"
            >
              <Ionicons name="time-outline" size={16} color={colors.teal} />
              <Text className="font-ui-medium text-teal text-sm" maxFontSizeMultiplier={1.3}>
                {formatDurationCompact(book.total_duration_seconds)} Audio Parity
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
