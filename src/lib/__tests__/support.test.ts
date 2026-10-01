/// <reference types="jest" />

import {
  SUPPORT_MESSAGE_MAX,
  SUPPORT_PROBLEMS,
  SUPPORT_TOPICS,
  canSendMessage,
  destinationLine,
  sentLine,
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

describe("destinationLine and sentLine", () => {
  it("name Talebrim's address, never the reader's", () => {
    expect(destinationLine("support@talebrim.com")).toBe(
      "Your message goes to support@talebrim.com, with the app's version and your phone's model. We'll reply to the email on your account.",
    );
    expect(sentLine("support@talebrim.com")).toBe(
      "It's on its way to support@talebrim.com. We'll reply to the email on your account.",
    );
  });

  it("still say where the reply goes with no address set", () => {
    expect(destinationLine(null)).toBe(
      "Your message includes the app's version and your phone's model. We'll reply to the email on your account.",
    );
    expect(sentLine(null)).toBe("Thanks for writing to us. We'll reply to the email on your account.");
  });
});
