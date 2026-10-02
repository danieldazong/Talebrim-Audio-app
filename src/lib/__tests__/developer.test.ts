import type * as Developer from "@/lib/developer";

// Who sees the development tools: the owner's account, in a development build,
// and nobody else (Decisions — 2026-10-02, "Development tools belong to the
// owner's account"). The owner's address is a setting,
// `EXPO_PUBLIC_DEVELOPER_EMAIL`, never written in this public repo, so every
// address here is a stand-in.

const globals = globalThis as unknown as { __DEV__: boolean };
const originalSetting = process.env.EXPO_PUBLIC_DEVELOPER_EMAIL;

/** Stands in for the owner's address. */
const OWNER = "the.owner@example.com";

/** A fresh copy of the module, reading `setting` as the owner's address (or none). */
function load(setting: string | undefined): typeof Developer.isDeveloperAccount {
  if (setting === undefined) delete process.env.EXPO_PUBLIC_DEVELOPER_EMAIL;
  else process.env.EXPO_PUBLIC_DEVELOPER_EMAIL = setting;
  let developer: typeof Developer | undefined;
  jest.isolateModules(() => {
    developer = jest.requireActual<typeof Developer>("@/lib/developer");
  });
  if (developer === undefined) throw new Error("not loaded");
  return developer.isDeveloperAccount;
}

afterAll(() => {
  if (originalSetting === undefined) delete process.env.EXPO_PUBLIC_DEVELOPER_EMAIL;
  else process.env.EXPO_PUBLIC_DEVELOPER_EMAIL = originalSetting;
});

describe("isDeveloperAccount", () => {
  it("is the owner's account, ignoring case and surrounding spaces", () => {
    const isDeveloperAccount = load(OWNER);
    expect(isDeveloperAccount(OWNER, true)).toBe(true);
    expect(isDeveloperAccount("The.Owner@Example.com", true)).toBe(true);
    expect(isDeveloperAccount(`  ${OWNER}\n`, true)).toBe(true);
  });

  it("reads the setting the same way, ignoring its case and spaces", () => {
    expect(load("  The.Owner@EXAMPLE.com \n")(OWNER, true)).toBe(true);
  });

  it("is nobody when the setting is missing or blank", () => {
    for (const setting of [undefined, "", "   "]) {
      const isDeveloperAccount = load(setting);
      expect(isDeveloperAccount(OWNER, true)).toBe(false);
      // A blank address would otherwise equal a blank setting.
      expect(isDeveloperAccount("   ", true)).toBe(false);
    }
  });

  it("is no other account: not another reader, not an admin, not a lookalike", () => {
    const isDeveloperAccount = load(OWNER);
    for (const email of [
      // Stand-ins for other readers and for the dashboard's two admins: no real
      // account's address belongs in the repo.
      "reader@example.com",
      "talebrim.reader.b+clerk_test@example.com",
      "admin.one@example.com",
      "admin.two@example.com",
      // Near misses: another Clerk account, even where the mail provider would
      // deliver to the same inbox (a "+tag", a dropped dot, an alias domain).
      "the.owner+1@example.com",
      "theowner@example.com",
      "xthe.owner@example.com",
      "the.owner@example.com.au",
      "the.owner@example.org",
      `${OWNER}@evil.com`,
      `evil@${OWNER}`,
    ]) {
      expect(isDeveloperAccount(email, true)).toBe(false);
    }
  });

  it("is nobody without an email, or with one Clerk has not verified", () => {
    const isDeveloperAccount = load(OWNER);
    expect(isDeveloperAccount(null, true)).toBe(false);
    expect(isDeveloperAccount(undefined, true)).toBe(false);
    expect(isDeveloperAccount("", true)).toBe(false);
    expect(isDeveloperAccount(OWNER, false)).toBe(false);
  });

  it("is nobody in a release build, the owner included", () => {
    const isDeveloperAccount = load(OWNER);
    const wasDev = globals.__DEV__;
    globals.__DEV__ = false;
    try {
      expect(isDeveloperAccount(OWNER, true)).toBe(false);
    } finally {
      globals.__DEV__ = wasDev;
    }
    expect(isDeveloperAccount(OWNER, true)).toBe(true);
  });
});
