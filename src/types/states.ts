// Asset-state discriminated union — AGENTS.md § TypeScript Rules ("prefer
// discriminated unions over optional-field soup for asset states").
//
// `chapters.access` (and `chapters_catalog.access`) is only `free | locked`
// in the database. The four states below are computed PER USER at read
// time — there is no "unlocked for this user" column on `chapters`, by
// design: that is per-user state and lives in the `unlocks` table
// (`types/reader.ts`, read through `lib/queries/unlocks.ts`).
import type { Enums } from "@/types/database";

export type ChapterState =
  | { kind: "locked" }
  | { kind: "unlocked" }
  | { kind: "downloaded" }
  | { kind: "reading" };

/**
 * What M5 Reader shows (prompt 14 step 18). Exactly one at a time;
 * `hooks/use-chapter-reader.ts` derives it from the chapter queries.
 */
export type ReaderStatus =
  | "ready"
  | "loading"
  | "failed"
  | "offline"
  | "unavailable"
  | "no-text"
  | "locked";

export interface ResolveChapterStateInput {
  /** `chapters.access` / `chapters_catalog.access` for this chapter. */
  access: Enums<"chapter_access">;
  /** 1-based position of this chapter within its book (`chapters_catalog.number`). */
  chapterNumber: number;
  /**
   * Live `app_settings.free_chapters_at_start`. Never hardcode this — the
   * live value governs, and the migration default must not be trusted
   * (AGENTS.md Data Contract). Callers fetch it via
   * `lib/queries/app-settings.ts`.
   */
  freeChaptersAtStart: number;
  /**
   * True if this chapter is the one the reader is on — the chapter of their
   * most recent `reading_positions` row for this book, or the one open in the
   * reader/player right now.
   */
  isCurrentlyReading?: boolean;
  /**
   * True if one of the reader's `unlocks` rows (`unlocksByUserOptions()`)
   * has this chapter's id. Permanent grants only — a subscription is checked
   * against the RevenueCat entitlement, never through this flag's table.
   */
  isUnlockedByUser?: boolean;
  /**
   * True if this chapter's audio and/or text is stored on this device for
   * offline use. Local-device state, never a table; always `false` until the
   * download feature (AGENTS.md § Audio Rules) lands.
   */
  isDownloaded?: boolean;
}

/**
 * Pure function: chapter row + settings + optional per-user inputs → the
 * one state that should render for this chapter.
 *
 * Precedence: "reading" (current position) beats "downloaded" beats
 * unlocked-ness, because M9's row states are each drawn distinctly and a
 * chapter can only show one (AGENTS.md M9). A locked chapter can still be
 * the one "currently reading" via a paywall preview, so this checks
 * unlock/free status before applying the reading override — a locked
 * chapter never reports "reading" or "downloaded".
 */
export function resolveChapterState(
  input: ResolveChapterStateInput,
): ChapterState {
  const {
    access,
    chapterNumber,
    freeChaptersAtStart,
    isCurrentlyReading = false,
    isUnlockedByUser = false,
    isDownloaded = false,
  } = input;

  const isFreeByPosition = chapterNumber <= freeChaptersAtStart;
  const isAccessible =
    access === "free" || isFreeByPosition || isUnlockedByUser;

  if (!isAccessible) {
    return { kind: "locked" };
  }

  if (isCurrentlyReading) {
    return { kind: "reading" };
  }

  if (isDownloaded) {
    return { kind: "downloaded" };
  }

  return { kind: "unlocked" };
}

/** A chapter row that passed its id and number null checks. */
export type LockableChapter = {
  id: string;
  number: number;
  /** Nullable because `chapters_catalog` types every column so. */
  access: Enums<"chapter_access"> | null;
};

export type ChapterLockInputs = {
  /** Live `free_chapters_at_start` from `reader_settings()`. Never hardcoded. */
  freeChaptersAtStart: number;
  /** Chapter ids from the reader's `unlocks` rows. */
  unlockedChapterIds: ReadonlySet<string>;
};

/**
 * `resolveChapterState()` for a `chapters_catalog` row. A null `access` is
 * the view's nullable typing, never a free chapter, so it is locked. M4 and
 * M5 both call this, so that rule lives in one place.
 */
export function chapterStateFor(
  chapter: LockableChapter,
  inputs: ChapterLockInputs,
): ChapterState {
  if (chapter.access === null) return { kind: "locked" };

  return resolveChapterState({
    access: chapter.access,
    chapterNumber: chapter.number,
    freeChaptersAtStart: inputs.freeChaptersAtStart,
    isUnlockedByUser: inputs.unlockedChapterIds.has(chapter.id),
  });
}
