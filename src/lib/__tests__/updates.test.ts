/// <reference types="jest" />

import { QueryClient } from "@tanstack/react-query";

import { invalidateCatalog } from "@/lib/catalog-sync";
import type { LibraryItem } from "@/lib/queries/library-items";
import type { UpdateRow } from "@/lib/queries/updates";
import { queryKeys } from "@/lib/query-keys";
import {
  buildUpdates,
  latestSeen,
  newestUpdateAt,
  seenAtFromAccount,
  unreadCount,
  updateAge,
  updateChapterLabel,
} from "@/lib/updates";
import { useUpdatesStore } from "@/store/updates-store";

jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// The Updates inbox behind Discover's bell (2026-09-30).

const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

function listItem(bookId: string, addedAt: string, title = `Book ${bookId}`): LibraryItem {
  return {
    id: `item-${bookId}`,
    book_id: bookId,
    created_at: addedAt,
    book: { id: bookId, title, author: null, cover_path: `${bookId}/cover.webp`, chapter_count: 10, audio_count: 0 },
  };
}

function row(id: string, bookId: string, number: number, createdAt: string, overrides: Partial<UpdateRow> = {}): UpdateRow {
  return {
    id,
    book_id: bookId,
    number,
    title: `Title ${number}`,
    access: "free",
    has_text: true,
    has_audio: false,
    created_at: createdAt,
    ...overrides,
  };
}

const MY_LIST = [listItem("whispers", "2026-09-30T13:50:00Z"), listItem("eclipse", "2026-09-01T10:00:00Z")];

describe("buildUpdates", () => {
  it("lists chapters of books on My List added since the book was followed, newest first", () => {
    const items = buildUpdates(
      [
        row("w6", "whispers", 6, "2026-09-30T13:53:59Z"),
        row("w8", "whispers", 8, "2026-09-30T19:54:22Z"),
        row("e2", "eclipse", 2, "2026-09-20T09:00:00Z"),
        // Before Whispers was followed: not an update for this reader.
        row("w5", "whispers", 5, "2026-09-29T08:00:00Z"),
        // Not on My List (removed since the fetch).
        row("x1", "other", 1, "2026-09-30T19:00:00Z"),
        // Nothing in it yet.
        row("w9", "whispers", 9, "2026-09-30T19:55:00Z", { has_text: false, has_audio: false }),
      ],
      MY_LIST,
      null,
    );
    expect(items.map((item) => item.chapterId)).toEqual(["w8", "w6", "e2"]);
    expect(items[0]).toMatchObject({ bookTitle: "Book whispers", coverPath: "whispers/cover.webp", number: 8 });
  });

  it("marks as new only what was added after the reader last looked", () => {
    const rows = [row("w8", "whispers", 8, "2026-09-30T19:54:22Z"), row("w6", "whispers", 6, "2026-09-30T13:53:59Z")];
    expect(buildUpdates(rows, MY_LIST, null).map((item) => item.isNew)).toEqual([true, true]);
    expect(buildUpdates(rows, MY_LIST, at("2026-09-30T14:00:00Z")).map((item) => item.isNew)).toEqual([true, false]);
    // Seen up to the newest chapter itself: nothing new.
    expect(unreadCount(buildUpdates(rows, MY_LIST, at("2026-09-30T19:54:22Z")))).toBe(0);
  });

  it("drops rows the view types as null", () => {
    const items = buildUpdates(
      [row("a", "whispers", 7, "2026-09-30T14:00:00Z", { id: null }), row("b", "whispers", 7, "not a time")],
      MY_LIST,
      null,
    );
    expect(items).toEqual([]);
  });
});

describe("seen", () => {
  it("moves to the newest chapter's server time, never the phone's clock", () => {
    const items = buildUpdates(
      [row("w6", "whispers", 6, "2026-09-30T13:53:59Z"), row("w8", "whispers", 8, "2026-09-30T19:54:22Z")],
      MY_LIST,
      null,
    );
    expect(newestUpdateAt(items)).toBe(at("2026-09-30T19:54:22Z"));
    expect(newestUpdateAt([])).toBeNull();
  });

  it("reads the account's copy as untrusted", () => {
    expect(seenAtFromAccount({ updates: { seenAt: "2026-09-30T19:54:22.000Z" } })).toBe(at("2026-09-30T19:54:22Z"));
    expect(seenAtFromAccount({ onboarding: { genres: [] } })).toBeNull();
    expect(seenAtFromAccount({ updates: { seenAt: "yesterday" } })).toBeNull();
    expect(seenAtFromAccount({ updates: { seenAt: 5 } })).toBeNull();
    expect(seenAtFromAccount(undefined)).toBeNull();
  });

  it("takes the later of the phone's and the account's", () => {
    expect(latestSeen(null, null)).toBeNull();
    expect(latestSeen(5, null)).toBe(5);
    expect(latestSeen(null, 7)).toBe(7);
    expect(latestSeen(5, 7)).toBe(7);
  });

  it("never moves the phone's copy back, and starts again for another account", () => {
    const store = useUpdatesStore.getState();
    store.clear();
    store.markSeen("user_a", 100);
    store.markSeen("user_a", 50);
    expect(useUpdatesStore.getState()).toMatchObject({ userId: "user_a", seenAt: 100 });
    store.markSeen("user_b", 20);
    expect(useUpdatesStore.getState()).toMatchObject({ userId: "user_b", seenAt: 20 });
    store.clear();
    expect(useUpdatesStore.getState()).toMatchObject({ userId: null, seenAt: null });
  });
});

describe("words", () => {
  it("names the chapter", () => {
    expect(updateChapterLabel(8, "chrus")).toBe("Chapter 8: chrus");
    expect(updateChapterLabel(8, "  ")).toBe("Chapter 8");
    expect(updateChapterLabel(8, null)).toBe("Chapter 8");
  });

  it("says how long ago, and a phone clock behind the server's reads as just now", () => {
    const now = at("2026-09-30T20:00:00Z");
    expect(updateAge(now + 30_000, now, null).shown).toBe("Just now");
    expect(updateAge(now - 30_000, now, null).shown).toBe("Just now");
    expect(updateAge(now - 5 * MINUTE, now, null)).toEqual({ shown: "5 min ago", spoken: "5 minutes ago" });
    expect(updateAge(now - 61 * MINUTE, now, null)).toEqual({ shown: "1 h ago", spoken: "1 hour ago" });
    expect(updateAge(now - 30 * 60 * MINUTE, now, null).shown).toBe("Yesterday");
    expect(updateAge(now - 4 * 24 * 60 * MINUTE, now, null).shown).toBe("4 days ago");
    expect(updateAge(now - 10 * 24 * 60 * MINUTE, now, "20 Sept 2026").shown).toBe("20 Sept 2026");
  });
});

describe("catalog sync", () => {
  it("marks every account's Updates stale on any catalog change, so the bell's dot comes at once", async () => {
    const client = new QueryClient();
    const key = queryKeys.updates.byBooks("user_a", ["whispers"]);
    client.setQueryData(key, []);
    await invalidateCatalog(client, { bookIds: ["whispers"], chapterIds: ["w9"] });
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    client.clear();
  });
});
