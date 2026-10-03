import { keepPreviousData, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { router } from "expo-router";
import { ScrollView } from "react-native";

import { Screen } from "@/components/ui";
import { CarouselSection } from "@/components/discover/carousel-section";
import { DiscoverHeader } from "@/components/discover/discover-header";
import {
  DiscoverEmptyScreen,
  DiscoverError,
  DiscoverOffline,
  DiscoverSkeleton,
} from "@/components/discover/discover-states";
import { GenreTabStrip } from "@/components/discover/genre-tab-strip";
import { HeroCarousel } from "@/components/discover/hero-carousel";
import { ContinueSection } from "@/components/library/continue-card";
import { openResumeTarget, useContinue, type ContinueView } from "@/hooks/use-continue";
import { useDiscoverTabs } from "@/hooks/use-discover-tabs";
import { useDownloadEntries } from "@/hooks/use-downloads";
import { useHeroBooks } from "@/hooks/use-hero-carousel";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { DISCOVER_TAB } from "@/lib/discover-tabs";
import { booksBeyondHero } from "@/lib/hero";
import { appSettingsOptions } from "@/lib/queries/app-settings";
import { catalogByTabOptions, newAudioReleasesOptions, pickedForYouOptions } from "@/lib/queries/catalog";
import { useOnboardingStore } from "@/store/onboarding-store";
import type { CarouselBookRow } from "@/types/catalog";

// M3 Discover — AGENTS.md prompt 11. Reads `books_catalog` through the
// fetchers in `lib/queries/catalog.ts`; `data/seed-catalog.ts` (prompt 09) is
// no longer imported here, per that file's own header ("import this ONLY
// from a screen's explicit mock path... once wired to real data, remove the
// import").

export default function Discover() {
  const tabBarInset = useTabBarInset();
  // One genre tab per genre a published story carries (`lib/discover-tabs.ts`).
  const { tabs, tab, setTab } = useDiscoverTabs();
  const selectedGenres = useOnboardingStore((state) => state.selectedGenres);

  const appSettings = useQuery(appSettingsOptions());
  const tabQuery = useQuery({
    ...catalogByTabOptions(tab.id, tab.genre),
    placeholderData: keepPreviousData,
  });
  const pickedForYou = useQuery(pickedForYouOptions(selectedGenres));
  const newAudioReleases = useQuery(newAudioReleasesOptions());

  const isPending = tabQuery.isPending;
  const isError = tabQuery.isError;
  // Offline with nothing cached: the query is paused, not loading (prompt 24).
  const isOffline = isPending && tabQuery.fetchStatus === "paused";
  const hasDownloads = useDownloadEntries().length > 0;
  const books = tabQuery.data ?? [];
  // The hero's five, held while Discover is on screen. Null while the list is
  // still the previous tab's placeholder, so a new tab's set waits for its own.
  const heroBooks = useHeroBooks(books, tabQuery.isPlaceholderData ? null : tab.id);
  // A genre tab's stories past the hero's five, so every story is found under
  // its genre. Not while the list is still the previous tab's placeholder.
  const moreBooks = tab.genre !== null && !tabQuery.isPlaceholderData ? booksBeyondHero(books, heroBooks) : [];
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
      <GenreTabStrip tabs={tabs} value={tab.id} onChange={setTab} />

      {isOffline ? (
        <DiscoverOffline onOpenDownloads={hasDownloads ? () => router.push("/downloads") : null} />
      ) : isPending ? (
        <DiscoverSkeleton />
      ) : isError ? (
        <DiscoverError onRetry={retry} />
      ) : books.length === 0 ? (
        <DiscoverEmptyScreen onRetry={retry} />
      ) : (
        <DiscoverContent
          heroBooks={heroBooks}
          more={moreBooks.length > 0 ? { title: `More in ${tab.label}`, books: moreBooks } : null}
          continueView={tab.id === DISCOVER_TAB.id ? continueView : { status: "hidden" }}
          pickedForYou={pickedForYou}
          newAudioReleases={newAudioReleases}
          publicCdnDomain={appSettings.data?.public_cdn_domain ?? null}
          onOpenBook={openBook}
          bottomPadding={tabBarInset}
        />
      )}
    </Screen>
  );
}

type DiscoverContentProps = {
  /** The tab's newest stories for the hero carousel (`useHeroBooks()`). */
  heroBooks: CarouselBookRow[];
  /** A genre tab's stories past the hero's five, under their own heading; null when there are none. */
  more: { title: string; books: CarouselBookRow[] } | null;
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
  more,
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
    // paddingTop 8: the tab strip already ends 8dp below its underline, so the
    // first section starts 16dp under it, as in material/3.png.
    <ScrollView
      className="no-scrollbar"
      contentContainerStyle={{ gap: 24, paddingTop: 8, paddingBottom: bottomPadding + 16 }}
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
        />
      ) : null}

      {more ? (
        <CarouselSection
          title={more.title}
          books={more.books}
          publicCdnDomain={publicCdnDomain}
          onPressBook={onOpenBook}
          emptyLabel="No more stories in this genre yet."
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
