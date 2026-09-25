import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useBottomTabBarHeight } from "expo-router/tabs";
import { router } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";

import { Screen } from "@/components/ui";
import { CarouselSection } from "@/components/discover/carousel-section";
import { DiscoverHeader } from "@/components/discover/discover-header";
import {
  DiscoverEmptyScreen,
  DiscoverError,
  DiscoverSkeleton,
} from "@/components/discover/discover-states";
import { GenreTabStrip, type DiscoverTab } from "@/components/discover/genre-tab-strip";
import { HeroCarousel } from "@/components/discover/hero-carousel";
import { ContinueSection } from "@/components/library/continue-card";
import type { Genre } from "@/data/genres";
import { openResumeTarget, useContinue, type ContinueView } from "@/hooks/use-continue";
import { useHeroAutoAdvance, useHeroBooks } from "@/hooks/use-hero-carousel";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { catalogByTabOptions, newAudioReleasesOptions, pickedForYouOptions } from "@/lib/queries/catalog";
import { useOnboardingStore } from "@/store/onboarding-store";
import type { CarouselBookRow } from "@/types/catalog";

// M3 Discover — AGENTS.md prompt 11. Reads `books_catalog` through the
// fetchers in `lib/queries/catalog.ts`; `data/seed-catalog.ts` (prompt 09) is
// no longer imported here, per that file's own header ("import this ONLY
// from a screen's explicit mock path... once wired to real data, remove the
// import").

/** Tab strip entries that map onto a real `books.genres` value. "Discover" and "New" are not genres. */
const TAB_GENRE: Partial<Record<DiscoverTab, Genre>> = {
  Werewolf: "werewolf",
  Romance: "romance",
  Vampire: "vampire",
  Fantasy: "fantasy",
};

export default function Discover() {
  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState<DiscoverTab>("Discover");
  const selectedGenres = useOnboardingStore((state) => state.selectedGenres);

  const genreForTab = TAB_GENRE[tab] ?? null;

  const appSettings = useQuery(appSettingsOptions());
  const tabQuery = useQuery({
    ...catalogByTabOptions(tab, genreForTab),
    placeholderData: keepPreviousData,
  });
  const pickedForYou = useQuery(pickedForYouOptions(selectedGenres));
  const newAudioReleases = useQuery(newAudioReleasesOptions());

  const isPending = tabQuery.isPending;
  const isError = tabQuery.isError;
  const books = tabQuery.data ?? [];
  // The hero's five, held while Discover is on screen. Null while the list is
  // still the previous tab's placeholder, so a new tab's set waits for its own.
  const heroBooks = useHeroBooks(books, tabQuery.isPlaceholderData ? null : tab);
  const heroAutoAdvance = useHeroAutoAdvance();
  // Where the reader left off, first on the Discover tab: a returning reader
  // resumes without going to Library. Genre tabs don't show it.
  const continueView = useContinue("books").view;

  function openBook(id: string) {
    router.push({ pathname: "/book/[id]", params: { id } });
  }

  function retry() {
    tabQuery.refetch();
    pickedForYou.refetch();
    newAudioReleases.refetch();
  }

  return (
    // `edges=["top"]` only — the tab bar already carries its own bottom
    // safe-area inset (prompt 08), so keeping Screen's bottom edge here
    // would double-pad the bottom (prompt 09 step 1).
    <Screen edges={["top"]}>
      <DiscoverHeader onPressSearch={() => router.push("/search")} />
      <GenreTabStrip value={tab} onChange={setTab} />

      {isPending ? (
        <DiscoverSkeleton />
      ) : isError ? (
        <DiscoverError onRetry={retry} />
      ) : books.length === 0 ? (
        <DiscoverEmptyScreen onRetry={retry} />
      ) : (
        <DiscoverContent
          heroBooks={heroBooks}
          heroAutoAdvance={heroAutoAdvance}
          continueView={tab === "Discover" ? continueView : { status: "hidden" }}
          pickedForYou={pickedForYou}
          newAudioReleases={newAudioReleases}
          publicCdnDomain={appSettings.data?.public_cdn_domain ?? null}
          onOpenBook={openBook}
          bottomPadding={tabBarHeight}
        />
      )}
    </Screen>
  );
}

type DiscoverContentProps = {
  /** The tab's newest stories for the hero carousel (`useHeroBooks()`). */
  heroBooks: CarouselBookRow[];
  heroAutoAdvance: boolean;
  continueView: ContinueView;
  /** Passed as the live query result, not just `.data` — each carousel needs its own pending/error state, not the parent tab query's (a sibling section still loading must render its own skeleton, not an empty state). */
  pickedForYou: UseQueryResult<CarouselBookRow[]>;
  newAudioReleases: UseQueryResult<CarouselBookRow[]>;
  publicCdnDomain: string | null;
  onOpenBook: (id: string) => void;
  bottomPadding: number;
};

function DiscoverContent({
  heroBooks,
  heroAutoAdvance,
  continueView,
  pickedForYou,
  newAudioReleases,
  publicCdnDomain,
  onOpenBook,
  bottomPadding,
}: DiscoverContentProps) {
  const continueHeading =
    continueView.status === "ready" && continueView.card.mode === "audio" ? "Continue Listening" : "Continue Reading";

  return (
    <ScrollView
      className="no-scrollbar"
      contentContainerStyle={{ gap: 24, paddingTop: 16, paddingBottom: bottomPadding + 16 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* Its resume button is `secondary`: the hero's "Read or Listen" is
          this screen's one ember action. */}
      <ContinueSection
        view={continueView}
        heading={continueHeading}
        onOpenBook={onOpenBook}
        onResume={(target) => openResumeTarget(target, "discover")}
        resumeVariant="secondary"
      />

      {heroBooks.length > 0 ? (
        // Keyed by its stories, so a new set starts again at the first.
        <HeroCarousel
          key={heroBooks.map((book) => book.id).join()}
          books={heroBooks}
          publicCdnDomain={publicCdnDomain}
          onPressBook={onOpenBook}
          autoAdvance={heroAutoAdvance}
        />
      ) : null}

      <CarouselSection
        title="Picked for You"
        books={pickedForYou.data ?? []}
        isLoading={pickedForYou.isPending}
        isError={pickedForYou.isError}
        onRetry={() => pickedForYou.refetch()}
        publicCdnDomain={publicCdnDomain}
        onPressBook={onOpenBook}
        onPressSeeAll={() => router.push("/search")}
        emptyLabel="We're still learning your taste — check back soon."
      />

      {/* NO BACKING METRIC — there is no view-counts or reads table to rank
          "trending" by (AGENTS.md Data Contract). Rendered as its written
          empty state rather than a fake ordering; see lib/queries/catalog.ts. */}
      <CarouselSection
        title="Trending Now"
        books={[]}
        publicCdnDomain={publicCdnDomain}
        onPressBook={onOpenBook}
        emptyLabel="Nothing trending yet."
      />

      <CarouselSection
        title="New Audio Releases"
        books={newAudioReleases.data ?? []}
        isLoading={newAudioReleases.isPending}
        isError={newAudioReleases.isError}
        onRetry={() => newAudioReleases.refetch()}
        publicCdnDomain={publicCdnDomain}
        onPressBook={onOpenBook}
        emptyLabel="No audio releases yet."
      />
    </ScrollView>
  );
}
