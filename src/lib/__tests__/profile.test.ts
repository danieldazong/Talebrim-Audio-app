/// <reference types="jest" />

import { alertsStatusWords } from "@/lib/alerts";
import {
  accountIdentity,
  accountSpokenLabel,
  deleteAccountMessage,
  deleteOutcome,
  planLabel,
  planState,
  signOutMessage,
  versionLine,
} from "@/lib/profile";

// M11 Profile's pure parts (prompt 25). The `delete-account` function is
// proven over HTTP, and the screen on the phone.

const EMAIL = "reader@example.com";
const PHOTO = "https://img.clerk.com/photo";

/** Clerk's user as the card reads it: no photo unless a test gives one. */
function user(fields: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  imageUrl?: string | null;
  hasImage?: boolean;
}) {
  return { imageUrl: null, hasImage: false, ...fields };
}

describe("accountIdentity", () => {
  it("titles a full name, with the email beneath and both initials", () => {
    expect(accountIdentity(user({ firstName: "Valerie", lastName: "Sterling", email: EMAIL }))).toEqual({
      title: "Valerie Sterling",
      email: EMAIL,
      initials: "VS",
      photoUrl: null,
    });
  });

  it("titles a first name alone, with one initial", () => {
    expect(accountIdentity(user({ firstName: "Valerie", lastName: null, email: EMAIL }))).toEqual({
      title: "Valerie",
      email: EMAIL,
      initials: "V",
      photoUrl: null,
    });
    expect(accountIdentity(user({ firstName: null, lastName: "Sterling", email: EMAIL }))).toEqual({
      title: "Sterling",
      email: EMAIL,
      initials: "S",
      photoUrl: null,
    });
  });

  it("titles the email when there is no name, with no second line", () => {
    const expected = { title: EMAIL, email: null, initials: "R", photoUrl: null };
    expect(accountIdentity(user({ firstName: null, lastName: null, email: EMAIL }))).toEqual(expected);
    expect(accountIdentity(user({ firstName: "", lastName: "  ", email: EMAIL }))).toEqual(expected);
  });

  it("trims surrounding spaces", () => {
    expect(accountIdentity(user({ firstName: "  valerie ", lastName: " sterling  ", email: `  ${EMAIL} ` }))).toEqual({
      title: "valerie sterling",
      email: EMAIL,
      initials: "VS",
      photoUrl: null,
    });
  });

  it("takes one-letter names whole", () => {
    expect(accountIdentity(user({ firstName: "a", lastName: "b", email: EMAIL }))).toEqual({
      title: "a b",
      email: EMAIL,
      initials: "AB",
      photoUrl: null,
    });
  });

  it("takes a whole first character, never half of one", () => {
    expect(accountIdentity(user({ firstName: "Élodie", lastName: "Øster", email: EMAIL })).initials).toBe("ÉØ");
  });

  it("has words, and no initials, with neither a name nor an email", () => {
    expect(accountIdentity(user({ firstName: null, lastName: null, email: null }))).toEqual({
      title: "Your account",
      email: null,
      initials: "",
      photoUrl: null,
    });
  });

  it("shows the account's own photo, a Google sign-in's, over the initials", () => {
    const identity = accountIdentity(
      user({ firstName: "Valerie", lastName: "Sterling", email: EMAIL, imageUrl: PHOTO, hasImage: true }),
    );
    expect(identity.photoUrl).toBe(PHOTO);
    // The initials stay, for while the photo loads and if it can't.
    expect(identity.initials).toBe("VS");
  });

  it("shows a photo for an account with no name too", () => {
    expect(accountIdentity(user({ firstName: null, lastName: null, email: EMAIL, imageUrl: PHOTO, hasImage: true })).photoUrl).toBe(
      PHOTO,
    );
  });

  it("never shows the picture Clerk generates for an account without a photo", () => {
    expect(accountIdentity(user({ firstName: "Reader", lastName: "B", email: EMAIL, imageUrl: PHOTO, hasImage: false })).photoUrl).toBeNull();
  });

  it("shows no photo when the URL is missing or blank", () => {
    expect(accountIdentity(user({ firstName: "A", lastName: "B", email: EMAIL, imageUrl: null, hasImage: true })).photoUrl).toBeNull();
    expect(accountIdentity(user({ firstName: "A", lastName: "B", email: EMAIL, imageUrl: "  ", hasImage: true })).photoUrl).toBeNull();
  });
});

