// Classic resource API — see the note in sign-in.tsx.
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { isSessionExists, toInlineMessage } from "@/lib/auth-errors";
import { routeAfterAuth } from "@/lib/auth-routing";

const CODE_LENGTH = 6;
// Throttles resend so a user cannot walk into Clerk's rate limit and land in
// a dead state with no way forward.
const RESEND_SECONDS = 30;

export default function Verify() {
  const insets = useSafeAreaInsets();
  const { email, flow } = useLocalSearchParams<{
    email?: string;
    flow?: string;
  }>();
  const isSignUp = flow === "sign-up";

  const { isLoaded: signInLoaded, signIn, setActive: setSignInActive } =
    useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setSignUpActive } =
    useSignUp();

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const clerkReady = signInLoaded && signUpLoaded;

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function onVerify(value: string = code) {
    if (value.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits.`);
      return;
    }
    if (!clerkReady || !signIn || !signUp) return;

    setError(null);
    setSubmitting(true);

    try {
      if (isSignUp) {
        const result = await signUp.attemptEmailAddressVerification({
          code: value,
        });
        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive({ session: result.createdSessionId });
          routeAfterAuth();
          return;
        }
        setError("We couldn't finish creating your account.");
        return;
      }

      const result = await signIn.attemptFirstFactor({
        strategy: "email_code",
        code: value,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await setSignInActive({ session: result.createdSessionId });
        routeAfterAuth();
        return;
      }
      setError("We couldn't finish signing you in.");
    } catch (e) {
      // Already authenticated — forward instead of erroring.
      if (isSessionExists(e)) {
        setSubmitting(false);
        routeAfterAuth();
        return;
      }
      setError(toInlineMessage(e));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (!clerkReady || !signIn || !signUp) return;

    setCode("");
    setError(null);
    setSecondsLeft(RESEND_SECONDS);

    try {
      if (isSignUp) {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
      } else {
        // create() re-sends for email_code; prepareFirstFactor() here would
        // be the second email that invalidates the first.
        await signIn.create({
          strategy: "email_code",
          identifier: email ?? "",
        });
      }
    } catch (e) {
      setError(toInlineMessage(e));
    }
  }

  const digits = Array.from(
    { length: CODE_LENGTH },
    (_, i) => code[i] ?? "",
  );

  return (
    <Screen className="px-6">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Heading className="mt-12">Check your email</Heading>
          <Body className="mt-3">
            {email
              ? `We sent a ${CODE_LENGTH}-digit code to ${email}.`
              : `We sent you a ${CODE_LENGTH}-digit code.`}
          </Body>

          {/* One hidden input backs the six boxes: it keeps paste, autofill
              and backspace working, which per-box inputs break. */}
          <Pressable
            accessibilityRole="none"
            className="mt-8"
            onPress={() => inputRef.current?.focus()}
          >
            <View className="flex-row justify-between" pointerEvents="none">
              {digits.map((digit, i) => {
                const active = i === code.length;
                return (
                  <View
                    key={i}
                    // Teal, not ember: the Verify pill is this screen's single
                    // ember element — AGENTS.md § Design System.
                    className={`h-14 w-12 items-center justify-center rounded-field bg-raised ${
                      active ? "border border-teal" : ""
                    }`}
                  >
                    <Text
                      className="font-ui-semibold text-body text-xl"
                      maxFontSizeMultiplier={1.3}
                    >
                      {digit}
                    </Text>
                  </View>
                );
              })}
            </View>

            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(next) => {
                const cleaned = next.replace(/\D/g, "").slice(0, CODE_LENGTH);
                setCode(cleaned);
                if (error) setError(null);
                if (cleaned.length === CODE_LENGTH) void onVerify(cleaned);
              }}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              maxLength={CODE_LENGTH}
              editable={!submitting}
              autoFocus
              accessibilityLabel={`${CODE_LENGTH} digit verification code`}
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0,
                color: "transparent",
              }}
            />
          </Pressable>

          {error ? (
            <Text
              accessibilityLiveRegion="polite"
              role="alert"
              className="font-ui text-destructive mt-3 text-sm"
            >
              {error}
            </Text>
          ) : null}

          <Button
            label="Verify"
            variant="primary"
            loading={submitting}
            disabled={!clerkReady}
            className="mt-6 h-14 w-full"
            onPress={() => void onVerify()}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Resend code"
            accessibilityState={{ disabled: secondsLeft > 0 || !clerkReady }}
            disabled={secondsLeft > 0 || !clerkReady}
            onPress={() => void onResend()}
            className="mt-5 min-h-11 flex-row items-center justify-center"
          >
            <Text
              className={`font-ui-medium text-[15px] ${
                secondsLeft > 0 ? "text-muted" : "text-teal"
              }`}
            >
              {secondsLeft > 0
                ? `Resend code in ${secondsLeft}s`
                : "Resend code"}
            </Text>
          </Pressable>

          <View className="flex-1" style={{ minHeight: insets.bottom + 12 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
