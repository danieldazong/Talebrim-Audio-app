import { useBottomTabBarHeight } from "expo-router/tabs";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
import { HeroCard } from "@/components/discover/hero-card";
import { seedBooks } from "@/data/seed-catalog";
import type { BookCatalogRow } from "@/types/catalog";

// M3 Discover — AGENTS.md prompt 09. Built against `data/seed-catalog.ts`
// ONLY ("Do not: call Supabase, TanStack Query or any network in this
// prompt"); prompt 11 swaps in the real `books_catalog` query behind the
// same layout, at which point the branches below map directly onto a
// TanStack Query result (`isPending` / `isError` / empty data / data).

/** Filters the seed catalog by the active tab. "Discover"/"New" show everything — neither is a real genre filter. */
function booksForTab(tab: DiscoverTab): BookCatalogRow[] {
  if (tab === "Discover" || tab === "New") return seedBooks;
  return seedBooks.filter((book) => book.genres?.includes(tab));
}

export default function Discover() {
  const tabBarHeight = useBottomTabBarHeight();
  const [tab, setTab] = useState<DiscoverTab>("Discover");
  // Seed data is read synchronously — there is no real request in this
  // prompt — so `isLoading`/`hasError` never flip themselves. Both branches
  // still render real, correct UI (prompt 09 step 11); prompt 11 wires them
  // to a TanStack Query result's actual `isPending`/`isError`.
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const books = useMemo(() => booksForTab(tab), [tab]);

  function openBook(id: string) {
    router.push({ pathname: "/book/[id]", params: { id } });
  }

  function retry() {
    setHasError(false);
    setIsLoading(false);
  }

  return (
    // `edges=["top"]` only — the tab bar already carries its own bottom
    // safe-area inset (prompt 08), so keeping Screen's bottom edge here
    // would double-pad the bottom (prompt 09 step 1).
    <Screen edges={["top"]}>
      <DiscoverHeader onPressSearch={() => router.push("/search")} />
      <GenreTabStrip value={tab} onChange={setTab} />

      {isLoading ? (
        <DiscoverSkeleton />
      ) : hasError ? (
        <DiscoverError onRetry={retry} />
      ) : books.length === 0 ? (
        <DiscoverEmptyScreen onRetry={retry} />
      ) : (
        <DiscoverContent books={books} onOpenBook={openBook} bottomPadding={tabBarHeight} />
      )}
    </Screen>
  );
}

type DiscoverContentProps = {
  books: BookCatalogRow[];
  onOpenBook: (id: string) => void;
  bottomPadding: number;
};

function DiscoverContent({ books, onOpenBook, bottomPadding }: DiscoverContentProps) {
  const hero = books[0];
  const pickedForYou = books;
  // NO BACKING METRIC — trending order is seed-array order reversed, not a
  // real signal (AGENTS.md Data Contract: no reads table exists).
  const trendingNow = useMemo(() => [...books].reverse(), [books]);
  const newAudioReleases = useMemo(
    () => books.filter((book) => (book.audio_count ?? 0) > 0),
    [books],
  );

  return (
    <ScrollView
      className="no-scrollbar"
      contentContainerStyle={{ gap: 24, paddingTop: 16, paddingBottom: bottomPadding + 16 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {hero ? <HeroCard book={hero} onPress={onOpenBook} /> : null}

      <CarouselSection
        title="Picked for You"
        books={pickedForYou}
        onPressBook={onOpenBook}
        onPressSeeAll={() => router.push("/search")}
        emptyLabel="We're still learning your taste — check back soon."
      />

      <CarouselSection
        title="Trending Now"
        books={trendingNow}
        onPressBook={onOpenBook}
        emptyLabel="Nothing trending yet."
      />

      <CarouselSection
        title="New Audio Releases"
        books={newAudioReleases}
        onPressBook={onOpenBook}
        emptyLabel="No audio releases yet."
      />
    </ScrollView>
  );
}
