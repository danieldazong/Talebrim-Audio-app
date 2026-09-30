/// <reference types="jest" />

import { onboardingFromAccount, sameGenres } from "@/lib/onboarding";

// M2's answer on the account (2026-09-30): Clerk's `unsafeMetadata`, which
// the reader can write, so it is read as untrusted.

describe("onboardingFromAccount", () => {
  it("reads the genres an account saved, and an empty list for Skip", () => {
    expect(onboardingFromAccount({ onboarding: { genres: ["romance", "werewolf"] } })).toEqual(["romance", "werewolf"]);
    expect(onboardingFromAccount({ onboarding: { genres: [] } })).toEqual([]);
  });

  it("is null for an account that never finished M2", () => {
    expect(onboardingFromAccount({})).toBeNull();
    expect(onboardingFromAccount(undefined)).toBeNull();
    expect(onboardingFromAccount(null)).toBeNull();
    expect(onboardingFromAccount({ onboarding: null })).toBeNull();
    expect(onboardingFromAccount({ onboarding: { genres: "romance" } })).toBeNull();
    expect(onboardingFromAccount({ something: "else" })).toBeNull();
  });

  it("drops anything that isn't a known genre slug", () => {
    expect(onboardingFromAccount({ onboarding: { genres: ["romance", "Mafia", 3, null, "vampire"] } })).toEqual([
      "romance",
      "vampire",
    ]);
  });
});

describe("sameGenres", () => {
  it("compares in any order", () => {
    expect(sameGenres(["romance", "vampire"], ["vampire", "romance"])).toBe(true);
    expect(sameGenres([], [])).toBe(true);
    expect(sameGenres(["romance"], ["romance", "vampire"])).toBe(false);
    expect(sameGenres(["romance"], ["vampire"])).toBe(false);
  });
});
