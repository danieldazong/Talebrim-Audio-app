import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Share } from "react-native";

import { BookChapters } from "@/components/book/book-chapters";
import { BOOK_CONTENT_TOP, BookHeader, BookTopBar } from "@/components/book/book-header";
import {
  BookDetailSkeleton,
  BookError,
  BookNotFound,
} from "@/components/book/book-states";
import { BookSynopsis } from "@/components/book/book-synopsis";
import { Screen } from "@/components/ui";
import { useBookDetail, type ChapterTarget } from "@/hooks/use-book-detail";
import { resolveCoverUrl } from "@/lib/covers";
import { isUuid } from "@/lib/ids";
import type { BookDetailRow } from "@/types/catalog";

// M4 Story Detail — AGENTS.md M4, prompt 12.
//
// A pushed stack route outside (tabs), receiving only the book id. No mini
// player (AGENTS.md M4), by construction: it lives in the tab shell, which
// this route is pushed over.

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

// TODO: add a link once public book URLs exist. There is no public book URL
// (talebrim.com is the admin dashboard) and no deep-link scheme yet.
async function shareBook(book: BookDetailRow) {
  const title = book.title ?? "Untitled";
  try {
    await Share.share({ title, message: book.author ? `${title} by ${book.author}` : title });
  } catch (error) {
    if (__DEV__) console.warn("[share]", error);
  }
}

export default function BookDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();

  // A stale or hand-typed deep link. PostgREST errors on a malformed uuid
  // rather than returning no rows, so don't ask — it is simply not found.
  if (!isUuid(id)) {
    return (
      <Screen>
        <BookNotFound onBack={goBack} />
        <BookTopBar onBack={goBack} onShare={null} />
      </Screen>
    );
  }

  return <BookDetail bookId={id} />;
}

function BookDetail({ bookId }: { bookId: string }) {
  const { book, chapters, retryChapters, read, listen, publicCdnDomain } = useBookDetail(bookId);
  const data = book.data;
  // Hidden when both are null (or empty).
  const synopsis = data?.synopsis || data?.short_description || null;

  function openTarget(target: ChapterTarget, pathname: "/reader/[chapterId]" | "/player/[chapterId]") {
    if (target.kind !== "ready") return;
    // TODO(paywall): a locked target opens M5a here. It must never navigate.
    if (target.locked) return;
    router.push({ pathname, params: { chapterId: target.chapterId } });
  }

  function openChapter(chapterId: string) {
    router.push({ pathname: "/reader/[chapterId]", params: { chapterId } });
  }

  return (
    <Screen>
      {data ? (
        <ScrollView
          className="no-scrollbar"
          contentContainerStyle={{ gap: 24, paddingTop: BOOK_CONTENT_TOP, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          <BookHeader
            book={data}
            coverUrl={publicCdnDomain === null ? null : resolveCoverUrl(publicCdnDomain, data.cover_path)}
            read={read}
            listen={listen}
            onRead={() => openTarget(read, "/reader/[chapterId]")}
            onListen={() => openTarget(listen, "/player/[chapterId]")}
          />

          {synopsis ? <BookSynopsis text={synopsis} /> : null}

          <BookChapters
            chapterCount={data.chapter_count}
            section={chapters}
            onRetry={retryChapters}
            onOpenChapter={openChapter}
            onSeeAll={() => router.push({ pathname: "/chapters/[bookId]", params: { bookId } })}
          />
        </ScrollView>
      ) : data === null ? (
        // Unpublished or invisible to this reader — including a book the
        // dashboard unpublishes while it is open, since catalog sync refetches it.
        <BookNotFound onBack={goBack} />
      ) : book.isError && !book.isFetching ? (
        <BookError onRetry={() => void book.refetch()} />
      ) : (
        <BookDetailSkeleton />
      )}

      <BookTopBar onBack={goBack} onShare={data ? () => void shareBook(data) : null} />
    </Screen>
  );
}
