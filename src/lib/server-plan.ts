// The server's copy of the reader's plan — prompt 22a. No React, no hooks,
// no JSX (AGENTS.md § lib/).
//
// The app decides access from RevenueCat's SDK alone (`lib/revenuecat.ts`,
// the lock rule in `types/states.ts`). The server keeps its own copy, the
// `entitlements` mirror, for what it serves: a locked chapter's narration
// (the audio storage policy) and its text (the `chapters` policy), which it
// hands only to a reader its copy says may open them. RevenueCat's webhook
// keeps that copy true. This asks the server to check now, through the
// `sync-entitlement` Edge Function (the dashboard repo), when the app knows
// something the server may not yet: a purchase or a restore, a plan that has
// just turned active, a new session, or a chapter the plan opens that the
// server refused.
//
// The function asks RevenueCat itself, with the reader's Clerk token as the
// only input: nothing the app says about the plan is sent or trusted. Nothing
// here decides access, and nothing throws: a failure is "not checked", and
// whatever the server then refuses stays refused.
import { FunctionsHttpError } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

/** What the server found when it asked RevenueCat. */
export type ServerPlan = { active: boolean; expiresAt: string | null };

let pending: Promise<ServerPlan | null> | null = null;

function log(...args: unknown[]) {
  if (__DEV__) console.log("[server-plan]", ...args);
}

async function request(): Promise<ServerPlan | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ active?: unknown; expires_at?: unknown }>(
      "sync-entitlement",
      { method: "POST" },
    );
    if (error) {
      log("not checked", error instanceof FunctionsHttpError ? (error.context as Response).status : error.name);
      return null;
    }
    const plan: ServerPlan = {
      active: data?.active === true,
      expiresAt: typeof data?.expires_at === "string" ? data.expires_at : null,
    };
    log("checked", plan.active ? "active" : "none");
    return plan;
  } catch (error) {
    log("not checked", error);
    return null;
  }
}

/**
 * Asks the server to check the reader's plan with RevenueCat. Callers made
 * together share one request. Null when it couldn't be checked (offline, a
 * failure): never thrown.
 */
export function syncServerPlan(): Promise<ServerPlan | null> {
  pending ??= request().finally(() => {
    pending = null;
  });
  return pending;
}

/**
 * `syncServerPlan()`, waited for at most `ms`: null once that has passed, while
 * the request carries on. For a screen the reader is waiting on.
 */
export function syncServerPlanWithin(ms: number): Promise<ServerPlan | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    void syncServerPlan().then((plan) => {
      clearTimeout(timer);
      resolve(plan);
    });
  });
}
