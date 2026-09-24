import { useAuth } from "@clerk/expo";
import { useQuery } from "@tanstack/react-query";

import { appSettingsOptions } from "@/lib/queries/app-settings";
import { bookDetailOptions } from "@/lib/queries/book";
import { chapterPreviewOptions, firstAudioChapterOptions } from "@/lib/queries/chapters";
import { unlocksByUserOptions } from "@/lib/queries/unlocks";
import { chapterStateFor, type ChapterLockInputs, type ChapterState } from "@/types/states";

/** A preview row that passed the null checks, with its lock state resolved. */
export type PreviewChapter = {
  id: string;
  number: number;
  title: string | null;
  hasAudio: boolean;
  audioDurationSeconds: number | null;
  state: ChapterState;
};

/** Where Read or Listen goes. Only "ready" opens anything. */
export type ChapterTarget =
  /** Still loading. */
  | { kind: "pending" }
  /** Something it depends on failed to load. Never treated as free. */
  | { kind: "failed" }
  /** Nothing to open: the book has no chapters, or no narration. */
  | { kind: "none" }
  | { kind: "ready"; chapterId: string; number: number; locked: boolean };

export type ChaptersSection =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; rows: PreviewChapter[] };

/** Failed and not retrying — while a retry runs, it counts as loading again. */
function hasFailed(query: { isError: boolean; isFetching: boolean }): boolean {
  return query.isError && !query.isFetching;
}

/**
 * Everything M4 reads, and the per-user lock state derived from it.
 *
 * The book, the preview rows, the settings and the unlocks run in parallel.
 * The Listen target waits for the book, because it runs only when
 * `audio_count > 0`. Rows and targets resolve only once settings AND unlocks
 * have loaded, so a chapter never renders locked and then opens, and a failed
 * read never falls through to free.
 */
export function useBookDetail(bookId: string) {
  const { userId } = useAuth();

  const book = useQuery(bookDetailOptions(bookId));
  const hasAudio = (book.data?.audio_count ?? 0) > 0;

  const preview = useQuery(chapterPreviewOptions(bookId));
  const firstAudio = useQuery({ ...firstAudioChapterOptions(bookId), enabled: hasAudio });
  const settings = useQuery(appSettingsOptions());
  // Signed-in route, so `userId` is set. RLS returns only this reader's rows,
  // and nothing writes them until the paywall's server function exists.
  const unlocks = useQuery({ ...unlocksByUserOptions(userId ?? ""), enabled: Boolean(userId) });

  const lockInputs: ChapterLockInputs | null =
    settings.data && unlocks.data
      ? {
          freeChaptersAtStart: settings.data.free_chapters_at_start,
          unlockedChapterIds: new Set(unlocks.data.map((unlock) => unlock.chapter_id)),
        }
      : null;

  const sectionQueries = [preview, settings, unlocks];
  let chapters: ChaptersSection;
  if (preview.data && lockInputs) {
    chapters = {
      status: "ready",
      rows: preview.data.flatMap((row) => {
        if (row.id === null || row.number === null) return [];
        const { id, number } = row;
        return [
          {
            id,
            number,
            title: row.title,
            hasAudio: row.has_audio === true,
            audioDurationSeconds: row.audio_duration_seconds,
            state: chapterStateFor({ id, number, access: row.access }, lockInputs),
          },
        ];
      }),
    };
  } else if (sectionQueries.some(hasFailed)) {
    chapters = { status: "error" };
  } else {
    chapters = { status: "loading" };
  }

  // TODO(parity): resume position. Nothing writes reading positions yet, so
  // Read always starts at the first preview row.
  let read: ChapterTarget;
  if (book.data?.chapter_count === 0) {
    read = { kind: "none" };
  } else if (chapters.status === "error") {
    read = { kind: "failed" };
  } else if (chapters.status === "loading") {
    read = { kind: "pending" };
  } else {
    const first = chapters.rows[0];
    read = first
      ? { kind: "ready", chapterId: first.id, number: first.number, locked: first.state.kind === "locked" }
      : { kind: "none" };
  }

  let listen: ChapterTarget;
  const target = firstAudio.data;
  if (!hasAudio) {
    listen = { kind: "none" };
  } else if (target === undefined || lockInputs === null) {
    listen = [firstAudio, settings, unlocks].some(hasFailed) ? { kind: "failed" } : { kind: "pending" };
  } else if (target === null || target.id === null || target.number === null) {
    listen = { kind: "none" };
  } else {
    const { id, number } = target;
    listen = {
      kind: "ready",
      chapterId: id,
      number,
      locked: chapterStateFor({ id, number, access: target.access }, lockInputs).kind === "locked",
    };
  }

  function retryChapters() {
    for (const query of [...sectionQueries, firstAudio]) {
      if (query.isError) void query.refetch();
    }
  }

  return {
    book,
    chapters,
    retryChapters,
    read,
    listen,
    publicCdnDomain: settings.data?.public_cdn_domain ?? null,
  };
}
