// M11 Profile's pure parts — prompt 25. No React, no hooks, no JSX
// (AGENTS.md § lib/). Tested in `lib/__tests__/profile.test.ts`.
//
// The account card reads the reader's names, email and photo from Clerk,
// never `publicMetadata` or a role (AGENTS.md rule 4).

/** What the account card shows. */
export type AccountIdentity = {
  /** The full name, or the email for a reader with no name. */
  title: string;
  /** The email under the name; null when the email is the title. */
  email: string | null;
  /** One or two letters for the circle; empty with nothing to take them from. */
  initials: string;
  /**
   * The account's own photo (a Google sign-in brings its profile photo),
   * drawn over the initials; null for none (the owner's call, 2026-10-01).
   */
  photoUrl: string | null;
};

function firstLetter(word: string): string {
  const [letter = ""] = Array.from(word.trim());
  return letter.toLocaleUpperCase();
}

/**
 * The card's title, second line, initials and photo. A reader who signed in
 * with an email code has no name, so the email is the title, with no second
 * line.
 *
 * The photo is Clerk's `imageUrl`, only when `hasImage` says the account
 * really has one. Without one, Clerk still gives an `imageUrl`, for a
 * picture it generates: never shown (AGENTS.md § Image Generation Rules).
 */
export function accountIdentity(user: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl: string | null;
  hasImage: boolean;
}): AccountIdentity {
  const first = user.firstName?.trim() ?? "";
  const last = user.lastName?.trim() ?? "";
  const email = user.email?.trim() || null;
  const name = [first, last].filter(Boolean).join(" ");
  const photoUrl = user.hasImage ? user.imageUrl?.trim() || null : null;

  if (name) return { title: name, email, initials: firstLetter(first) + firstLetter(last), photoUrl };
  return { title: email ?? "Your account", email: null, initials: email ? firstLetter(email) : "", photoUrl };
}

/**
 * The plan pill: the entitlement once known; loading while it isn't; and
 * `unknown` once it failed, so a subscriber the app couldn't check never
 * reads "Free plan".
 */
export type PlanState = "ad_free" | "free" | "loading" | "unknown";

export function planState(entitlement: { active: boolean } | undefined, failed: boolean): PlanState {
  if (entitlement !== undefined) return entitlement.active ? "ad_free" : "free";
  return failed ? "unknown" : "loading";
}

/** The pill's words; null for no pill. */
export function planLabel(state: PlanState): string | null {
  if (state === "ad_free") return "Ad-Free";
  if (state === "free") return "Free plan";
  return null;
}

/** The account card as screen readers hear it, one element: "{title}, {email}, {plan}". */
export function accountSpokenLabel(identity: AccountIdentity, plan: string | null): string {
  return [identity.title, identity.email, plan].filter(Boolean).join(", ");
}

/** Sign out's confirmation: what it removes from this phone. */
export function signOutMessage(downloadedChapters: number): string {
  if (downloadedChapters <= 0) return "You can sign back in at any time.";
  if (downloadedChapters === 1) {
    return "The 1 downloaded chapter on this phone will be removed. You can download it again after you sign in.";
  }
  return `The ${downloadedChapters} downloaded chapters on this phone will be removed. You can download them again after you sign in.`;
}

/** Delete account's confirmation. A subscription that renews isn't cancelled by it. */
export function deleteAccountMessage(subscriptionRenews: boolean): string {
  const message =
    "Your account, reading places, My List and unlocked chapters are deleted, and downloads are removed from this phone. This can't be undone.";
  return subscriptionRenews
    ? `${message}\n\nYour Ad-Free subscription isn't cancelled by this: cancel it in Google Play first.`
    : message;
}

/**
 * What the `delete-account` function's answer means: 2xx deleted, 403 an
 * account the dashboard manages, anything else (or no answer) failed, and a
 * retry is safe.
 */
export type DeleteOutcome = "deleted" | "refused" | "failed";

export function deleteOutcome(status: number | null): DeleteOutcome {
  if (status !== null && status >= 200 && status < 300) return "deleted";
  return status === 403 ? "refused" : "failed";
}

/** The line under Delete account when it didn't run. */
export const DELETE_PROBLEMS: Record<"offline" | Exclude<DeleteOutcome, "deleted">, string> = {
  offline: "Connect to the internet to delete your account.",
  refused: "This account is managed from the Talebrim dashboard.",
  failed: "Couldn't delete your account. Check your connection and try again.",
};

/** M11's Restore, where billing can't run: M10's own line. */
export const BILLING_UNAVAILABLE = "Subscriptions are available in the Talebrim app for Android.";

/** M11's Restore, when it found an active subscription. */
export const RESTORE_SUCCEEDED = "Your Ad-Free subscription is restored.";

/**
 * The installed binary's version, from `expo-application` ("Version 1.0.0
 * (12)"), not `app.json`'s; the web preview has none. Null when the
 * platform reports none.
 */
export function versionLine(platform: string, version: string | null, build: string | null): string | null {
  if (platform === "web") return "Web preview";
  if (!version) return null;
  return build ? `Version ${version} (${build})` : `Version ${version}`;
}
