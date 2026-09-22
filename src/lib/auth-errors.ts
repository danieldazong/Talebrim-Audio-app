/**
 * Maps Clerk errors to the inline copy M1 already renders.
 *
 * Reads the error CODE, never the message string — Clerk's messages are not a
 * stable API and change between releases.
 * https://clerk.com/docs/guides/development/custom-flows/error-handling
 */

type ClerkApiError = { code?: string; message?: string; longMessage?: string };

function extractErrors(error: unknown): ClerkApiError[] {
  if (error && typeof error === "object" && "errors" in error) {
    const { errors } = error as { errors?: unknown };
    if (Array.isArray(errors)) return errors as ClerkApiError[];
  }
  return [];
}

/** True when the identifier already exists, so sign-up should fall through to sign-in. */
export function isIdentifierAlreadyExists(error: unknown): boolean {
  return extractErrors(error).some(
    (e) => e.code === "form_identifier_exists",
  );
}

/** True when the user must complete more steps than this flow handles. */
export function isSessionExists(error: unknown): boolean {
  return extractErrors(error).some((e) => e.code === "session_exists");
}

function rawMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

/** Bot protection blocked the attempt rather than merely failing to render. */
export function isCaptchaBlocked(error: unknown): boolean {
  return extractErrors(error).some(
    (e) => e.code === "captcha_invalid" || e.code === "captcha_missing_token",
  );
}

/**
 * The OAuth redirect URL is not on Clerk's allowlist, so the callback comes
 * back without a `rotating_token_nonce` and the flow cannot complete.
 * A config fault, not a user-retryable one.
 */
export function isRedirectNotAllowlisted(error: unknown): boolean {
  const codes = extractErrors(error).map((e) => e.code);
  if (
    codes.includes("redirect_url_mismatch") ||
    codes.includes("form_param_value_invalid")
  ) {
    return true;
  }
  const message = rawMessage(error).toLowerCase();
  return (
    message.includes("redirect") ||
    message.includes("external verification redirect url")
  );
}

/**
 * A required native module is absent. This is a build/config fault, not
 * something the user can retry their way out of, so it must not be dressed up
 * as a network error — that misdiagnosis costs real debugging time.
 */
export function isMissingNativeModule(error: unknown): boolean {
  const message = rawMessage(error).toLowerCase();
  return (
    message.includes("unable to load") ||
    message.includes("cannot find module") ||
    message.includes("requirenativemodule")
  );
}

export function toInlineMessage(error: unknown): string {
  if (isMissingNativeModule(error)) {
    return "This build is missing a required module. Rebuild the app and try again.";
  }
  if (isCaptchaBlocked(error)) {
    return "We couldn't verify this device. Try again in a moment.";
  }
  if (isRedirectNotAllowlisted(error)) {
    return "This sign-in method isn't set up for this build yet.";
  }

  const codes = extractErrors(error).map((e) => e.code);

  // Order matters: check the most specific codes first.
  if (codes.includes("form_code_incorrect")) {
    return "That code isn't right. Check it and try again.";
  }
  if (codes.includes("verification_expired")) {
    return "That code expired. Request a new one.";
  }
  if (codes.includes("verification_failed")) {
    return "Too many incorrect attempts. Request a new code.";
  }
  if (
    codes.includes("too_many_requests") ||
    codes.includes("rate_limit_exceeded")
  ) {
    return "Too many attempts. Wait a moment and try again.";
  }
  if (codes.includes("form_identifier_not_found")) {
    return "We couldn't find an account for that email.";
  }
  if (codes.includes("form_param_format_invalid")) {
    return "Enter a valid email address.";
  }
  if (
    codes.includes("identifier_already_signed_in") ||
    codes.includes("session_exists")
  ) {
    return "You're already signed in.";
  }
  if (
    codes.includes("form_identifier_verification_required") ||
    codes.includes("verification_missing")
  ) {
    return "That email needs verifying before you can sign in.";
  }

  if (codes.length === 0) {
    // Only claim a network problem when it actually looks like one. Calling
    // every unrecognised throw a connection failure sends users (and
    // debugging) in the wrong direction.
    const message = rawMessage(error).toLowerCase();
    const looksNetworkish =
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("timed out") ||
      message.includes("timeout");

    if (looksNetworkish) {
      return "We couldn't reach Talebrim. Check your connection and try again.";
    }
    if (__DEV__ && message) {
      console.warn("[auth] unmapped error:", rawMessage(error));
    }
  }

  return "Something went wrong. Please try again.";
}
