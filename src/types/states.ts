// Asset-state discriminated union — AGENTS.md § TypeScript Rules ("prefer
// discriminated unions over optional-field soup for asset states").
//
// `chapters.access` (and `chapters_catalog.access`) is only `free | locked`
// in the database. The four states below are computed PER USER at read
// time — there is no "unlocked for this user" column, by design (that's
// per-user state and belongs in the not-yet-existing `unlocks` table, see
// `types/unbacked.ts`).
import type { Enums } from "@/types/database";

export type ChapterState =
  | { kind: "locked" }
  | { kind: "unlocked" }
  | { kind: "downloaded" }
  | { kind: "reading" };

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
  /** True if this chapter is the one currently open in the reader/player. */
  isCurrentlyReading?: boolean;
  /**
   * True if an `unlocks` row (rewarded ad, per Phase 2) covers this chapter
   * for the current user. Always `false` until that table exists.
   */
  isUnlockedByUser?: boolean;
  /**
   * True if this chapter's audio and/or text is cached for offline use.
   * Always `false` until the download feature (AGENTS.md § Audio Rules)
   * lands.
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
