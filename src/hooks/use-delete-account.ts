import { useClerk } from "@clerk/expo";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useIsOnline } from "@/hooks/use-downloads";
import { useEntitlement } from "@/hooks/use-entitlement";
import { flushAnalyticsWithin, resetAnalytics, track } from "@/lib/analytics";
import { releaseAudio, stopForSignOut } from "@/lib/audio/player";
import { confirmDestructive } from "@/lib/confirm";
import { clearParityQueue, flushWithin } from "@/lib/parity/writer";
import { DELETE_PROBLEMS, deleteAccountMessage, deleteOutcome, type DeleteOutcome } from "@/lib/profile";
import { clearUserScopedState } from "@/lib/session";
import { supabase } from "@/lib/supabase";

/**
 * How long deletion waits for a queued reading position, and queued
 * analytics, to reach their servers first, as sign-out does.
 */
const DELETE_FLUSH_MS = 2_000;

type DeleteProblem = keyof typeof DELETE_PROBLEMS;

function log(...args: unknown[]) {
  if (__DEV__) console.log("[delete-account]", ...args);
}

/**
 * The `delete-account` Edge Function (the dashboard repo). The client sends
 * the reader's Clerk token as the bearer, as its `accessToken` does for every
 * request; the function deletes the reader's rows, then the Clerk user.
 */
async function requestDeletion(): Promise<DeleteOutcome> {
  try {
    const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
    if (!error) return "deleted";
    const status = error instanceof FunctionsHttpError ? (error.context as Response).status : null;
    log("refused or failed", status);
    return deleteOutcome(status);
  } catch (error) {
    log("failed", error);
    return "failed";
  }
}

/**
 * M11's Delete account — prompt 25 step 9. The app's one deletion path.
 *
 * Asks first. Before the call, the player pauses and the reading place is
 * sent, so nothing is lost if the deletion then fails, and queued analytics
 * go too, so none of them reaches PostHog after the server has deleted the
 * reader's person there. Then the parity queue and the player go, so nothing
 * writes a row after the server has deleted them. Deleted: analytics starts
 * over under a new anonymous id before `account_deleted` is sent, then the
 * app signs out and clears the phone as sign-out does, and the auth gate
 * shows M1. Refused or failed: the reader stays signed in, a line says why,
 * and a retry is safe.
 */
export function useDeleteAccount() {
  const { signOut } = useClerk();
  const online = useIsOnline();
  const entitlement = useEntitlement();
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<DeleteProblem | null>(null);
  // A second tap lands before the re-render that disables the link.
  const busy = useRef(false);

  async function deleteNow() {
    if (busy.current) return;
    if (!onlineManager.isOnline()) {
      setProblem("offline");
      return;
    }
    busy.current = true;
    setDeleting(true);
    setProblem(null);

    stopForSignOut();
    await Promise.all([flushWithin(DELETE_FLUSH_MS), flushAnalyticsWithin(DELETE_FLUSH_MS)]);
    clearParityQueue();
    releaseAudio();

    const outcome = await requestDeletion();
    if (outcome !== "deleted") {
      busy.current = false;
      setDeleting(false);
      setProblem(outcome);
      return;
    }

    // The account's PostHog person is gone: an event under its id would make
    // it again. A new anonymous id counts the deletion without a person.
    resetAnalytics();
    track("account_deleted", {});
    try {
      await signOut();
    } catch (error) {
      // The session died with the user, so Clerk may refuse to end it. Its
      // next request then finds no session, and the app lands on M1 anyway.
      log("sign-out after deletion failed", error);
    } finally {
      await clearUserScopedState();
    }
  }

  function confirmDelete() {
    if (busy.current) return;
    if (!onlineManager.isOnline()) {
      setProblem("offline");
      return;
    }
    setProblem(null);
    const renews = entitlement.data?.active === true && entitlement.data.willRenew;
    confirmDestructive({
      title: "Delete your account?",
      message: deleteAccountMessage(renews),
      action: "Delete account",
      onConfirm: () => void deleteNow(),
    });
  }

  // "Connect to the internet" holds only while it is true.
  const shown = problem === "offline" && online ? null : problem;
  return { deleting, message: shown === null ? null : DELETE_PROBLEMS[shown], confirmDelete };
}
