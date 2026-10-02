/// <reference types="jest" />

import { TOKEN_MAX_AGE_MS, tokenIssuedAtMs, tokenNeedsReplacing } from "@/lib/token-age";

// The owner's phone on 2026-10-02: its clock 59 seconds behind the server's,
// so a 60-second token looked to have nearly two minutes left.

function base64url(value: string): string {
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function tokenIssuedAt(seconds: number): string {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ sub: "user_x", iat: seconds, exp: seconds + 60 }));
  return `${header}.${payload}.signature`;
}

const SERVER_NOW_MS = 1_790_000_000_000;
const PHONE_SLOW_MS = -59_000;
const PHONE_NOW_MS = SERVER_NOW_MS + PHONE_SLOW_MS;

describe("tokenIssuedAtMs", () => {
  it("reads the issue time from the token's payload", () => {
    expect(tokenIssuedAtMs(tokenIssuedAt(1_790_000_000))).toBe(1_790_000_000_000);
  });

  it("is null for anything it can't read", () => {
    expect(tokenIssuedAtMs("not a token")).toBeNull();
    expect(tokenIssuedAtMs("a.%%%.c")).toBeNull();
    expect(tokenIssuedAtMs(`a.${base64url(JSON.stringify({ sub: "x" }))}.c`)).toBeNull();
    expect(tokenIssuedAtMs(`a.${base64url("null")}.c`)).toBeNull();
  });
});

describe("tokenNeedsReplacing", () => {
  it("keeps a token issued moments ago, however slow the phone's clock", () => {
    const issued = SERVER_NOW_MS - 5_000;
    expect(tokenNeedsReplacing(issued, PHONE_SLOW_MS, PHONE_NOW_MS)).toBe(false);
  });

  it("replaces one the server is about to refuse, though by the phone's clock it has a minute left", () => {
    const issued = SERVER_NOW_MS - 50_000;
    // By the phone's clock this token was issued 9 seconds ago.
    expect(PHONE_NOW_MS - issued).toBe(-9_000);
    expect(tokenNeedsReplacing(issued, PHONE_SLOW_MS, PHONE_NOW_MS)).toBe(true);
  });

  it("draws the line at TOKEN_MAX_AGE_MS by the server's clock", () => {
    expect(tokenNeedsReplacing(SERVER_NOW_MS - TOKEN_MAX_AGE_MS, PHONE_SLOW_MS, PHONE_NOW_MS)).toBe(false);
    expect(tokenNeedsReplacing(SERVER_NOW_MS - TOKEN_MAX_AGE_MS - 1, PHONE_SLOW_MS, PHONE_NOW_MS)).toBe(true);
  });

  it("works the same for a phone that runs fast", () => {
    const fast = 120_000;
    expect(tokenNeedsReplacing(SERVER_NOW_MS - 5_000, fast, SERVER_NOW_MS + fast)).toBe(false);
    expect(tokenNeedsReplacing(SERVER_NOW_MS - 45_000, fast, SERVER_NOW_MS + fast)).toBe(true);
  });

  it("replaces a token until the phone's clock has been measured, or when the token has no issue time", () => {
    expect(tokenNeedsReplacing(SERVER_NOW_MS, null, PHONE_NOW_MS)).toBe(true);
    expect(tokenNeedsReplacing(null, PHONE_SLOW_MS, PHONE_NOW_MS)).toBe(true);
  });
});
