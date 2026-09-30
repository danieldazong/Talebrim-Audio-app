import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const DOWNLOADS_STORAGE_KEY = "talebrim.store.downloads";

// The index of offline downloads — prompt 24. One entry per downloaded
// chapter, for the one account that downloaded them. The files themselves
// live in `downloads/` under `Paths.document` (`lib/downloads/files.ts`);
// this is what the app knows about them, including enough to open a chapter
// with no network and nothing cached (a cold start in airplane mode).
//
// Local to this phone: no table, no column, no sync across devices. Cleared
// with the files at sign-out (`clearUserScopedState()`), and on start when it
// names another account (`reconcileDownloads()`).
//
// Not registered with `store/hydration.ts`, as the notifications slice isn't:
// nothing routes on it. Whatever decides "downloaded or not" waits for it to
// rehydrate instead (`useDownloadsHydrated()`), so a cold start offline never
// shows a downloaded chapter as missing.
//
// Only `lib/downloads` writes it.

/** The chapter's narration on disk: `<chapterId>.<ext>`. */
export type DownloadedAudio = {
  /** The stored file's extension, without the dot ("m4a"). */
  ext: string;
  /** The file's real size on disk. */
  bytes: number;
  /** The `chapters.audio_path` it was downloaded from: a new path is a new recording. Never a signed URL. */
  path: string;
};

/** The chapter's text on disk: `<chapterId>.txt`. */
export type DownloadedText = {
  /** The file's real size on disk. */
  bytes: number;
  /** `script_text.length`, which parity maps positions against (`lib/parity/convert.ts`). */
  length: number;
};

/** The book, as the Downloads screen and an offline M5 or M6 show it. */
export type DownloadedBook = {
  id: string;
  title: string;
  author: string | null;
  /**
   * The public cover URL, resolved when the chapter was downloaded. Kept as
   * the URL, not the path: offline with nothing cached there is no CDN domain
   * to resolve a path with, and `expo-image`'s disk cache is keyed by URL.
   * Covers are never downloaded.
   */
  coverUrl: string | null;
};

export type DownloadEntry = {
  chapterId: string;
  book: DownloadedBook;
  number: number;
  title: string | null;
  /** The catalog's `has_text` and `has_audio` when it was downloaded: "downloaded" means every part it has. */
  hasText: boolean;
  hasAudio: boolean;
  /** The measured narration length; null when it was never measured. */
  durationSeconds: number | null;
  audio: DownloadedAudio | null;
  text: DownloadedText | null;
  /** The chapter's `updated_at` when it was downloaded, to notice an edit since. */
  updatedAt: string | null;
  /** When access was last confirmed online, in epoch milliseconds. Offline, it opens for 30 days after. */
  verifiedAt: number;
};

interface DownloadsState {
  /** The account these downloads belong to; null while there are none. */
  userId: string | null;
  chapters: Record<string, DownloadEntry>;
  /** Adds or replaces one chapter's entry, for `userId`. */
  put: (userId: string, entry: DownloadEntry) => void;
  remove: (chapterIds: readonly string[]) => void;
  /** Access confirmed online for these chapters at `at`. */
  markVerified: (chapterIds: readonly string[], at: number) => void;
  clear: () => void;
}

type PersistedDownloadsState = Pick<DownloadsState, "userId" | "chapters">;

export const useDownloadsStore = create<DownloadsState>()(
  persist(
    (set) => ({
      userId: null,
      chapters: {},
      put: (userId, entry) =>
        set((state) => ({
          // A different account's entries never sit beside this one's:
          // `reconcileDownloads()` wipes them first, and this is the backstop.
          userId,
          chapters: { ...(state.userId === userId ? state.chapters : {}), [entry.chapterId]: entry },
        })),
      remove: (chapterIds) =>
        set((state) => {
          const chapters = { ...state.chapters };
          for (const id of chapterIds) delete chapters[id];
          return { chapters, userId: Object.keys(chapters).length === 0 ? null : state.userId };
        }),
      markVerified: (chapterIds, at) =>
        set((state) => {
          const chapters = { ...state.chapters };
          for (const id of chapterIds) {
            const entry = chapters[id];
            if (entry) chapters[id] = { ...entry, verifiedAt: at };
          }
          return { chapters };
        }),
      clear: () => set({ userId: null, chapters: {} }),
    }),
    {
      name: DOWNLOADS_STORAGE_KEY,
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state): PersistedDownloadsState => ({ userId: state.userId, chapters: state.chapters }),
      // No shape change yet — here so a future one has somewhere to go.
      migrate: (persisted) => persisted as PersistedDownloadsState,
    },
  ),
);
