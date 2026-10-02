/// <reference types="jest" />

import { QueryClient } from "@tanstack/react-query";

import { invalidateCatalog } from "@/lib/catalog-sync";
import { DISCOVER_TAB, NEW_TAB, genreTab, genresInUse, resolveTab, visibleTabs } from "@/lib/discover-tabs";
import { catalogByTabOptions, genresInUseOptions } from "@/lib/queries/catalog";
import { queryKeys } from "@/lib/query-keys";

const mockSelect = jest.fn();
const mockContains = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { from: (table: string) => ({ select: (columns: string) => mockSelect(table, columns) }) },
}));

type Answer = { data: unknown; error: unknown };

type FakeQuery = {
  order: () => FakeQuery;
  limit: () => FakeQuery;
  contains: (column: string, values: string[]) => FakeQuery;
  then: (resolve: (answer: Answer) => unknown) => Promise<unknown>;
};

/** A stand-in for Supabase's query builder: every step returns it, and awaiting it gives the answer. */
function answer(result: Answer): FakeQuery {
  const query: FakeQuery = {
    order: () => query,
    limit: () => query,
    contains: (column, values) => {
      mockContains(column, values);
      return query;
    },
    then: (resolve) => Promise.resolve(result).then(resolve),
  };
  return query;
}

const labels = (tabs: readonly { label: string }[]) => tabs.map((tab) => tab.label);

// M3's tab strip follows the genres of the published stories (2026-10-02): a
// genre has a tab while a story carries it, whether or not the app knew the
// genre before, and no tab opens onto nothing.

describe("genresInUse", () => {
  it("is the distinct genres across the books, sorted", () => {
    expect(genresInUse([{ genres: ["werewolf", "romance"] }, { genres: ["romance", "fantasy"] }])).toEqual([
      "fantasy",
      "romance",
      "werewolf",
    ]);
  });

  it("skips a book with no genres, and a blank genre", () => {
    expect(genresInUse([{ genres: null }, { genres: [] }, { genres: ["", "  ", "vampire"] }])).toEqual(["vampire"]);
  });

  it("is empty with no books", () => {
    expect(genresInUse([])).toEqual([]);
  });
});

describe("visibleTabs", () => {
  it("is Discover and New alone until a story carries a genre", () => {
    expect(visibleTabs([])).toEqual([DISCOVER_TAB, NEW_TAB]);
  });

  it("is Discover and New alone until the genres are known", () => {
    expect(visibleTabs(undefined)).toEqual([DISCOVER_TAB, NEW_TAB]);
  });

  it("adds a tab for every genre a story carries, and no other", () => {
    expect(labels(visibleTabs(["dark_romance", "romance"]))).toEqual(["Discover", "New", "Romance", "Dark Romance"]);
  });

  it("gives a genre the app has never heard of its own tab, spelled out", () => {
    const tabs = visibleTabs(["romance", "mafia_boss"]);
    expect(tabs[tabs.length - 1]).toEqual({ id: "genre:mafia_boss", label: "Mafia Boss", genre: "mafia_boss" });
  });

  it("keeps a known genre's own spelling", () => {
    expect(labels(visibleTabs(["sci_fi", "hfy"]))).toEqual(["Discover", "New", "Sci-fi", "HFY"]);
  });

  it("orders the frame's four first, then the dashboard's list, then new genres A to Z, whatever order they arrive in", () => {
    const arrived = ["zeta", "hfy", "vampire", "alpha", "werewolf", "dark_romance", "fantasy", "romance"];
    expect(labels(visibleTabs(arrived))).toEqual([
      "Discover",
      "New",
      "Werewolf",
      "Romance",
      "Vampire",
      "Fantasy",
      "Dark Romance",
      "HFY",
      "Alpha",
      "Zeta",
    ]);
  });

  it("filters each genre tab on its own slug, and Discover and New on none", () => {
    expect(visibleTabs(["romance", "mafia"]).map((tab) => tab.genre)).toEqual([null, null, "romance", "mafia"]);
  });

  it("gives every tab its own id, so a genre named like a fixed tab can't clash with it", () => {
    const ids = visibleTabs(["new", "discover", "romance"]).map((tab) => tab.id);
    expect(ids).toEqual(["discover", "new", "genre:romance", "genre:discover", "genre:new"]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("resolveTab", () => {
  const tabs = visibleTabs(["werewolf"]);

  it("keeps the reader's tab while it is listed", () => {
    expect(resolveTab(tabs, genreTab("werewolf").id)).toEqual(genreTab("werewolf"));
    expect(resolveTab(tabs, NEW_TAB.id)).toBe(NEW_TAB);
  });

  it("falls back to Discover when the tab's last story is gone", () => {
    expect(resolveTab(tabs, genreTab("vampire").id)).toBe(DISCOVER_TAB);
  });
});

describe("the strip's queries", () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  beforeEach(() => {
    mockSelect.mockReset();
    mockContains.mockReset();
  });
  afterEach(() => client.clear());

  it("reads the genres of the published books, through the catalogue view", async () => {
    mockSelect.mockReturnValue(
      answer({ data: [{ genres: ["werewolf", "romance"] }, { genres: ["werewolf"] }, { genres: null }], error: null }),
    );
    await expect(client.fetchQuery(genresInUseOptions())).resolves.toEqual(["romance", "werewolf"]);
    // `books_catalog` holds published books only, by construction.
    expect(mockSelect).toHaveBeenCalledWith("books_catalog", "genres");
  });

  it("turns a genre added in the dashboard into a tab, with no change to the app", async () => {
    mockSelect.mockReturnValue(
      answer({ data: [{ genres: ["romance"] }, { genres: ["mafia", "romance"] }], error: null }),
    );
    const inUse = await client.fetchQuery(genresInUseOptions());
    expect(labels(visibleTabs(inUse))).toEqual(["Discover", "New", "Romance", "Mafia"]);
  });

  it("fails when the read fails, so the strip keeps the answer it had", async () => {
    mockSelect.mockReturnValue(answer({ data: null, error: { message: "boom" } }));
    await expect(client.fetchQuery(genresInUseOptions())).rejects.toMatchObject({ message: "boom" });
  });

  it("is refreshed by every catalog change, so a published story's tab appears at once", async () => {
    client.setQueryData(genresInUseOptions().queryKey, ["werewolf"]);
    await invalidateCatalog(client, { bookIds: ["whispers"], chapterIds: [] });
    expect(client.getQueryState(queryKeys.catalog.genresInUse())?.isInvalidated).toBe(true);
  });

  it("lists a genre tab's stories by that genre, whether or not the app knew it", async () => {
    mockSelect.mockReturnValue(answer({ data: [], error: null }));
    const tab = genreTab("mafia");
    await client.fetchQuery(catalogByTabOptions(tab.id, tab.genre));
    expect(mockContains).toHaveBeenCalledWith("genres", ["mafia"]);
  });

  it("lists Discover and New without a genre filter", async () => {
    mockSelect.mockReturnValue(answer({ data: [], error: null }));
    await client.fetchQuery(catalogByTabOptions(DISCOVER_TAB.id, DISCOVER_TAB.genre));
    expect(mockContains).not.toHaveBeenCalled();
  });
});
