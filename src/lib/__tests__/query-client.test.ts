/// <reference types="jest" />

import { QueryClient } from "@tanstack/react-query";

import { shouldPersistQuery } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";

// What the persisted TanStack cache writes to disk (prompt 24 step 10):
// chapter text never, now that downloads keep it in files; the rest of
// `chapters` as before.

jest.mock("@react-native-community/netinfo", () =>
  jest.requireActual("@react-native-community/netinfo/jest/netinfo-mock.js"),
);
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const client = new QueryClient();

// Each query's garbage-collection timer would keep Jest running.
afterAll(() => client.clear());

function persisted(queryKey: readonly unknown[]): boolean {
  client.setQueryData(queryKey, "value");
  const query = client.getQueryCache().find({ queryKey, exact: true });
  if (query === undefined) throw new Error("no query");
  return shouldPersistQuery(query);
}

describe("shouldPersistQuery", () => {
  it("never persists chapter text, from the network or from a download's file", () => {
    expect(persisted(queryKeys.chapters.text("chapter-1"))).toBe(false);
    expect(persisted(queryKeys.downloads.text("user_a", "chapter-1"))).toBe(false);
  });

  it("still persists the rest of chapters", () => {
    expect(persisted(queryKeys.chapters.detail("chapter-1"))).toBe(true);
    expect(persisted(queryKeys.chapters.listByBook("book-1"))).toBe(true);
    expect(persisted(queryKeys.chapters.preview("book-1"))).toBe(true);
    expect(persisted(queryKeys.chapters.neighbours("book-1", 2))).toBe(true);
  });

  it("never persists a signed URL, RevenueCat's answers, or anything downloads read", () => {
    expect(persisted(queryKeys.audio.source("user_a", "chapter-1"))).toBe(false);
    expect(persisted(queryKeys.billing.entitlement("user_a"))).toBe(false);
    expect(persisted(queryKeys.downloads.rowsByBook("book-1"))).toBe(false);
  });

  it("persists the catalog", () => {
    expect(persisted(queryKeys.book.detail("book-1"))).toBe(true);
    expect(persisted(queryKeys.appSettings.all())).toBe(true);
  });
});
