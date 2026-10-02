// M11's Help: a message to support@nouvrix.com, written in the app (the
// owner's request, 2026-10-01). The pure parts: the topics, the limits, what
// the `contact-support` function's answer means, and the words. No React, no
// hooks, no JSX (AGENTS.md § lib/). Tested in `lib/__tests__/support.test.ts`.
//
// The function (the dashboard repo) keeps its own copy of the topics and the
// length limit: change both together.

export const SUPPORT_TOPICS = [
  { value: "account", label: "Account" },
  { value: "reading", label: "Reading & listening" },
  { value: "downloads", label: "Downloads" },
  { value: "subscription", label: "Subscription" },
  { value: "other", label: "Something else" },
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number]["value"];

/** The longest message the function accepts. */
export const SUPPORT_MESSAGE_MAX = 4000;

/** The counter under the message shows from here, so it never nags a short message. */
export const SUPPORT_COUNTER_FROM = 3500;

/** Something to send, within the limit. */
export function canSendMessage(message: string): boolean {
  const length = message.trim().length;
  return length > 0 && length <= SUPPORT_MESSAGE_MAX;
}

/**
 * What the app tells the function about itself, for the reply. Never a name
 * or an email: the function reads those from the account.
 */
export type SupportContext = {
  appVersion: string | null;
  appBuild: string | null;
  platform: string;
  osVersion: string | null;
  deviceModel: string | null;
};

/** The request's body. No topic chosen is "Something else". */
export function supportPayload(topic: SupportTopic | null, message: string, context: SupportContext) {
  return { topic: topic ?? "other", message: message.trim(), context };
}

/**
 * What the function's answer means: 2xx sent; 429 too many messages for now;
 * anything else, or no answer, failed. A retry is always safe.
 */
export type SupportOutcome = "sent" | "rate_limited" | "failed";

export function supportOutcome(status: number | null): SupportOutcome {
  if (status !== null && status >= 200 && status < 300) return "sent";
  return status === 429 ? "rate_limited" : "failed";
}

/** The line above Send when a message can't go. */
export const SUPPORT_PROBLEMS: Record<"offline" | Exclude<SupportOutcome, "sent">, string> = {
  offline: "You're offline. Your message stays here until you send it.",
  rate_limited: "You've sent a few messages in a short time. Please wait a little, then try again.",
  failed: "Couldn't send your message. Check your connection and try again.",
};

// The form's words, short and plain at the owner's request (2026-10-01,
// "The support email, cleaned up"). No address on screen, neither the support
// inbox's nor the reader's: replies go to the email on the reader's account,
// which the function reads from Clerk.

/** Above the form. */
export const SUPPORT_INTRO = "We're here to help. Tell us what's going on.";

/** Under the message: what happens next (the owner's wording, 2026-10-01). */
export const SUPPORT_NOTE = "Our support team will get back to you by email as soon as possible.";

/** Under "Message sent". */
export const SUPPORT_SENT = "Thanks for reaching out. We'll reply to the email on your account.";
