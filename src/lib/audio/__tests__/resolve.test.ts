/// <reference types="jest" />

import { onlineManager } from "@tanstack/react-query";

import { checkChapter } from "@/lib/audio/resolve";
import { entitlementFrom } from "@/lib/billing";
import { entitlementOptions } from "@/lib/queries/billing";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterDetailOptions } from "@/lib/queries/chapters";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { queryClient } from "@/lib/query-client";
import type { BookDetailRow, ChapterDetailRow } from "@/types/catalog";

// Autoplay, next and previous, and the player's check of its loaded chapter
// read a chapter's row fresh online (2026-09-30): the cache can hold one from
// before the owner locked the chapter in the dashboard.

const USER = "user_a";
const CHAPTER = "chapter-1";

const CACHED_FREE: ChapterDetailRow = {
  id: CHAPTER,
  book_id: "book-1",
  number: 1,
  title: "One",
  access: "free",
  has_text: true,
  has_audio: true,
  audio_duration_seconds: 600,
};

const BOOK: BookDetailRow = {
  id: "book-1",
  title: "Book",
  author: null,
  synopsis: null,
  short_description: null,
  genres: [],
  maturity: "mature_17",
  cover_path: null,
  chapter_count: 9,
  audio_count: 3,
  total_duration_seconds: null,
};

// The live row, as the dashboard left it: locked.
const mockServerRow = jest.fn((): ChapterDetailRow => ({ ...CACHED_FREE, access: "locked" }));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: mockServerRow(), error: null }) }) }),
    }),
  },
}));

jest.mock("@/lib/revenuecat", () => ({
  getEntitlement: () => Promise.resolve(jest.requireActual("@/lib/billing").entitlementFrom(null)),
  getCurrentOffering: () => Promise.resolve(null),
}));

jest.mock("@/lib/downloads/local", () => ({ downloadFor: () => null, downloadsFor: () => [] }));

// The real client pulls in NetInfo's native module; these need only a cache.
jest.mock("@/lib/query-client", () => {
  const { QueryClient } = jest.requireActual("@tanstack/react-query");
  return { queryClient: new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: false } } }) };
});

beforeEach(() => {
  queryClient.clear();
  mockServerRow.mockClear();
  // Everything but the chapter's row is fresh in the cache.
  queryClient.setQueryData(chapterDetailOptions(CHAPTER).queryKey, CACHED_FREE);
  queryClient.setQueryData(bookDetailOptions("book-1").queryKey, BOOK);
  queryClient.setQueryData(unlocksByUserOptions(USER).queryKey, []);
  queryClient.setQueryData(entitlementOptions(USER).queryKey, entitlementFrom(null));
});

afterEach(() => onlineManager.setOnline(true));

afterAll(() => queryClient.clear());

it("online, reads the chapter's row again even while the cached one is fresh, and a lock holds", async () => {
  await expect(checkChapter(USER, CHAPTER)).resolves.toEqual({ kind: "locked", chapterId: CHAPTER });
  expect(mockServerRow).toHaveBeenCalledTimes(1);
  // The screens reading the same key see the lock too.
  expect(queryClient.getQueryData(chapterDetailOptions(CHAPTER).queryKey)).toMatchObject({ access: "locked" });
});

it("online, plays a chapter the owner freed, whatever the cache held", async () => {
  const cachedLocked: ChapterDetailRow = { ...CACHED_FREE, access: "locked" };
  queryClient.setQueryData(chapterDetailOptions(CHAPTER).queryKey, cachedLocked);
  mockServerRow.mockReturnValueOnce(CACHED_FREE);
  await expect(checkChapter(USER, CHAPTER)).resolves.toMatchObject({ kind: "playable", row: { id: CHAPTER } });
});

it("offline, lets the cached row stand, as nothing newer can be had", async () => {
  onlineManager.setOnline(false);
  await expect(checkChapter(USER, CHAPTER)).resolves.toMatchObject({ kind: "playable" });
  expect(mockServerRow).not.toHaveBeenCalled();
});
