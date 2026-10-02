/// <reference types="jest" />

import {
  SUPPORT_INTRO,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_NOTE,
  SUPPORT_PROBLEMS,
  SUPPORT_SENT,
  SUPPORT_TOPICS,
  canSendMessage,
  supportOutcome,
  supportPayload,
  type SupportContext,
} from "@/lib/support";

// M11's Help form (2026-10-01). The `contact-support` function is proven
// over HTTP, and the screen on the phone.

const CONTEXT: SupportContext = {
  appVersion: "1.0.0",
  appBuild: "1",
  platform: "android",
  osVersion: "12",
  deviceModel: "itel A662LM",
};

describe("SUPPORT_TOPICS", () => {
  it("matches the function's topics, in the form's order", () => {
    expect(SUPPORT_TOPICS.map((topic) => topic.value)).toEqual(["account", "reading", "downloads", "subscription", "other"]);
  });
});

describe("canSendMessage", () => {
  it("needs some text", () => {
    expect(canSendMessage("")).toBe(false);
    expect(canSendMessage("   \n  ")).toBe(false);
    expect(canSendMessage("Help")).toBe(true);
  });

  it("stops at the function's limit, counting the trimmed text", () => {
    expect(canSendMessage("x".repeat(SUPPORT_MESSAGE_MAX))).toBe(true);
    expect(canSendMessage(`  ${"x".repeat(SUPPORT_MESSAGE_MAX)}  `)).toBe(true);
    expect(canSendMessage("x".repeat(SUPPORT_MESSAGE_MAX + 1))).toBe(false);
  });
});

describe("supportPayload", () => {
  it("sends the trimmed message, the topic and the context", () => {
    expect(supportPayload("downloads", "  It stopped at 30%.  ", CONTEXT)).toEqual({
      topic: "downloads",
      message: "It stopped at 30%.",
      context: CONTEXT,
    });
  });

  it("files a message with no topic under Something else", () => {
    expect(supportPayload(null, "Hello", CONTEXT).topic).toBe("other");
  });
});

describe("supportOutcome", () => {
  it("reads 2xx as sent, 429 as rate limited, and anything else as failed", () => {
    expect(supportOutcome(200)).toBe("sent");
    expect(supportOutcome(429)).toBe("rate_limited");
    expect(supportOutcome(400)).toBe("failed");
    expect(supportOutcome(401)).toBe("failed");
    expect(supportOutcome(500)).toBe("failed");
    expect(supportOutcome(502)).toBe("failed");
    expect(supportOutcome(null)).toBe("failed");
  });

  it("has a line for every way a message can't go", () => {
    expect(SUPPORT_PROBLEMS.offline).toMatch(/offline/);
    expect(SUPPORT_PROBLEMS.rate_limited).toMatch(/wait/);
    expect(SUPPORT_PROBLEMS.failed).toMatch(/try again/);
  });
});

describe("the form's words", () => {
  it("say what happens next and where the reply goes, without naming any address", () => {
    expect(SUPPORT_INTRO).toBe("We're here to help. Tell us what's going on.");
    expect(SUPPORT_NOTE).toBe("Our support team will get back to you by email as soon as possible.");
    expect(SUPPORT_SENT).toBe("Thanks for reaching out. We'll reply to the email on your account.");
    for (const line of [SUPPORT_INTRO, SUPPORT_NOTE, SUPPORT_SENT]) expect(line).not.toContain("@");
  });
});
