// Asset-state discriminated union — AGENTS.md § TypeScript Rules ("prefer
// discriminated unions over optional-field soup for asset states").
//
// `chapters.access` (and `chapters_catalog.access`) is only `free | locked`
// in the database. The four states below are computed PER USER at read
// time — there is no "unlocked for this user" column on `chapters`, by
// design: that is per-user state and lives in the `unlocks` table
// (`types/reader.ts`, read through `lib/queries/unlocks.ts`).
//
// A chapter's own `access` decides whether it is free, never its number
// (owner, 2026-09-30). `app_settings.free_chapters_at_start` is only the
// access the dashboard gives a chapter when it is created; the owner can
// lock any chapter afterwards, chapter 1 included. The audio storage policy
// (`can_play_audio()`, dashboard migration 20260930120000) applies the same
// rule on the server.
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
  | "locked"
  /** A download opened offline more than 30 days after its last online check (prompt 24 step 8). */
  | "expired";

/**
 * What M6 Now Playing shows (prompt 17 step 11). Exactly one at a time;
 * `hooks/use-now-playing.ts` derives it from the chapter queries.
 */
export type PlayerStatus =
  | "ready"
  | "loading"
  | "failed"
  | "offline"
  | "unavailable"
  | "no-audio"
  | "locked"
  /** A download opened offline more than 30 days after its last online check (prompt 24 step 8). */
  | "expired";

export interface ResolveChapterStateInput {
  /** `chapters.access` / `chapters_catalog.access` for this chapter. */
  access: Enums<"chapter_access">;
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
   * True while the reader's `ad_free` entitlement is active
   * (`entitlementOptions()`, from RevenueCat's `customerInfo` only). A
   * subscribed reader's chapters are all accessible. Never an `unlocks` row,
   * so a lapsed subscription needs no revocation.
   */
  isSubscribed?: boolean;
  /**
   * True if this chapter is downloaded: every part it has is stored on this
   * device for offline use (the downloads index, `store/downloads-store.ts`).
   * Local-device state, never a table.
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
    isCurrentlyReading = false,
    isUnlockedByUser = false,
    isSubscribed = false,
    isDownloaded = false,
  } = input;

  const isAccessible = access === "free" || isUnlockedByUser || isSubscribed;

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
  /** Chapter ids from the reader's `unlocks` rows. */
  unlockedChapterIds: ReadonlySet<string>;
  /** The reader's `ad_free` entitlement is active. */
  isSubscribed: boolean;
};

/** M9's per-row flags, passed through to `resolveChapterState()`. */
export type ChapterRowFlags = Pick<ResolveChapterStateInput, "isCurrentlyReading" | "isDownloaded">;

/**
 * `resolveChapterState()` for a `chapters_catalog` row. A null `access` is
 * the view's nullable typing, never a free chapter, so it is locked. M4, M5,
 * M6 and M9 all call this, so that rule lives in one place. Only M9 passes
 * `flags`.
 */
export function chapterStateFor(
  chapter: LockableChapter,
  inputs: ChapterLockInputs,
  flags: ChapterRowFlags = {},
): ChapterState {
  if (chapter.access === null) return { kind: "locked" };

  return resolveChapterState({
    access: chapter.access,
    isUnlockedByUser: inputs.unlockedChapterIds.has(chapter.id),
    isSubscribed: inputs.isSubscribed,
    isCurrentlyReading: flags.isCurrentlyReading,
    isDownloaded: flags.isDownloaded,
  });
}

/**
 * A chapter the dashboard locked that this reader opens only through the
 * subscription (Talebrim Unlimited): locked by its own `access`, not unlocked
 * on its own (an `unlocks` row), and the reader subscribes. M9's and M4's
 * rows mark it "Unlimited", so the dashboard's locks stay visible to a
 * subscriber, the owner testing included (Decisions — 2026-10-01, "Dashboard
 * locks, seen by a subscriber"). A null `access` is locked for everyone, so it
 * is never one.
 */
export function openedByPlan(chapter: LockableChapter, inputs: ChapterLockInputs): boolean {
  return chapter.access === "locked" && inputs.isSubscribed && !inputs.unlockedChapterIds.has(chapter.id);
}

/**
 * Whether a chapter the server refused is worth asking the server to check
 * the reader's plan first (prompt 22a step 8). The server serves a locked
 * chapter's narration and text from its own copy of the plan, which can be
 * behind RevenueCat's SDK on the phone (a webhook not yet arrived). So only a
 * chapter that opens through Talebrim Unlimited alone (`openedByPlan()`),
 * once per open (`asked`), and never while the lock inputs are unknown
 * (`null`). A free or unlocked chapter's refusal has nothing to do with the
 * plan.
 */
export function askServerAboutPlan(chapter: LockableChapter, inputs: ChapterLockInputs | null, asked: boolean): boolean {
  return !asked && inputs !== null && openedByPlan(chapter, inputs);
}

/**
 * A text read that came back with nothing although the chapter's catalog row
 * says it has text (prompt 22a step 8): the server withheld the row (its
 * `chapters` policy returns a locked chapter only to a reader it knows may open
 * it), or the text went since the row was read. Never "no text": M5 checks
 * again, then fails with Retry. `undefined` is a read not answered yet.
 */
export function textWithheld(hasText: boolean | null, text: string | null | undefined): boolean {
  return hasText === true && text === null;
}

const NO_UNLOCKS: ReadonlySet<string> = new Set();

/**
 * A chapter's lock state, or null while that can't be told yet. Unlocks and
 * the subscription only ever open a locked chapter, so a free one waits for
 * neither, and either one opens it as soon
 * as it is known to: a subscriber never waits for their unlocks. Undefined
 * is "not known yet", never "no", so a subscriber never sees a paywall flash
 * while the entitlement loads. M5, M6, the player and Library call this.
 */
export function lockStateFor(
  chapter: LockableChapter,
  unlockedChapterIds: ReadonlySet<string> | undefined,
  isSubscribed: boolean | undefined,
): ChapterState | null {
  const withNeither = chapterStateFor(chapter, { unlockedChapterIds: NO_UNLOCKS, isSubscribed: false });
  if (withNeither.kind !== "locked") return withNeither;

  const opened = chapterStateFor(chapter, {
    unlockedChapterIds: unlockedChapterIds ?? NO_UNLOCKS,
    isSubscribed: isSubscribed === true,
  });
  if (opened.kind !== "locked") return opened;
  // Still locked by what is known so far: final only once both are known.
  return unlockedChapterIds === undefined || isSubscribed === undefined ? null : opened;
}
