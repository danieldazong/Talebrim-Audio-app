import { useUser } from "@clerk/expo";
import { useEffect } from "react";

import { onboardingFromAccount, sameGenres } from "@/lib/onboarding";
import { useOnboardingStore } from "@/store/onboarding-store";

/**
 * Whether the signed-in reader is past M2: on this phone, or on their
 * account (`lib/onboarding.ts`). The routing gate reads this, so an account
 * that finished M2 anywhere never sees it again, not even for a frame before
 * `useOnboardingSync()` copies the answer onto the phone.
 */
export function useOnboardingComplete(): boolean {
  const onPhone = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const { user } = useUser();
  return onPhone || onboardingFromAccount(user?.unsafeMetadata) !== null;
}

/**
 * Keeps the phone's answer and the account's in step. Mounted once, in the
 * root navigator.
 * - Signed in, not done on this phone, done on the account: the account's
 *   genres come onto the phone (a sign-in after sign-out, a reinstall, a new
 *   phone).
 * - Done on this phone, and the account lacks it or holds other genres: the
 *   phone's answer is written to the account. That also records a reader who
 *   finished M2 before 2026-09-30. Offline, it fails quietly and is tried
 *   again when Clerk next updates the user, or on the next start.
 * Sign-out clears the phone's copy only after Clerk has signed out, so this
 * never writes one account's genres under another.
 */
export function useOnboardingSync(): void {
  const { isSignedIn, user } = useUser();
  const onPhone = useOnboardingStore((state) => state.hasCompletedOnboarding);
  const genres = useOnboardingStore((state) => state.selectedGenres);

  useEffect(() => {
    if (!isSignedIn || !user) return;
    const saved = onboardingFromAccount(user.unsafeMetadata);
    if (!onPhone) {
      if (saved !== null) useOnboardingStore.getState().completeOnboarding(saved);
      return;
    }
    if (saved !== null && sameGenres(saved, genres)) return;
    // Deep-merged: nothing else in `unsafeMetadata` changes. Once saved, the
    // updated user holds the same genres and this stops.
    user.updateMetadata({ unsafeMetadata: { onboarding: { genres: [...genres] } } }).catch((error: unknown) => {
      if (__DEV__) console.warn("[onboarding] couldn't save to the account; trying again later", error);
    });
  }, [isSignedIn, user, onPhone, genres]);
}