describe("planState and planLabel", () => {
  it("reads an active entitlement as Unlimited, the plan's name without Talebrim", () => {
    expect(planState({ active: true }, false)).toBe("ad_free");
    expect(planLabel("ad_free")).toBe("Unlimited");
  });

  it("reads one known not to be active as the free plan", () => {
    expect(planState({ active: false }, false)).toBe("free");
    expect(planLabel("free")).toBe("Free plan");
  });

  it("is loading until known, with no words", () => {
    expect(planState(undefined, false)).toBe("loading");
    expect(planLabel("loading")).toBeNull();
  });

  it("shows nothing once it failed: never Free plan for a subscriber it couldn't check", () => {
    expect(planState(undefined, true)).toBe("unknown");
    expect(planLabel("unknown")).toBeNull();
  });

  it("keeps a known answer through a later failure", () => {
    expect(planState({ active: true }, true)).toBe("ad_free");
  });
});

describe("accountSpokenLabel", () => {
  it("reads the card as one element", () => {
    const identity = accountIdentity(user({ firstName: "Valerie", lastName: "Sterling", email: EMAIL }));
    expect(accountSpokenLabel(identity, "Free plan")).toBe(`Valerie Sterling, ${EMAIL}, Free plan`);
    expect(accountSpokenLabel(identity, null)).toBe(`Valerie Sterling, ${EMAIL}`);
  });

  it("never says the email twice", () => {
    const identity = accountIdentity(user({ firstName: null, lastName: null, email: EMAIL }));
    expect(accountSpokenLabel(identity, "Unlimited")).toBe(`${EMAIL}, Unlimited`);
  });
});

describe("signOutMessage", () => {
  it("says nothing is removed with no downloads", () => {
    expect(signOutMessage(0)).toBe("You can sign back in at any time.");
  });

  it("counts one chapter", () => {
    expect(signOutMessage(1)).toBe(
      "The 1 downloaded chapter on this phone will be removed. You can download it again after you sign in.",
    );
  });

  it("counts several chapters", () => {
    expect(signOutMessage(12)).toBe(
      "The 12 downloaded chapters on this phone will be removed. You can download them again after you sign in.",
    );
  });
});

describe("deleteAccountMessage", () => {
  it("says what goes, and that it can't be undone", () => {
    expect(deleteAccountMessage(false)).toBe(
      "Your account, reading places, My List and unlocked chapters are deleted, and downloads are removed from this phone. This can't be undone.",
    );
  });

  it("tells a subscriber whose plan renews to cancel it first", () => {
    expect(deleteAccountMessage(true)).toMatch(
      /This can't be undone\.\n\nYour Talebrim Unlimited subscription isn't cancelled by this: cancel it in Google Play first\.$/,
    );
  });
});

describe("deleteOutcome", () => {
  it("reads 2xx as deleted, 403 as refused, and anything else as failed", () => {
    expect(deleteOutcome(200)).toBe("deleted");
    expect(deleteOutcome(403)).toBe("refused");
    expect(deleteOutcome(401)).toBe("failed");
    expect(deleteOutcome(500)).toBe("failed");
    expect(deleteOutcome(502)).toBe("failed");
    expect(deleteOutcome(null)).toBe("failed");
  });
});

describe("alertsStatusWords", () => {
  it("says the state, and nothing while the permission is read", () => {
    expect(alertsStatusWords("on")).toBe("On");
    expect(alertsStatusWords("off")).toBe("Off");
    expect(alertsStatusWords("blocked")).toBe("Off in Android settings");
    expect(alertsStatusWords("unavailable")).toBe("In the Talebrim app for Android");
    expect(alertsStatusWords("loading")).toBe("");
  });
});

describe("versionLine", () => {
  it("reads the installed binary's version and build", () => {
    expect(versionLine("android", "1.0.0", "7")).toBe("Version 1.0.0 (7)");
    expect(versionLine("ios", "1.2.0", null)).toBe("Version 1.2.0");
  });

  it("names the web preview, which has no binary", () => {
    expect(versionLine("web", null, null)).toBe("Web preview");
  });

  it("is null when the platform reports none", () => {
    expect(versionLine("android", null, null)).toBeNull();
  });
});
