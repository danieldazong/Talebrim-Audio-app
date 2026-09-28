// New-chapter alerts' pure rules — prompt 23a. No React, no hooks, no JSX
// (AGENTS.md § lib/), and no SDK: `lib/push.ts` talks to the phone, this
// decides. Tested in `lib/__tests__/alerts.test.ts`.
import { isUuid } from "@/lib/ids";

/** Where the alerts sheet was opened from: analytics' `from`. */
export const ALERTS_FROM = ["my_list", "bell"] as const;
export type AlertsFrom = (typeof ALERTS_FROM)[number];

export function isAlertsFrom(value: unknown): value is AlertsFrom {
  return ALERTS_FROM.some((from) => from === value);
}

/**
 * The system's notification permission, as the sheet needs it: granted, can
 * still be asked, or blocked (denied, and Android won't show its prompt
 * again: only its settings can turn it back on).
 */
export type AlertsPermission = "granted" | "can_ask" | "blocked";

export function permissionFrom(status: { granted: boolean; canAskAgain: boolean }): AlertsPermission {
  if (status.granted) return "granted";
  return status.canAskAgain ? "can_ask" : "blocked";
}

/**
 * Whether the first My List add opens the sheet by itself: only where push
 * runs, only while alerts are off, never when the system has blocked them
 * (the sheet could only point to settings, unasked), and only once per
 * account. After "Not now", "Notify me" or closing the sheet, the app never
 * opens it on its own again. The bell always opens it: the reader asked.
 */
export function shouldAskForAlerts(state: {
  available: boolean;
  enabled: boolean;
  answered: boolean;
  permission: AlertsPermission;
}): boolean {
  return state.available && !state.enabled && !state.answered && state.permission !== "blocked";
}

/**
 * The book an alert names. The server sends `book_id` as its only data; a
 * malformed or missing one opens nothing.
 */
export function alertBookId(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null;
  const bookId = (data as { book_id?: unknown }).book_id;
  return isUuid(bookId) ? bookId : null;
}
