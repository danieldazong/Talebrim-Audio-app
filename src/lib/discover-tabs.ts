// M3's Discover tab strip: which entries it lists, and in what order. No React,
// no hooks, no JSX — AGENTS.md § lib/.
import { GENRES } from "@/data/genres";
import { genreLabel } from "@/lib/labels";

/**
 * One entry in the strip. "Discover" and "New" list every story; a genre tab
 * lists the stories whose `books.genres` carries its slug.
 */
export type DiscoverTab = {
  /** Stable: "discover", "new" or "genre:<slug>". Names the tab in the screen's state and in the query cache. */
  id: string;
  /** What the reader sees. */
  label: string;
  /** The `books.genres` slug it filters on; null for "Discover" and "New". */
  genre: string | null;
};

/** Where every state lands: the first tab, which the strip always lists. */
export const DISCOVER_TAB: DiscoverTab = { id: "discover", label: "Discover", genre: null };

export const NEW_TAB: DiscoverTab = { id: "new", label: "New", genre: null };

/** The tab for one genre slug. A slug the app doesn't know yet is spelled out by `genreLabel()`. */
export function genreTab(slug: string): DiscoverTab {
  return { id: `genre:${slug}`, label: genreLabel(slug), genre: slug };
}

// The order of the genre tabs: the four the M3 frame draws first, in its
// order, then the rest of the dashboard's list in its own (`data/genres.ts`),
// then any genre the app doesn't know yet, A to Z. A fixed order rather than a
// count, so a tab never moves under the reader's finger as stories come and go.
const LEAD_GENRES: readonly string[] = ["werewolf", "romance", "vampire", "fantasy"];
const GENRE_ORDER: readonly string[] = [
  ...LEAD_GENRES,
  ...GENRES.map((genre) => genre.value).filter((slug) => !LEAD_GENRES.includes(slug)),
];

function genreRank(slug: string): number {
  const index = GENRE_ORDER.indexOf(slug);
  return index === -1 ? GENRE_ORDER.length : index;
}

function byTabOrder(a: string, b: string): number {
  // A plain comparison, not `localeCompare`: the order is the same on every phone.
  return genreRank(a) - genreRank(b) || (a < b ? -1 : a > b ? 1 : 0);
}

/**
 * The distinct genre slugs across the published books, less any blank one.
 * Sorted, so an unchanged catalogue gives an identical answer and a refetch
 * renders nothing.
 */
export function genresInUse(books: readonly { genres: readonly string[] | null }[]): string[] {
  const slugs = books.flatMap((book) => book.genres ?? []).filter((slug) => slug.trim() !== "");
  return [...new Set(slugs)].sort();
}

/**
 * The tabs the strip lists: "Discover" and "New", then one tab for every genre
 * a published story carries, and no other. A genre appears with its first
 * story, whether or not the app knew it before, and goes with its last, so no
 * tab opens onto nothing. While the genres aren't known yet (`undefined`:
 * loading, or offline with nothing cached) only the first two show.
 *
 * Each genre tab filters on its slug by exact containment, as
 * `catalogByTabOptions()` does, so a listed tab always has a story to show.
 */
export function visibleTabs(inUse: readonly string[] | undefined): DiscoverTab[] {
  return [DISCOVER_TAB, NEW_TAB, ...[...(inUse ?? [])].sort(byTabOrder).map(genreTab)];
}

/**
 * The tab to show: the reader's choice while it is listed, else "Discover". A
 * genre's last story can be unpublished while the reader is on its tab.
 */
export function resolveTab(tabs: readonly DiscoverTab[], selectedId: string): DiscoverTab {
  return tabs.find((tab) => tab.id === selectedId) ?? DISCOVER_TAB;
}
