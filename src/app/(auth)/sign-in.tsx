import { useSSO } from "@clerk/expo";
// The top-level useSignIn/useSignUp in @clerk/expo v4 are the Core 3 "signal"
// API (SignInSignalValue), which has no isLoaded/setActive/attemptFirstFactor.
// The custom email-code flow needs the classic resource API, which lives here.
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { AntDesign } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Body, Button, Heading, Screen } from "@/components/ui";
import {
  isIdentifierAlreadyExists,
  isSessionExists,
  toInlineMessage,
} from "@/lib/auth-errors";
import { routeAfterAuth } from "@/lib/auth-routing";
import { colors } from "@/theme";

// Format check only — deliberately does NOT tell the user whether an account
// exists, which would leak account enumeration.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Safety net only. `signUp.create()` normally resolves or rejects, but
 * Clerk's bot protection can stall waiting on its widget. Without a ceiling
 * the button spins forever with no way out, which is worse than an error.
 */
const SIGNUP_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Sign-up timed out")),
        ms,
      ),
    ),
  ]);
}

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const { isLoaded: signInLoaded, signIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp } = useSignUp();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthPending, setOauthPending] = useState<"google" | "apple" | null>(
    null,
  );

  const clerkReady = signInLoaded && signUpLoaded;

  async function onContinueWithEmail() {
    setSubmitError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setValidationError("Enter a valid email address.");
      return;
    }
    if (!clerkReady || !signIn || !signUp) return;

    setValidationError(null);
    setSubmitting(true);
    const identifier = email.trim();

    try {
      // email_code: create() ALREADY sends the code. Calling
      // prepareFirstFactor() as well sends a second email and invalidates the
      // first, which reads to the user as a broken app
      // (clerk/javascript#887). Do not add it.
      await signIn.create({ strategy: "email_code", identifier });

      router.push({
        pathname: "/(auth)/verify",
        params: { email: identifier, flow: "sign-in" },
      });
    } catch (error) {
      // Already authenticated: forward rather than showing an error.
      if (isSessionExists(error)) {
        setSubmitting(false);
        routeAfterAuth();
        return;
      }

      // No account yet — fall through to sign-up rather than surfacing
      // "couldn't find an account", which would also leak enumeration.
      try {
        await withTimeout(
          signUp.create({ emailAddress: identifier }),
          SIGNUP_TIMEOUT_MS,
        );
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        router.push({
          pathname: "/(auth)/verify",
          params: { email: identifier, flow: "sign-up" },
        });
      } catch (signUpError) {
        // Identifier exists but sign-in failed for some other reason: show
        // the original sign-in error, which is the accurate one.
        const shown = isIdentifierAlreadyExists(signUpError)
          ? error
          : signUpError;
        const message = toInlineMessage(shown);
        // Never leave the user with a tap that did nothing.
        setSubmitError(message || "Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const onSSO = useCallback(
    async (provider: "google" | "apple") => {
      setValidationError(null);
      setSubmitError(null);
      setOauthPending(provider);

      try {
        const { createdSessionId, setActive } = await startSSOFlow({
          strategy: provider === "google" ? "oauth_google" : "oauth_apple",
          // On web the popup only closes if the URL it lands on starts with
          // the exact redirect the flow opened with (expo-web-browser's
          // `_waitForRedirectAsync` does a startsWith check). Left to its
          // default, `makeRedirectUri()` derives from window.location and can
          // resolve to a different origin than the tab you started in — the
          // match then fails and the popup hangs with the app inside it.
          // Anchoring to the live origin keeps both sides identical.
          // Native ignores this and uses the app scheme.
          ...(Platform.OS === "web"
            ? { redirectUrl: `${window.location.origin}/sso-callback` }
            : {}),
        });

        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId });
          routeAfterAuth();
          return;
        }
        // No session and no throw means the user dismissed the sheet.
      } catch (error) {
        if (__DEV__) {
          console.log(
            "[sso] raw error:",
            JSON.stringify(
              {
                name: (error as Error)?.name,
                message: (error as Error)?.message,
                clerkErrors: (error as { errors?: unknown })?.errors,
              },
              null,
              2,
            ),
          );
        }
        // Already authenticated — Clerk refuses a second sign-in. That is
        // success from the user's point of view, so forward instead of
        // showing an error they cannot act on.
        if (isSessionExists(error)) {
          routeAfterAuth();
          return;
        }
        setSubmitError(toInlineMessage(error));
      } finally {
        setOauthPending(null);
      }
    },
    [startSSOFlow],
  );

  const inlineError = validationError ?? submitError;

  return (
    <Screen edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="no-scrollbar"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* MISSING ASSET: assets/Image/auth-header.png is not in the repo.
              AGENTS.md § Image Generation Rules forbids generating, downloading
              or hotlinking cover art, so this renders the raised block at the
              correct height until the real collage is supplied by the CMS. */}
          <View
            className="w-full bg-raised"
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ height: 260 }}
          />

          <View className="flex-1 px-6">
            <Heading className="mt-8 text-center">
              Pick up where you left off
            </Heading>
            <Body className="mt-3 text-center">
              Your place in every story, on every device.
            </Body>

            <Button
              label="Continue with Google"
              variant="outlined"
              className="mt-8 h-14 w-full"
              loading={oauthPending === "google"}
              disabled={!clerkReady || submitting || oauthPending !== null}
              icon={<AntDesign name="google" size={18} color={colors.body} />}
              onPress={() => void onSSO("google")}
            />
            <Button
              label="Continue with Apple"
              variant="outlined"
              className="mt-3 h-14 w-full"
              loading={oauthPending === "apple"}
              disabled={!clerkReady || submitting || oauthPending !== null}
              icon={<AntDesign name="apple" size={18} color={colors.body} />}
              onPress={() => void onSSO("apple")}
            />

            <View className="mt-6 flex-row items-center gap-4">
              <View className="bg-muted/30 h-px flex-1" />
              <Text className="font-ui text-muted text-sm">OR</Text>
              <View className="bg-muted/30 h-px flex-1" />
            </View>

            <View className="field mt-6 h-14">
              <TextInput
                value={email}
                onChangeText={(next) => {
                  setEmail(next);
                  if (validationError) setValidationError(null);
                  if (submitError) setSubmitError(null);
                }}
                placeholder="Email address"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                // textContentType takes precedence on iOS, so only one of
                // autoComplete / textContentType is set — see RN TextInput docs.
                textContentType="emailAddress"
                inputMode="email"
                returnKeyType="go"
                onSubmitEditing={onContinueWithEmail}
                editable={!submitting}
                accessibilityLabel="Email address"
                maxFontSizeMultiplier={1.3}
                style={{
                  flex: 1,
                  color: colors.body,
                  fontFamily: "Inter-Regular",
                  fontSize: 16,
                }}
              />
            </View>

            {inlineError ? (
              <Text
                accessibilityLiveRegion="polite"
                role="alert"
                className="font-ui text-destructive mt-2 text-sm"
              >
                {inlineError}
              </Text>
            ) : null}

            <Button
              label="Continue with email"
              variant="primary"
              loading={submitting}
              disabled={!clerkReady || oauthPending !== null}
              className="mt-4 h-14 w-full"
              onPress={onContinueWithEmail}
            />

            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Create an account"
              className="mt-5 min-h-11 flex-row items-center justify-center"
              onPress={onContinueWithEmail}
            >
              <Text className="font-ui text-muted text-[15px]">
                New here?{" "}
              </Text>
              <Text className="font-ui-semibold text-teal text-[15px]">
                Create an account
              </Text>
            </Pressable>

            <View className="min-h-6 flex-1" />

            {/* AGENTS.md § Content Rules specifies 18+ and the product name
                talebrim; the design material reads "17+" and "NovelNow". */}
            <Text
              className="font-ui text-muted text-center text-sm"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
            >
              You must be 18+ to use talebrim. By continuing you agree to our
              Terms and Privacy Policy.
            </Text>

            {/* Clerk's bot protection mounts its widget here. It MUST exist in
                the tree before signUp.create() runs or the SDK falls back to
                an invisible widget that silently blocks suspected bots. On
                iOS/Android Clerk skips the challenge entirely and this stays
                empty, so it is invisible in the normal case.
                https://clerk.com/docs/expo/guides/development/custom-flows/bot-sign-up-protection */}
            <View nativeID="clerk-captcha" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
