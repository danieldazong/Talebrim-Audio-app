// M3's hero carousel: which stories it shows, when that set may change, and
// where it moves next. No React, no hooks, no JSX — AGENTS.md § lib/.
import type { CarouselBookRow } from "@/types/catalog";

/** The newest stories the hero shows, per tab. */
export const HERO_COUNT = 5;

/** How long a slide stays before the next: long enough to read a title and decide. */
export const HERO_ADVANCE_MS = 7_000;

/**
 * The timer's slide: slow enough to read as a glide, not a jump. The screen
 * pairs it with a gentle start and a long soft landing.
 */
export const HERO_SLIDE_MS = 700;

/** Settling after a swipe: quicker, since the finger already set it moving. */
export const HERO_SETTLE_MS = 350;

/** A flick, in pages a second: faster than this moves a page however short the drag. */
export const HERO_FLICK_PAGES_PER_SECOND = 1.2;

/**
 * The ids of a tab's newest stories. The tab's query is already newest first
 * (`catalogByTabOptions()`, `created_at desc`); a row without an id is the
 * view's nullable typing, and is skipped.
 */
export function newestHeroIds(books: readonly CarouselBookRow[]): string[] {
  return books.flatMap((book) => (book.id === null ? [] : [book.id])).slice(0, HERO_COUNT);
}

/** The set on screen: its stories, for which tab's answer, taken at which focus. */
export type HeroSet = {
  ids: string[];
  /** The tab whose answer the ids came from; null before any. */
  tab: string | null;
  /** Which time Discover gained focus when they were taken. */
  focus: number;
};

export const NO_HERO_SET: HeroSet = { ids: [], tab: null, focus: -1 };

/**
 * The set to show next, or null to keep the one on screen. The set changes
 * when a tab's own answer arrives, when Discover regains focus, or when there
 * was nothing to show. Otherwise a story published while the reader looks on
 * waits for their next visit, so a slide never changes under their finger.
 * `tab` is null while the list is still the previous tab's placeholder.
 */
export function nextHeroSet(
  shown: HeroSet,
  latestIds: string[],
  tab: string | null,
  focus: number,
): HeroSet | null {
  if (tab === null) return null;
  const changed = tab !== shown.tab || focus !== shown.focus || (shown.ids.length === 0 && latestIds.length > 0);
  return changed ? { ids: latestIds, tab, focus } : null;
}

/**
 * The set's stories, from the current rows: an edit (title, cover) shows at
 * once, and a story unpublished meanwhile leaves.
 */
export function heroBooks(ids: readonly string[], books: readonly CarouselBookRow[]): CarouselBookRow[] {
  return ids.flatMap((id) => books.find((book) => book.id === id) ?? []);
}

/**
 * Where a swipe settles, in pages: the page it started on, or one either side.
 * A flick goes the way it was flicked; a slow drag goes to the nearest page.
 * `-1` and `count` are the copies of the last and the first page either end
 * of the track, which is what lets it loop without rewinding. `velocity` is
 * in pages a second, positive toward later pages.
 */
export function settlePage(start: number, position: number, velocity: number, count: number): number {
  "worklet";
  const nearest = Math.abs(velocity) > HERO_FLICK_PAGES_PER_SECOND
    ? velocity > 0
      ? Math.ceil(position)
      : Math.floor(position)
    : Math.round(position);
  const from = Math.round(start);
  return Math.min(Math.max(nearest, from - 1, -1), from + 1, count);
}

/** The real page for a place on the looped track: the copies at `-1` and `count` are the last and the first. */
export function wrapPage(page: number, count: number): number {
  "worklet";
  return count > 0 ? ((page % count) + count) % count : 0;
}
